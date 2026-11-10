// A mock interview taken in turns (D100, research doc 24 §4, §12 and §13), apart from React: it
// plays the interviewer's lines, records each answer from the end of the question until "I'm
// done", sends it and plays what comes back, pauses with the tab, and ends. It measures what
// §13.5 asks of the browser and sends it with the next call. The page shows its `view` and calls
// its actions; the gateway, the microphone and the player are given, so the specs replace them.
import { type Playback, PlaybackBlockedError, type Recording } from './audio';

import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';
import { type ProfileGateway } from '@/core/profile/gateway';
import {
  MOCK_ANSWER_MAX_MS,
  type MockClient,
  type MockEndReason,
  type MockHintsShown,
  type MockLength,
  type MockLine,
  type MockLines,
  type MockPlayed,
  type MockVoice,
  type MockWay,
} from '@/core/profile/mockInterviews';

export type MockPhase =
  /** Before the press that starts or continues it. */
  | 'idle'
  | 'mic-asking'
  | 'mic-refused'
  | 'mic-missing'
  /** This browser can't record. */
  | 'unsupported'
  /** The start or resume call. */
  | 'starting'
  | 'speaking'
  /** The browser held the sound back: "Tap to hear the question". */
  | 'tap'
  | 'answering'
  /** An answer, a skip or "Say it differently" sent. */
  | 'sending'
  /** Something to put right before going on (`issue`). */
  | 'issue'
  | 'paused'
  | 'ended';

export type MockIssue =
  /** No words in the answer: the question stays open. */
  | 'nothing-heard'
  /** The answer couldn't be sent: it's still here, on this page only. */
  | 'send-failed'
  /** A skip or "Say it differently" didn't go through. */
  | 'action-failed'
  /** The microphone stopped mid-answer: what was said so far is kept. */
  | 'mic-lost';

/** What the interviewer card shows: the question being asked or answered. */
export interface MockQuestion {
  lineId: string;
  turnId?: string;
  text: string;
  kind: MockLine['kind'];
}

export interface MockView {
  phase: MockPhase;
  sessionId?: string;
  question?: MockQuestion;
  /** The line playing now, the opening included. */
  speaking?: MockQuestion;
  issue?: MockIssue;
  pausedDuring?: 'speaking' | 'answering';
  /** What is being sent, while `sending`. */
  sending?: 'answer' | 'skip' | 'rephrase';
  /** "Say it differently" was asked for this question: once each. */
  rephrased: boolean;
  /**
   * The turn whose answer was just sent, from "I'm done" until the next answer starts recording:
   * hints shown "after I answer" are its, under "For the question you just answered" (H2). Not
   * set while its answer wasn't heard or didn't go.
   */
  answered?: string;
  /** The time left as last told, and when; it runs down while the interview runs. */
  timeLeft?: { ms: number; at: number };
  /** Why the start or the resume was refused. */
  startFailure?: ProfileErrorCode;
  endReason?: MockEndReason;
}

export interface MockSetup {
  applicationId: string;
  interviewId?: string;
  way: MockWay;
  lengthMinutes: MockLength;
  voice: MockVoice;
  hints: MockHintsShown;
}

export interface RecorderLike {
  start(): void;
  pause(): void;
  resume(): void;
  elapsedMs(): number;
  stop(): Promise<Recording>;
  discard(): void;
}

export interface PlayerLike {
  unlock(): Promise<boolean>;
  play(audio: { base64: string }): Promise<Playback>;
  close(): void;
}

export interface MockDeps {
  gateway: Pick<
    ProfileGateway,
    | 'startMockInterview'
    | 'answerMockQuestion'
    | 'rephraseMockQuestion'
    | 'skipMockQuestion'
    | 'pauseMockInterview'
    | 'resumeMockInterview'
    | 'endMockInterview'
  >;
  openMicrophone(): Promise<MediaStream>;
  createRecorder(stream: MediaStream): RecorderLike;
  player: PlayerLike;
  client(): Promise<MockClient>;
  toBase64(blob: Blob): Promise<string>;
  uuid(): string;
  now(): number;
  wait(ms: number): Promise<void>;
}

