// A mock interview in real time (D100, research doc 24 §15 and §16; ways 2 and 3), apart from React: the
// start call, then one connection to the `live-assist` relay. The microphone streams all the time
// in 100 ms frames; the interviewer's voice plays as its frames come; the relay says what to show
// (speaking, listening, thinking, paused, ended) and notices the end of each answer. The page's own
// voice detection stops the interviewer when the candidate speaks over it, and it reconnects when
// the connection drops (the relay stops the clock meanwhile). The page shows its `view` and calls
// its actions; the gateway, the microphone, the streamer and the voice are given, so the specs
// replace them. The voice model (way 3) speaks first and writes its words after (`lineEnd`), says
// the opening and the first question in one line, and gives no `answerEnd`: an answer ends when
// it starts speaking again, or thinks.
import {
  encodeMicFrame,
  LIVE_PING_MS,
  LIVE_PROTOCOL_VERSION,
  type LiveError,
  type LiveHello,
  type LivePageMessage,
  type LiveRelayMessage,
  type LiveSocket,
  lineNumber,
  decodeVoiceFrame,
  parseRelayMessage,
  RESUME_TOKEN_MS,
} from './liveProtocol';
import { type MockQuestion, type MockSetup } from './MockInterviewController';

import { microphoneFailureOf } from '@/core/audio/recording';
import { getProfileErrorCode, ProfileErrorCode } from '@/core/profile/errors';
import { type ProfileGateway } from '@/core/profile/gateway';
import {
  type MockClient,
  type MockEndReason,
  type MockLine,
  type MockWay,
} from '@/core/profile/mockInterviews';

export type LivePhase =
  /** Before the press that starts or continues it. */
  | 'idle'
  | 'mic-asking'
  | 'mic-refused'
  | 'mic-missing'
  /** This browser can't stream the microphone. */
  | 'unsupported'
  /** The start call: the plan is written. */
  | 'starting'
  /** Until the relay is ready: the first interview of the day can take a few seconds. */
  | 'connecting'
  | 'speaking'
  /** Your turn: the answer is heard as it is given. */
  | 'listening'
  /** The answer has ended; the interviewer decides what comes next. */
  | 'thinking'
  | 'paused'
  /** The connection dropped; the interview carries on where it was once back. */
  | 'reconnecting'
  /** It didn't come back: "Try again" or "End the interview". */
  | 'disconnected'
  /** Taken over in another tab or window. */
  | 'replaced'
  | 'ended';

export interface LiveView {
  phase: LivePhase;
  sessionId?: string;
  /** The line to answer: a question, a follow-up, or one said differently. */
  question?: MockQuestion;
  /** The line being said, the opening and closing included. */
  speaking?: MockQuestion;
  /** "Say it differently" was asked for this question: once each. */
  rephrased: boolean;
  /** The turn whose answer just ended, until the next answer starts: hints shown "after I answer" are its. */
  answered?: string;
  /** The last words heard of the answer being given. */
  heard?: string;
  /** "I'm done" with no words heard yet: still listening. */
  nothingHeard: boolean;
  /** 30 seconds of the answer left. */
  answerTimeWarn: boolean;
  /** When the answer being given started (`now()`), for "Listening · 0:42". */
  listeningSince?: number;
  /** How long the answer that just ended lasted. */
  answerEndedMs?: number;
  /** The time left as last told, and when; it runs down while the interview runs. */
  timeLeft?: { ms: number; at: number };
  /** Why the start, or the relay, refused. */
  startFailure?: ProfileErrorCode;
  endReason?: MockEndReason;
  /** The way the relay said it speaks: the voice model's lines come with their words at their end. */
  way?: MockWay;
  /** The voice model's line cut off within its first word: no words came for it. */
  cutOffLine?: string;
  /** The line whose answer just ended: the voice model's turns are matched to their lines. */
  answeredLine?: string;
  /** Lines whose words have come (`lineEnd`): the voice model's record has the line's turn by then. */
  linesEnded: number;
}

export interface LiveStreamerLike {
  stop(): void;
}