/** A call refused as `busy` is sent again a second later, this many times. */
const BUSY_TRIES = 5;

const ANSWERABLE: ReadonlySet<MockLine['kind']> = new Set([
  'question',
  'follow-up',
  'rephrase',
]);

const asQuestion = (line: MockLine): MockQuestion => ({
  lineId: line.lineId,
  ...(line.turnId ? { turnId: line.turnId } : {}),
  text: line.text,
  kind: line.kind,
});

/** What was sent and can be sent again with the same request id. */
type Pending =
  | { kind: 'answer'; requestId: string; recording: Recording }
  | { kind: 'skip' | 'rephrase'; requestId: string };

export class MockInterviewController {
  private state: MockView = { phase: 'idle', rephrased: false };
  private readonly listeners = new Set<() => void>();
  private stream: MediaStream | null = null;
  private recorder: RecorderLike | null = null;
  private playback: Playback | null = null;
  /** Goes up with every action, so a step still waiting on the one before stops. */
  private generation = 0;
  /** Lines played since the last call, measured, sent with the next one. */
  private played = new Map<string, MockPlayed>();
  /** The audio of each line said, so Repeat plays it again with no call. */
  private readonly audio = new Map<string, MockLine['audio']>();
  /** Lines still to play after the one held back by the browser. */
  private queue: { lines: MockLine[]; ended: boolean } | null = null;
  private pending: Pending | null = null;
  /** When the press that asked for the next line was made, and when its answer came. */
  private pressedAt = 0;
  private respondedAt = 0;
  private tapped = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private startRequestId: string | null = null;

  private onStarted: ((sessionId: string) => void) | null = null;

  constructor(private readonly deps: MockDeps) {}

  // ---------- For React (useSyncExternalStore) ----------

  /** When the interview gets its id: the page puts it in its address. */
  whenStarted = (listener: (sessionId: string) => void) => {
    this.onStarted = listener;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): MockView => this.state;

  /** How long the answer has been recorded, for "Recording · 1:12". */
  recordedMs = (): number => this.recorder?.elapsedMs() ?? 0;

  /** An answer is being recorded, or was and isn't sent: leaving or ending loses it. */
  holdsAnswer = (): boolean =>
    this.recorder !== null ||
    this.pending?.kind === 'answer' ||
    (this.state.phase === 'paused' && this.state.pausedDuring === 'answering');

  private set(change: Partial<MockView>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }

  private clock(timeLeftMs: number | undefined) {
    if (timeLeftMs !== undefined && Number.isFinite(timeLeftMs)) {
      this.set({ timeLeft: { ms: timeLeftMs, at: this.deps.now() } });
    }
  }

  // ---------- Starting and continuing ----------

  /** "Start the interview": called in the press itself, so the browser lets the sound play. */
  async start(setup: MockSetup): Promise<void> {
    const unlocked = this.deps.player.unlock();
    this.pressedAt = this.deps.now();
    const generation = ++this.generation;
    if (!(await this.microphone(generation))) {
      return;
    }
    this.tapped = !(await unlocked);
    const client = await this.deps.client().catch(() => undefined);
    this.set({ phase: 'starting', startFailure: undefined });
    this.startRequestId ??= this.deps.uuid();
    let result: { sessionId: string } & MockLines;
    try {
      result = await this.busyRetry(() =>
        this.deps.gateway.startMockInterview({
          requestId: this.startRequestId!,
          ...setup,
          ...(client ? { client } : {}),
        }),
      );
    } catch (error) {
      this.set({ phase: 'idle', startFailure: getProfileErrorCode(error) });
      return;
    }
    this.startRequestId = null;
    this.respondedAt = this.deps.now();
    this.set({ sessionId: result.sessionId });
    this.onStarted?.(result.sessionId);
    this.clock(result.timeLeftMs);
    await this.speak(result, generation);
  }

  /** "Continue the interview" after a reload: the line waiting for an answer, spoken again. */
  async resume(sessionId: string): Promise<void> {
    const unlocked = this.deps.player.unlock();
    this.pressedAt = this.deps.now();
    const generation = ++this.generation;
    this.set({ sessionId });
    if (!(await this.microphone(generation))) {
      return;
    }
    this.tapped = !(await unlocked);
    this.set({ phase: 'starting', startFailure: undefined });
    try {
      const result = await this.busyRetry(() =>
        this.deps.gateway.resumeMockInterview(sessionId),
      );
      if (result.paused) {
        const { timeLeftMs } = await this.deps.gateway.pauseMockInterview({
          sessionId,
          paused: false,
        });
        result.timeLeftMs = timeLeftMs;
      }
      this.respondedAt = this.deps.now();
      this.clock(result.timeLeftMs);
      await this.speak(result, generation);
    } catch (error) {
      this.refused(error, () =>
        this.set({ phase: 'idle', startFailure: getProfileErrorCode(error) }),
      );
    }
  }

  private async microphone(generation: number): Promise<boolean> {
    if (
      this.stream?.getAudioTracks().some(track => track.readyState === 'live')
    ) {
      return true;
    }
    this.set({ phase: 'mic-asking', startFailure: undefined });
    try {
      this.stream = await this.deps.openMicrophone();
    } catch (error) {
      const failure =
        error instanceof Error && 'failure' in error
          ? (error as { failure: string }).failure
          : 'missing';
      this.set({
        phase:
          failure === 'refused'
            ? 'mic-refused'
            : failure === 'unsupported'
              ? 'unsupported'
              : 'mic-missing',
      });
      return false;
    }
    for (const track of this.stream.getAudioTracks()) {
      track.addEventListener('ended', () => this.microphoneLost());
    }
    return generation === this.generation;
  }

  // ---------- The interviewer speaks ----------