export interface LiveVoiceLike {
  /** In a press: lets the browser play the voice. Resolves whether it can. */
  unlock(): Promise<boolean>;
  /** Plays a frame of a line after what is queued. */
  push(line: number, samples: Float32Array): void;
  /** When each line's first sound is heard (`now()`). */
  onStarted: ((line: number, at: number) => void) | null;
  /** Stops a line and drops its later frames; resolves how far into it the playback was, in ms. */
  stop(line: number): number;
  /** Something is playing, or queued to. */
  playing(): boolean;
  close(): void;
}

export interface LiveDeps {
  gateway: Pick<
    ProfileGateway,
    | 'startMockInterview'
    | 'resumeMockInterview'
    | 'pauseMockInterview'
    | 'endMockInterview'
    | 'getLiveTokens'
    | 'openLiveSocket'
  >;
  openMicrophone(): Promise<MediaStream>;
  /** Streams the microphone in 100 ms frames of 16 kHz PCM, each with its level (0 to 1). */
  stream(
    stream: MediaStream,
    onFrame: (pcm: Int16Array, level: number) => void,
  ): Promise<LiveStreamerLike>;
  voice: LiveVoiceLike;
  client(): Promise<MockClient>;
  uuid(): string;
  now(): number;
  wait(ms: number): Promise<void>;
}

/** A call refused as `busy` is sent again a second later, this many times. */
const BUSY_TRIES = 5;
/** Reconnecting: at once, then after these waits; then "We couldn't reconnect". */
export const LIVE_RECONNECT_WAITS_MS = [0, 1_000, 2_000, 4_000, 8_000];
/** A connection not ready this long after it opened is given up. */
const READY_TIMEOUT_MS = 10_000;
/** `end` with no `ended` back this long: the call ends it instead. */
const END_TIMEOUT_MS = 5_000;

/**
 * The page's voice detection, for interrupting (§15.5): the level (RMS, 0 to 1) above which a
 * frame counts as speech, higher while the interviewer plays, since some of it leaks into the
 * microphone; and how many frames in a row make the candidate speaking.
 */
export const LIVE_SPEECH_LEVEL = 0.02;
export const LIVE_SPEECH_LEVEL_PLAYING = 0.08;
export const LIVE_SPEECH_FRAMES = 2;

const ANSWERABLE: ReadonlySet<MockLine['kind']> = new Set([
  'question',
  'follow-up',
  'rephrase',
]);

/** A refusal of the relay as the page tells it: the start's codes. */
const REFUSALS: Record<LiveError, ProfileErrorCode> = {
  auth: ProfileErrorCode.SignedOut,
  'app-check': ProfileErrorCode.SignedOut,
  hello: ProfileErrorCode.SignedOut,
  flag: ProfileErrorCode.FlagOff,
  'no-session': ProfileErrorCode.NotFound,
  'session-ended': ProfileErrorCode.MockSessionEnded,
  'way-mismatch': ProfileErrorCode.Invalid,
  replaced: ProfileErrorCode.Unknown,
  quota: ProfileErrorCode.DailyLimit,
  busy: ProfileErrorCode.MockBusy,
  internal: ProfileErrorCode.Unknown,
};

export class LiveInterviewController {
  private state: LiveView = {
    phase: 'idle',
    rephrased: false,
    nothingHeard: false,
    answerTimeWarn: false,
    linesEnded: 0,
  };
  private readonly listeners = new Set<() => void>();
  private onStarted: ((sessionId: string) => void) | null = null;
  private microphone: MediaStream | null = null;
  private streamer: LiveStreamerLike | null = null;
  private socket: LiveSocket | null = null;
  private url: string | null = null;
  private resumeToken: { token: string; at: number } | null = null;
  private seq = 0;
  private pinger: ReturnType<typeof setInterval> | null = null;
  /** Goes up with every connection, so the steps of an older one stop. */
  private connection = 0;
  private startRequestId: string | null = null;
  /** Frames in a row heard as speech while the interviewer speaks. */
  private speechFrames = 0;
  /** The line already interrupted: once each. */
  private interrupted: string | null = null;
  private latestLevel = 0;
  /** When each line came (`now()`), and when the press or the answer's end before it was. */
  private lineCameAt = new Map<number, { lineId: string; at: number }>();
  private askedAt = 0;
  private ending: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  /** "Continue the interview" was pressed: a session left paused goes on once connected. */
  private continuing = false;