  /** Plays the lines in order; after a question, the answer starts; after the closing, the end. */
  private async speak(
    { lines, status }: Pick<MockLines, 'lines' | 'status'>,
    generation: number,
  ): Promise<void> {
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      this.audio.set(line.lineId, line.audio);
      if (ANSWERABLE.has(line.kind)) {
        this.set({
          question: asQuestion(line),
          rephrased: line.kind === 'rephrase' || this.state.rephrased,
        });
      }
      this.set({
        phase: 'speaking',
        speaking: asQuestion(line),
        issue: undefined,
      });
      let playback: Playback;
      try {
        playback = await this.deps.player.play(line.audio);
      } catch (error) {
        if (error instanceof PlaybackBlockedError) {
          this.queue = { lines: lines.slice(index), ended: status === 'ended' };
          this.set({ phase: 'tap' });
          return;
        }
        // A line that can't be played is still shown: go on as if it was heard.
        continue;
      }
      if (generation !== this.generation) {
        playback.stop();
        return;
      }
      this.playback = playback;
      const soundAt = await playback.started;
      this.measure(line.lineId, {
        firstSoundMs: Math.round(soundAt - this.pressedAt),
        startMs: Math.round(soundAt - this.respondedAt),
        ...(this.tapped ? { tapped: true } : {}),
      });
      await playback.ended;
      this.playback = null;
      if (generation !== this.generation) {
        return;
      }
    }
    if (status === 'ended') {
      this.finish('finished');
      return;
    }
    this.record();
  }

  private measure(lineId: string, measured: Omit<MockPlayed, 'lineId'>) {
    const known = this.played.get(lineId);
    this.played.set(lineId, { ...known, lineId, ...measured });
  }

  /** "Tap to hear the question": the press lets the browser play it. */
  async tapToHear(): Promise<void> {
    const queue = this.queue;
    this.queue = null;
    this.tapped = true;
    const generation = ++this.generation;
    await this.deps.player.unlock();
    if (queue) {
      await this.speak(
        { lines: queue.lines, status: queue.ended ? 'ended' : 'active' },
        generation,
      );
    }
  }

  /** "Stop and answer now": the rest of what the interviewer says is skipped. */
  stopAndAnswer() {
    if (this.state.phase !== 'speaking' && this.state.phase !== 'tap') {
      return;
    }
    ++this.generation;
    this.playback?.stop();
    this.playback = null;
    this.queue = null;
    this.record();
  }

  /** Repeat: the question again, from what the page holds; the answer starts again after it. */
  async repeat(): Promise<void> {
    const question = this.state.question;
    const audio = question ? this.audio.get(question.lineId) : undefined;
    if (!question || !audio) {
      return;
    }
    this.dropAnswer();
    const known = this.played.get(question.lineId);
    this.measure(question.lineId, { repeats: (known?.repeats ?? 0) + 1 });
    const generation = ++this.generation;
    this.set({ phase: 'speaking', speaking: question, issue: undefined });
    try {
      const playback = await this.deps.player.play(audio);
      this.playback = playback;
      await playback.ended;
      this.playback = null;
    } catch {
      // Not played again: the answer starts anyway.
    }
    if (generation === this.generation) {
      this.record();
    }
  }

  // ---------- The answer ----------

  private record() {
    if (!this.stream) {
      this.set({ phase: 'issue', issue: 'mic-lost' });
      return;
    }
    this.dropAnswer();
    const recorder = this.deps.createRecorder(this.stream);
    this.recorder = recorder;
    recorder.start();
    this.stopTimer = setTimeout(() => {
      // At 3 minutes the answer is sent for the candidate.
      void this.done();
    }, MOCK_ANSWER_MAX_MS);
    this.set({
      phase: 'answering',
      issue: undefined,
      speaking: undefined,
      answered: undefined,
    });
  }

  /** Stops and forgets the answer being recorded. */
  private dropAnswer() {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.recorder?.discard();
    this.recorder = null;
    if (this.pending?.kind === 'answer') {
      this.pending = null;
    }
  }

  /** "Start this answer again", and "Answer again" after nothing was heard. */
  restartAnswer() {
    ++this.generation;
    this.record();
  }

  /** "I'm done": the answer is sent, and what the interviewer says next is played. */
  async done(): Promise<void> {
    const recorder = this.recorder;
    if (!recorder) {
      return;
    }
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.pressedAt = this.deps.now();
    this.recorder = null;
    const recording = await recorder.stop();
    this.pending = {
      kind: 'answer',
      requestId: this.deps.uuid(),
      recording,
    };
    await this.send();
  }

  /** "Send again" after a failure: the same request, so it never answers twice. */
  async sendAgain(): Promise<void> {
    this.pressedAt = this.deps.now();
    await this.send();
  }

  /** "Say it differently": the other wording, which becomes the question to answer. */
  async sayDifferently(): Promise<void> {
    if (this.state.rephrased) {
      return;
    }
    this.dropAnswer();
    this.pressedAt = this.deps.now();
    this.pending = { kind: 'rephrase', requestId: this.deps.uuid() };
    await this.send();
  }

  /** Skip: what was recorded is dropped; the next question, or the end. */
  async skip(): Promise<void> {
    this.dropAnswer();
    this.pressedAt = this.deps.now();
    this.pending = { kind: 'skip', requestId: this.deps.uuid() };
    await this.send();
  }

  private async send(): Promise<void> {
    const pending = this.pending;
    const { sessionId, question } = this.state;
    if (!pending || !sessionId || !question) {
      return;
    }
    if (pending.kind === 'answer' && pending.recording.blob.size === 0) {
      // "I'm done" before the browser gave any sound (a quick double press): nothing to hear, and
      // the backend refuses an empty recording.
      this.pending = null;
      this.set({ phase: 'issue', issue: 'nothing-heard', answered: undefined });
      return;
    }
    const generation = ++this.generation;
    this.set({
      phase: 'sending',
      sending: pending.kind,
      issue: undefined,
      ...(pending.kind === 'answer' ? { answered: question.turnId } : {}),
    });
    const played = [...this.played.values()];
    const base = {
      requestId: pending.requestId,
      sessionId,
      lineId: question.lineId,
      ...(played.length > 0 ? { played } : {}),
    };
    let result: MockLines;
    try {
      if (pending.kind === 'answer') {
        const { recording } = pending;
        const base64 = await this.deps.toBase64(recording.blob);
        result = await this.busyRetry(() =>
          this.deps.gateway.answerMockQuestion({
            ...base,
            audio: {
              mimeType: recording.mimeType,
              base64,
              durationMs: recording.durationMs,
            },
          }),
        );
      } else if (pending.kind === 'skip') {
        result = await this.busyRetry(() =>
          this.deps.gateway.skipMockQuestion(base),
        );
      } else {
        result = await this.busyRetry(() =>
          this.deps.gateway.rephraseMockQuestion(base),
        );
      }
    } catch (error) {
      if (generation === this.generation) {
        this.sendFailed(error, pending);
      }
      return;
    }
    if (generation !== this.generation) {
      return;
    }
    this.pending = null;
    this.played = new Map();
    this.respondedAt = this.deps.now();
    this.tapped = false;
    this.clock(result.timeLeftMs);
    if (pending.kind !== 'rephrase') {
      this.set({ rephrased: false });
    }
    await this.speak(result, generation);
  }

  private sendFailed(error: unknown, pending: Pending) {
    const code = getProfileErrorCode(error);
    if (code === ProfileErrorCode.MockNothingHeard) {
      this.pending = null;
      this.set({ phase: 'issue', issue: 'nothing-heard', answered: undefined });
      return;
    }
    if (code === ProfileErrorCode.MockNotCurrent) {
      // Answered or moved on in another tab: the line that waits now, spoken.
      this.pending = null;
      void this.again();
      return;
    }
    this.refused(error, () =>
      this.set({
        phase: 'issue',
        ...(pending.kind === 'answer'
          ? { issue: 'send-failed', answered: undefined }
          : { issue: 'action-failed' }),
      }),
    );
  }

  /** The line waiting for an answer, from the backend. */
  private async again() {
    const sessionId = this.state.sessionId;
    if (!sessionId) {
      return;
    }
    const generation = ++this.generation;
    try {
      const result = await this.deps.gateway.resumeMockInterview(sessionId);
      this.respondedAt = this.deps.now();
      this.clock(result.timeLeftMs);
      await this.speak(result, generation);
    } catch (error) {
      this.refused(error, () =>
        this.set({ phase: 'issue', issue: 'send-failed' }),
      );
    }
  }

  /** Ends the interview on the refusals that mean it is over; otherwise does `otherwise`. */
  private refused(error: unknown, otherwise: () => void) {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.MockSessionEnded:
        // The page reads why from the session.
        this.finish();
        return;
      case ProfileErrorCode.MockSessionFailed:
        this.finish('failed');
        return;
      case ProfileErrorCode.DailyLimit:
        this.finish('quota');
        return;
      default:
        otherwise();
    }
  }

  private async busyRetry<T>(call: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await call();
      } catch (error) {
        if (
          getProfileErrorCode(error) !== ProfileErrorCode.MockBusy ||
          attempt >= BUSY_TRIES
        ) {
          throw error;
        }
        await this.deps.wait(1_000);
      }
    }
  }

  private microphoneLost() {
    if (this.state.phase !== 'answering' || !this.recorder) {
      this.stream = null;
      return;
    }
    const recorder = this.recorder;
    this.recorder = null;
    this.stream = null;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    void recorder.stop().then(recording => {
      this.pending = { kind: 'answer', requestId: this.deps.uuid(), recording };
      this.set({ phase: 'issue', issue: 'mic-lost' });
    });
  }

  /** "Try again" after the microphone stopped: the answer starts again with it. */
  async reconnect(): Promise<void> {
    const generation = ++this.generation;
    this.pending = null;
    this.stream = null;
    if (await this.microphone(generation)) {
      this.record();
    }
  }

  // ---------- The tab left, and back ----------

  /** The tab was left: the sound and the recording pause, and so does the backend's clock. */
  pause() {
    const { phase, sessionId } = this.state;
    if (!sessionId || (phase !== 'speaking' && phase !== 'answering')) {
      return;
    }
    ++this.generation;
    if (phase === 'speaking') {
      this.playback?.stop();
      this.playback = null;
      this.queue = null;
    } else {
      this.recorder?.pause();
    }
    const at = this.deps.now();
    const left = this.state.timeLeft
      ? this.state.timeLeft.ms - (at - this.state.timeLeft.at)
      : undefined;
    this.set({
      phase: 'paused',
      pausedDuring: phase,
      ...(left === undefined ? {} : { timeLeft: { ms: left, at } }),
    });
    const played = [...this.played.values()];
    this.deps.gateway
      .pauseMockInterview({
        sessionId,
        paused: true,
        ...(played.length > 0 ? { played } : {}),
      })
      .then(
        () => {
          this.played = new Map();
        },
        () => {
          // Told again with the next call.
        },
      );
  }

  /** Back from the pause: the backend's clock goes on, then `next`. */
  private async unpause(next: () => void | Promise<void>) {
    const sessionId = this.state.sessionId;
    if (!sessionId) {
      return;
    }
    const generation = ++this.generation;
    try {
      const { timeLeftMs } = await this.deps.gateway.pauseMockInterview({
        sessionId,
        paused: false,
      });
      if (generation !== this.generation) {
        return;
      }
      this.clock(timeLeftMs);
    } catch (error) {
      if (getProfileErrorCode(error) === ProfileErrorCode.MockSessionEnded) {
        this.finish();
        return;
      }
      // The clock is told again with the next call.
    }
    await next();
  }

  /** "Continue answering": the recording goes on from where it paused. */
  continueAnswering(): Promise<void> {
    return this.unpause(() => {
      this.recorder?.resume();
      this.set({ phase: 'answering', pausedDuring: undefined });
    });
  }

  /** "Start this answer again" from the pause. */
  answerAgainFromPause(): Promise<void> {
    return this.unpause(() => {
      this.set({ pausedDuring: undefined });
      this.record();
    });
  }

  /** "Hear the question again" after a pause while it was spoken. */
  hearAgain(): Promise<void> {
    return this.unpause(() => {
      this.set({ pausedDuring: undefined });
      return this.repeat();
    });
  }

  // ---------- The end ----------

  /** "End interview": what is held is dropped (the page asks first when it is an answer). */
  async end(): Promise<void> {
    const sessionId = this.state.sessionId;
    ++this.generation;
    this.playback?.stop();
    this.playback = null;
    this.queue = null;
    this.dropAnswer();
    this.pending = null;
    if (sessionId) {
      const played = [...this.played.values()];
      try {
        await this.deps.gateway.endMockInterview(
          sessionId,
          played.length > 0 ? played : undefined,
        );
      } catch {
        // The backend ends an idle session by itself.
      }
    }
    this.finish('ended');
  }

  private finish(reason?: MockEndReason) {
    ++this.generation;
    this.dropAnswer();
    this.releaseMicrophone();
    this.set({
      phase: 'ended',
      endReason: reason,
      issue: undefined,
      speaking: undefined,
      pausedDuring: undefined,
    });
  }

  private releaseMicrophone() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }

  /**
   * The page closed: nothing keeps playing, recording or holding the microphone. The controller
   * can still be used after (React may mount a page twice): the player opens again on a press.
   */
  dispose() {
    ++this.generation;
    this.playback?.stop();
    this.dropAnswer();
    this.releaseMicrophone();
    this.deps.player.close();
  }
}