  constructor(private readonly deps: LiveDeps) {
    deps.voice.onStarted = (line, at) => this.heardLine(line, at);
  }

  // ---------- For React (useSyncExternalStore) ----------

  whenStarted = (listener: (sessionId: string) => void) => {
    this.onStarted = listener;
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getView = (): LiveView => this.state;

  /** How long the answer has been given, for "Listening · 0:42". */
  listeningMs = (): number =>
    this.state.phase === 'listening' && this.state.listeningSince !== undefined
      ? Math.max(0, this.deps.now() - this.state.listeningSince)
      : 0;

  /** The microphone's level now, 0 to 1, for the meter. */
  level = (): number => this.latestLevel;

  /** Words of an answer have been heard: leaving now loses them. */
  holdsAnswer = (): boolean =>
    this.state.phase === 'listening' && Boolean(this.state.heard);

  private set(change: Partial<LiveView>) {
    this.state = { ...this.state, ...change };
    this.listeners.forEach(listener => listener());
  }

  private clock(timeLeftMs: number | undefined) {
    if (timeLeftMs !== undefined && Number.isFinite(timeLeftMs)) {
      this.set({ timeLeft: { ms: timeLeftMs, at: this.deps.now() } });
    }
  }

  // ---------- Starting and continuing ----------

  /** "Start the interview": called in the press itself, so the browser lets the voice play. */
  async start(setup: MockSetup): Promise<void> {
    const unlocked = this.deps.voice.unlock();
    this.askedAt = this.deps.now();
    if (!(await this.openMicrophone())) {
      return;
    }
    await unlocked;
    const client = await this.deps.client().catch(() => undefined);
    this.set({ phase: 'starting', startFailure: undefined });
    this.startRequestId ??= this.deps.uuid();
    let result: Awaited<ReturnType<LiveDeps['gateway']['startMockInterview']>>;
    try {
      // The voice model speaks in its own voice: none is sent.
      const { voice, ...rest } = setup;
      result = await this.busyRetry(() =>
        this.deps.gateway.startMockInterview({
          requestId: this.startRequestId!,
          ...rest,
          ...(setup.way === 'voice-model' || !voice ? {} : { voice }),
          ...(client ? { client } : {}),
        }),
      );
    } catch (error) {
      this.set({ phase: 'idle', startFailure: getProfileErrorCode(error) });
      return;
    }
    this.startRequestId = null;
    this.set({ sessionId: result.sessionId });
    this.onStarted?.(result.sessionId);
    this.clock(result.timeLeftMs);
    if (!result.connect) {
      this.set({ phase: 'idle', startFailure: ProfileErrorCode.Unknown });
      return;
    }
    this.url = result.connect.url;
    await this.connect();
  }

  /**
   * "Continue the interview" after a reload: the call says where the relay is (it says nothing
   * itself), then the relay says the line waiting again.
   */
  async resume(sessionId: string): Promise<void> {
    const unlocked = this.deps.voice.unlock();
    this.askedAt = this.deps.now();
    this.set({ sessionId });
    if (!(await this.openMicrophone())) {
      return;
    }
    await unlocked;
    this.set({ phase: 'starting', startFailure: undefined });
    this.continuing = true;
    try {
      const { connect, timeLeftMs } = await this.busyRetry(() =>
        this.deps.gateway.resumeMockInterview(sessionId),
      );
      this.clock(timeLeftMs);
      this.url = connect?.url ?? null;
    } catch (error) {
      if (getProfileErrorCode(error) === ProfileErrorCode.MockSessionEnded) {
        this.finish();
        return;
      }
      this.set({ phase: 'idle', startFailure: getProfileErrorCode(error) });
      return;
    }
    if (!this.url) {
      this.set({ phase: 'idle', startFailure: ProfileErrorCode.Unknown });
      return;
    }
    await this.connect();
  }

  private async openMicrophone(): Promise<boolean> {
    if (
      this.microphone
        ?.getAudioTracks()
        .some(track => track.readyState === 'live')
    ) {
      return true;
    }
    this.set({ phase: 'mic-asking', startFailure: undefined });
    try {
      this.microphone = await this.deps.openMicrophone();
      this.streamer = await this.deps.stream(this.microphone, (pcm, level) =>
        this.frame(pcm, level),
      );
    } catch (error) {
      const failure = microphoneFailureOf(error);
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
    return true;
  }

  // ---------- The connection ----------

  /**
   * Connects, at once and then after each wait of LIVE_RECONNECT_WAITS_MS, until the relay is
   * ready; then "We couldn't reconnect".
   */
  private async connect(reconnecting = false): Promise<void> {
    const generation = ++this.connection;
    this.set({ phase: reconnecting ? 'reconnecting' : 'connecting' });
    for (const waitMs of reconnecting ? LIVE_RECONNECT_WAITS_MS : [0]) {
      if (waitMs > 0) {
        await this.deps.wait(waitMs);
      }
      if (generation !== this.connection || this.disposed) {
        return;
      }
      const outcome = await this.open(generation);
      if (outcome === 'ready' || outcome === 'settled') {
        return;
      }
    }
    if (generation === this.connection) {
      this.set({ phase: 'disconnected' });
    }
  }

  /** One connection: `ready`, settled by the relay (ended, refused, replaced), or dropped. */
  private open(generation: number): Promise<'ready' | 'settled' | 'dropped'> {
    const sessionId = this.state.sessionId;
    if (!sessionId || !this.url) {
      return Promise.resolve('settled');
    }
    return new Promise(resolve => {
      let settled = false;
      const outcome = (result: 'ready' | 'settled' | 'dropped') => {
        if (!settled) {
          settled = true;
          resolve(result);
        }
      };
      let socket: LiveSocket;
      try {
        socket = this.deps.gateway.openLiveSocket(this.url!);
      } catch {
        outcome('dropped');
        return;
      }
      this.closeSocket();
      this.socket = socket;
      const giveUp = setTimeout(() => {
        if (this.socket === socket) {
          this.closeSocket();
        }
        outcome('dropped');
      }, READY_TIMEOUT_MS);
      socket.onopen = () => {
        void this.hello(socket, sessionId).catch(() => {
          // No tokens: the relay would refuse; the page says it can't continue.
          clearTimeout(giveUp);
          this.closeSocket();
          this.set({ phase: 'idle', startFailure: ProfileErrorCode.SignedOut });
          outcome('settled');
        });
      };
      socket.onmessage = data => {
        if (this.socket !== socket || generation !== this.connection) {
          return;
        }
        if (typeof data !== 'string') {
          this.voiceFrame(data);
          return;
        }
        const message = parseRelayMessage(data);
        if (!message) {
          return;
        }
        if (message.type === 'ready') {
          clearTimeout(giveUp);
          outcome('ready');
        }
        const settles = this.message(message);
        if (settles) {
          clearTimeout(giveUp);
          outcome('settled');
        }
      };
      socket.onclose = () => {
        clearTimeout(giveUp);
        if (this.socket !== socket) {
          outcome('settled');
          return;
        }
        this.socket = null;
        this.stopPinging();
        this.dropVoice();
        if (!settled) {
          outcome('dropped');
          return;
        }
        // Ready, then dropped: the interview carries on once back.
        if (generation === this.connection && this.live()) {
          void this.connect(true);
        }
      };
    });
  }

  private async hello(socket: LiveSocket, sessionId: string) {
    const tokens = await this.deps.gateway.getLiveTokens();
    const client = await this.deps.client().catch(() => undefined);
    const resume =
      this.resumeToken &&
      this.deps.now() - this.resumeToken.at < RESUME_TOKEN_MS
        ? { resumeToken: this.resumeToken.token }
        : {};
    const hello: LiveHello = {
      type: 'hello',
      version: LIVE_PROTOCOL_VERSION,
      sessionId,
      ...tokens,
      ...resume,
      ...(client ? { client } : {}),
    };
    socket.send(JSON.stringify(hello));
  }

  /** The interview is going on: a drop is reconnected. */
  private live(): boolean {
    return (
      this.state.phase !== 'ended' &&
      this.state.phase !== 'replaced' &&
      this.state.phase !== 'idle' &&
      !this.disposed
    );
  }

  private send(message: LivePageMessage) {
    this.socket?.send(JSON.stringify(message));
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    this.stopPinging();
    if (socket) {
      socket.onmessage = null;
      socket.onclose = null;
      socket.close();
    }
  }

  private stopPinging() {
    if (this.pinger) {
      clearInterval(this.pinger);
      this.pinger = null;
    }
  }

  /** What the relay says. Returns whether it settles the connection (ended, refused, replaced). */
  private message(message: LiveRelayMessage): boolean {
    switch (message.type) {
      case 'ready':
        this.resumeToken = { token: message.resumeToken, at: this.deps.now() };
        this.clock(message.timeLeftMs);
        this.stopPinging();
        this.pinger = setInterval(
          () => this.send({ type: 'ping', t: Date.now() }),
          LIVE_PING_MS,
        );
        if (message.paused && this.continuing) {
          // Left paused (the page closed or reloaded with the tab hidden): the press to continue
          // goes on, and the relay says the question again.
          this.send({ type: 'pause', id: this.deps.uuid(), paused: false });
        }
        this.set({
          phase: message.paused && !this.continuing ? 'paused' : 'thinking',
          startFailure: undefined,
          way: message.way,
        });
        this.continuing = false;
        return false;
      case 'line':
        this.line(message);
        return false;
      case 'lineEnd':
        this.lineEnd(message);
        return false;
      case 'state':
        this.clock(message.timeLeftMs);
        this.relayState(message.state);
        return false;
      case 'heard':
        if (message.turnId === this.state.question?.turnId) {
          this.set({
            heard: message.text,
            ...(message.text ? { nothingHeard: false } : {}),
          });
        }
        return false;
      case 'answerEnd':
        this.set({
          answered: message.turnId,
          answerEndedMs: this.listeningMs(),
          answerTimeWarn: false,
          nothingHeard: false,
        });
        this.askedAt = this.deps.now();
        return false;
      case 'notice':
        this.set(
          message.kind === 'answer-time'
            ? { answerTimeWarn: true }
            : { nothingHeard: true },
        );
        return false;
      case 'interrupted':
        this.interrupted = message.lineId;
        this.deps.voice.stop(lineNumber(message.lineId));
        return false;
      case 'ended':
        this.finish(message.endReason);
        return true;
      case 'reconnect':
        // The relay is going away: at once, with the token, so an answer being given carries on.
        this.resumeToken = { token: message.resumeToken, at: this.deps.now() };
        this.closeSocket();
        void this.connect(true);
        return true;
      case 'error':
        return this.refused(message.reason, message.retry);
      case 'pong':
        return false;
    }
  }

  private refused(reason: LiveError, retry: boolean): boolean {
    switch (reason) {
      case 'replaced':
        this.closeSocket();
        this.dropVoice();
        this.set({ phase: 'replaced' });
        return true;
      case 'session-ended':
        // The page reads why from the session.
        this.finish();
        return true;
      case 'quota':
        this.finish('quota');
        return true;
      default:
        if (retry) {
          this.closeSocket();
          void this.connect(true);
          return true;
        }
        this.closeSocket();
        this.dropVoice();
        this.set({ phase: 'idle', startFailure: REFUSALS[reason] });
        return true;
    }
  }

  // ---------- The interviewer speaks ----------

  private line(message: Extract<LiveRelayMessage, { type: 'line' }>) {
    const line: MockQuestion = {
      lineId: message.lineId,
      ...(message.turnId ? { turnId: message.turnId } : {}),
      text: message.text,
      kind: message.kind,
    };
    this.lineCameAt.set(lineNumber(message.lineId), {
      lineId: message.lineId,
      at: this.deps.now(),
    });
    this.interrupted = null;
    this.speechFrames = 0;
    // The voice model's opening asks the first question too, and its later lines say only
    // "question": the line with a turn is the one to answer.
    const asks =
      ANSWERABLE.has(message.kind) ||
      (this.state.way === 'voice-model' && Boolean(message.turnId));
    const newQuestion = asks && message.turnId !== this.state.question?.turnId;
    this.set({
      speaking: line,
      ...(asks
        ? {
            question: line,
            rephrased:
              message.kind === 'rephrase' ||
              (!newQuestion && this.state.rephrased),
            heard: undefined,
            nothingHeard: false,
          }
        : {}),
    });
  }

  private lineEnd(message: Extract<LiveRelayMessage, { type: 'lineEnd' }>) {
    // The voice model's words come only now; cut off within its first word, none come.
    const { speaking, question } = this.state;
    this.set({
      linesEnded: this.state.linesEnded + 1,
      ...(!message.text && this.interrupted === message.lineId
        ? { cutOffLine: message.lineId }
        : {}),
      ...(speaking?.lineId === message.lineId
        ? { speaking: { ...speaking, text: message.text } }
        : {}),
      ...(question?.lineId === message.lineId
        ? { question: { ...question, text: message.text } }
        : {}),
    });
  }

  private voiceFrame(data: ArrayBuffer) {
    const frame = decodeVoiceFrame(data);
    if (
      !frame ||
      this.state.phase === 'paused' ||
      this.interrupted === `l${frame.line}`
    ) {
      return;
    }
    this.deps.voice.push(frame.line, frame.samples);
  }

  /** A line's first sound: measured, and told to the relay (§13.5). */
  private heardLine(line: number, at: number) {
    const came = this.lineCameAt.get(line);
    if (!came) {
      return;
    }
    this.lineCameAt.delete(line);
    this.send({
      type: 'played',
      played: [
        {
          lineId: came.lineId,
          firstSoundMs: Math.max(0, Math.round(at - this.askedAt)),
          startMs: Math.max(0, Math.round(at - came.at)),
        },
      ],
    });
  }

  private relayState(
    state: Extract<LiveRelayMessage, { type: 'state' }>['state'],
  ) {
    // The voice model gives no `answerEnd`: the answer ended when it speaks or thinks again.
    if (
      this.state.way === 'voice-model' &&
      this.state.phase === 'listening' &&
      (state === 'speaking' || state === 'thinking')
    ) {
      this.set({
        answered: this.state.question?.turnId,
        answeredLine: this.state.question?.lineId,
        answerEndedMs: this.listeningMs(),
        nothingHeard: false,
      });
    }
    switch (state) {
      case 'speaking':
        this.set({ phase: 'speaking' });
        return;
      case 'listening':
        this.speechFrames = 0;
        this.set({
          phase: 'listening',
          listeningSince: this.deps.now(),
          answered: undefined,
          answerEndedMs: undefined,
          answerTimeWarn: false,
          nothingHeard: false,
        });
        return;
      case 'thinking':
        this.set({ phase: 'thinking' });
        return;
      case 'paused':
        this.dropVoice();
        this.set({ phase: 'paused' });
        return;
      case 'ended':
        // `ended` with its reason follows.
        return;
    }
  }

  // ---------- The microphone ----------

  private frame(pcm: Int16Array, level: number) {
    this.latestLevel = level;
    const { phase } = this.state;
    if (!this.socket || phase === 'paused' || phase === 'ended') {
      return;
    }
    this.socket.send(encodeMicFrame(this.seq, pcm));
    this.seq = (this.seq + 1) >>> 0;
    if (phase === 'speaking') {
      this.listenForInterruption(level);
    }
  }

  /** The candidate speaking over the interviewer stops it (§15.5): the answer starts. */
  private listenForInterruption(level: number) {
    const threshold = this.deps.voice.playing()
      ? LIVE_SPEECH_LEVEL_PLAYING
      : LIVE_SPEECH_LEVEL;
    this.speechFrames = level >= threshold ? this.speechFrames + 1 : 0;
    if (this.speechFrames >= LIVE_SPEECH_FRAMES) {
      this.speechFrames = 0;
      this.interrupt();
    }
  }

  private interrupt() {
    const speaking = this.state.speaking;
    if (
      this.state.phase !== 'speaking' ||
      !speaking ||
      speaking.kind === 'closing' ||
      this.interrupted === speaking.lineId
    ) {
      return;
    }
    this.interrupted = speaking.lineId;
    const atMs = Math.round(this.deps.voice.stop(lineNumber(speaking.lineId)));
    this.send({
      type: 'interrupt',
      id: this.deps.uuid(),
      lineId: speaking.lineId,
      atMs: Math.max(0, Math.min(600_000, atMs)),
    });
  }

  // ---------- The candidate's actions ----------

  /** "Stop and answer now": the line stops, and the answer starts. */
  stopAndAnswer() {
    this.interrupt();
  }

  /** "I'm done": the answer ends now. */
  done() {
    const question = this.state.question;
    if (this.state.phase !== 'listening' || !question) {
      return;
    }
    this.askedAt = this.deps.now();
    this.send({ type: 'done', id: this.deps.uuid(), lineId: question.lineId });
  }

  /** "Say it differently": the other wording, then the answer starts again. */
  sayDifferently() {
    const question = this.state.question;
    if (this.state.rephrased || !question) {
      return;
    }
    this.askedAt = this.deps.now();
    this.send({
      type: 'rephrase',
      id: this.deps.uuid(),
      lineId: question.lineId,
    });
  }

  /** Skip: the next question, or the closing. */
  skip() {
    const question = this.state.question;
    if (!question) {
      return;
    }
    this.askedAt = this.deps.now();
    this.send({ type: 'skip', id: this.deps.uuid(), lineId: question.lineId });
  }

  // ---------- Paused ----------

  /** Pause, or the tab was left: the voice stops, and the relay stops the clock. */
  pause() {
    const { phase } = this.state;
    if (phase !== 'speaking' && phase !== 'listening' && phase !== 'thinking') {
      return;
    }
    this.dropVoice();
    const at = this.deps.now();
    const left = this.state.timeLeft
      ? this.state.timeLeft.ms - (at - this.state.timeLeft.at)
      : undefined;
    this.set({
      phase: 'paused',
      ...(left === undefined ? {} : { timeLeft: { ms: left, at } }),
    });
    this.send({ type: 'pause', id: this.deps.uuid(), paused: true });
  }

  /** Back from the pause: the relay says the question again, and the answer starts after it. */
  hearAgain() {
    if (this.state.phase !== 'paused') {
      return;
    }
    this.askedAt = this.deps.now();
    void this.deps.voice.unlock();
    this.send({ type: 'pause', id: this.deps.uuid(), paused: false });
  }

  // ---------- The connection lost, or taken elsewhere ----------

  /** "Try again" after it couldn't reconnect, or "Continue here" once taken elsewhere. */
  async reconnect(): Promise<void> {
    void this.deps.voice.unlock();
    if (!(await this.openMicrophone())) {
      return;
    }
    await this.connect(true);
  }

  // ---------- The end ----------

  /** "End interview": the relay ends it; without a connection, the call does. */
  async end(): Promise<void> {
    this.dropVoice();
    if (this.socket && this.state.phase !== 'connecting') {
      this.send({ type: 'end', id: this.deps.uuid() });
      this.ending = setTimeout(() => void this.endByCall(), END_TIMEOUT_MS);
      return;
    }
    await this.endByCall();
  }

  private async endByCall() {
    const sessionId = this.state.sessionId;
    ++this.connection;
    this.closeSocket();
    if (sessionId) {
      try {
        await this.deps.gateway.endMockInterview(sessionId);
      } catch {
        // The backend ends an idle session by itself.
      }
    }
    this.finish('ended');
  }

  private finish(reason?: MockEndReason) {
    if (this.ending) {
      clearTimeout(this.ending);
      this.ending = null;
    }
    ++this.connection;
    this.closeSocket();
    this.dropVoice();
    this.releaseMicrophone();
    this.set({
      phase: 'ended',
      endReason: reason,
      speaking: undefined,
    });
  }

  private dropVoice() {
    const speaking = this.state.speaking;
    if (speaking) {
      this.deps.voice.stop(lineNumber(speaking.lineId));
    }
  }

  private releaseMicrophone() {
    this.streamer?.stop();
    this.streamer = null;
    this.microphone?.getTracks().forEach(track => track.stop());
    this.microphone = null;
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

  /**
   * The page closed: the connection closes (the relay stops the clock), and nothing keeps playing
   * or holding the microphone. It can be used again after (React may mount a page twice).
   */
  dispose() {
    ++this.connection;
    this.closeSocket();
    this.dropVoice();
    this.releaseMicrophone();
    this.deps.voice.close();
  }
}
