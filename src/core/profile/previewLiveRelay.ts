// The preview gateway's stand-in for the `live-assist` relay (D100, research doc 24 §15.7): a
// mock interview in real time with no backend, as the relay's own offline fakes behave. Each line
// is voiced as a short tone; a frame of the microphone with any sound is speech; "heard" says how
// long the answer has gone every second of speech; 1.5 seconds of silence after speech, or "I'm
// done", ends the answer; the preview's interviewer says what comes next. Test and preview only.
import {
  type MockLine,
  type MockLines,
  type MockSession,
} from './mockInterviews';

import {
  FRAME_HEADER_BYTES,
  FRAME_KINDS,
  FRAME_VERSION,
  LIVE_OUTPUT,
  type LiveError,
  type LivePageMessage,
  type LiveRelayMessage,
  type LiveSocket,
  lineNumber,
} from '@/core/mock/liveProtocol';

/** How long a voiced line lasts, and the relay's wait after its audio before listening. */
export const PREVIEW_LIVE_LINE_MS = 500;
const PLAYBACK_GRACE_MS = 250;
/** Silence after speech that ends an answer, as the relay's fakes. */
export const PREVIEW_LIVE_PAUSE_MS = 1_500;
/** The interviewer thinking after an answer. */
export const PREVIEW_LIVE_THINKING_MS = 800;
/** A frame this loud (RMS) is speech. */
const SPEECH_LEVEL = 0.01;
const FRAME_MS = 100;
const ANSWER_NOTICE_MS = 150_000;
const ANSWER_MAX_MS = 180_000;

/** The preview gateway's sessions, as the relay works on them. */
export interface PreviewRelayStore {
  /** The session for `hello`, active and real-time, or why not. Its clock goes on again. */
  attach(sessionId: string): MockSession | LiveError;
  /** The opening and the first question, the first time; else the line waiting, said again. */
  firstLines(session: MockSession): MockLine[];
  againLine(session: MockSession): MockLine;
  answer(session: MockSession, transcript: string, spokenMs: number): MockLines;
  skip(session: MockSession): MockLines;
  rephrase(session: MockSession): MockLine;
  pause(session: MockSession, paused: boolean): void;
  end(session: MockSession): void;
  timeLeft(session: MockSession): number;
  /** The connection closed without `end`: the clock stops until the next `hello`. */
  detach(session: MockSession): void;
}

let tone: Int16Array | null = null;

/** A line's voice: a quiet 440 Hz tone at 24 kHz. */
const toneSamples = (): Int16Array => {
  if (!tone) {
    const count = (LIVE_OUTPUT.sampleRate * PREVIEW_LIVE_LINE_MS) / 1_000;
    tone = new Int16Array(count);
    for (let index = 0; index < count; index += 1) {
      tone[index] = Math.round(
        Math.sin((2 * Math.PI * 440 * index) / LIVE_OUTPUT.sampleRate) *
          0.2 *
          0x7fff,
      );
    }
  }
  return tone;
};

const voiceFrame = (
  line: number,
  seq: number,
  pcm: Int16Array,
): ArrayBuffer => {
  const bytes = new ArrayBuffer(FRAME_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(bytes);
  view.setUint8(0, FRAME_VERSION);
  view.setUint8(1, FRAME_KINDS.voice);
  view.setUint16(2, line, true);
  view.setUint32(4, seq, true);
  pcm.forEach((sample, index) =>
    view.setInt16(FRAME_HEADER_BYTES + index * 2, sample, true),
  );
  return bytes;
};

/** A microphone frame's level, or `undefined` when it isn't one. */
const micLevel = (data: ArrayBuffer): number | undefined => {
  const view = new DataView(data);
  if (
    data.byteLength <= FRAME_HEADER_BYTES ||
    view.getUint8(0) !== FRAME_VERSION ||
    view.getUint8(1) !== FRAME_KINDS.mic
  ) {
    return undefined;
  }
  const count = (data.byteLength - FRAME_HEADER_BYTES) / 2;
  let squares = 0;
  for (let index = 0; index < count; index += 1) {
    const value = view.getInt16(FRAME_HEADER_BYTES + index * 2, true) / 0x8000;
    squares += value * value;
  }
  return Math.sqrt(squares / count);
};

interface Answer {
  turnId: string;
  lineId: string;
  speechFrames: number;
  silentFrames: number;
  timers: ReturnType<typeof setTimeout>[];
}

export class PreviewLiveRelay implements LiveSocket {
  onopen: (() => void) | null = null;
  onmessage: ((data: string | ArrayBuffer) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;

  private session: MockSession | null = null;
  private closed = false;
  private ended = false;
  private phase: 'speaking' | 'listening' | 'thinking' | 'paused' | 'idle' =
    'idle';
  private speaking: MockLine | null = null;
  private lastLines: MockLine[] = [];
  private answer: Answer | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private readonly done = new Set<string>();

  constructor(
    private readonly store: PreviewRelayStore,
    /** Refuses the connection before `ready`, as a relay that can't be reached. */
    private readonly fails = false,
  ) {
    setTimeout(() => {
      if (this.closed) {
        return;
      }
      if (this.fails) {
        this.drop();
        return;
      }
      this.onopen?.();
    }, 0);
  }

  // ---------- The socket ----------

  send(data: string | ArrayBuffer) {
    if (this.closed) {
      return;
    }
    if (typeof data !== 'string') {
      const level = micLevel(data);
      if (level !== undefined) {
        this.hear(level);
      }
      return;
    }
    const message = JSON.parse(data) as
      LivePageMessage | { type: 'hello'; sessionId: string };
    if (message.type === 'hello') {
      this.hello(message.sessionId);
      return;
    }
    this.onPage(message);
  }

  /** The page closed it. */
  close() {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.stopTimers();
    if (this.session && !this.ended) {
      this.store.detach(this.session);
    }
  }

  /** The connection dropped (the controls): as the network failing, the page isn't told why. */
  drop() {
    if (this.closed) {
      return;
    }
    this.close();
    this.onclose?.({ code: 1006 });
  }

  /** Taken over elsewhere (the controls). */
  replace() {
    this.error('replaced', false);
  }

  private emit(message: LiveRelayMessage) {
    if (!this.closed) {
      this.onmessage?.(JSON.stringify(message));
    }
  }

  private error(reason: LiveError, retry: boolean) {
    this.emit({ type: 'error', reason, retry });
    this.close();
    this.onclose?.({ code: 1008 });
  }

  private later(work: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers = this.timers.filter(known => known !== timer);
      if (!this.closed) {
        work();
      }
    }, ms);
    this.timers.push(timer);
  }

  private stopTimers() {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers = [];
    this.answer?.timers.forEach(timer => clearTimeout(timer));
  }

  // ---------- Connecting ----------

  private hello(sessionId: string) {
    const attached = this.store.attach(sessionId);
    if (typeof attached === 'string') {
      this.error(attached, false);
      return;
    }
    this.session = attached;
    this.emit({
      type: 'ready',
      sessionId,
      way: attached.way,
      resumeToken: `preview-${sessionId}`,
      timeLeftMs: this.store.timeLeft(attached),
      paused: false,
    });
    this.say(this.store.firstLines(attached));
  }

  // ---------- Speaking ----------

  private state(state: 'speaking' | 'listening' | 'thinking' | 'paused') {
    this.phase = state;
    this.emit({
      type: 'state',
      state,
      ...(this.session
        ? { timeLeftMs: this.store.timeLeft(this.session) }
        : {}),
    });
  }

  private say(lines: MockLine[]) {
    this.stopTimers();
    this.answer = null;
    this.lastLines = lines;
    this.state('speaking');
    const pcm = toneSamples();
    const frameSamples = (LIVE_OUTPUT.sampleRate * FRAME_MS) / 1_000;
    lines.forEach((line, index) => {
      this.later(() => {
        this.speaking = line;
        this.emit({
          type: 'line',
          lineId: line.lineId,
          kind: line.kind,
          ...(line.turnId ? { turnId: line.turnId } : {}),
          text: line.text,
        });
        for (
          let at = 0, seq = 0;
          at < pcm.length;
          at += frameSamples, seq += 1
        ) {
          this.onmessage?.(
            voiceFrame(
              lineNumber(line.lineId),
              seq,
              pcm.subarray(at, at + frameSamples),
            ),
          );
        }
        this.emit({
          type: 'lineEnd',
          lineId: line.lineId,
          text: line.text,
          durationMs: PREVIEW_LIVE_LINE_MS,
        });
      }, index * PREVIEW_LIVE_LINE_MS);
    });
    this.later(
      () => this.afterLines(),
      lines.length * PREVIEW_LIVE_LINE_MS + PLAYBACK_GRACE_MS,
    );
  }

  private afterLines() {
    const last = this.lastLines.at(-1);
    this.speaking = null;
    if (!last || last.kind === 'closing') {
      this.closeSession('finished');
      return;
    }
    this.listen(last);
  }

  // ---------- Listening ----------

  private listen(line: MockLine) {
    if (!line.turnId) {
      return;
    }
    this.stopTimers();
    this.state('listening');
    const answer: Answer = {
      turnId: line.turnId,
      lineId: line.lineId,
      speechFrames: 0,
      silentFrames: 0,
      timers: [],
    };
    this.answer = answer;
    answer.timers.push(
      setTimeout(() => {
        if (this.answer === answer) {
          this.emit({ type: 'notice', kind: 'answer-time', leftMs: 30_000 });
        }
      }, ANSWER_NOTICE_MS),
      setTimeout(() => {
        if (this.answer === answer) {
          this.finish('time');
        }
      }, ANSWER_MAX_MS),
    );
  }

  private hear(level: number) {
    const answer = this.answer;
    if (this.phase !== 'listening' || !answer) {
      return;
    }
    if (level >= SPEECH_LEVEL) {
      answer.speechFrames += 1;
      answer.silentFrames = 0;
      if (answer.speechFrames % 10 === 0) {
        this.emit({
          type: 'heard',
          turnId: answer.turnId,
          text: this.transcript(answer),
          final: false,
        });
      }
      return;
    }
    if (answer.speechFrames === 0) {
      return;
    }
    answer.silentFrames += 1;
    if (answer.silentFrames * FRAME_MS >= PREVIEW_LIVE_PAUSE_MS) {
      this.finish('pause');
    }
  }

  private transcript(answer: Answer) {
    const seconds = Math.max(
      1,
      Math.round((answer.speechFrames * FRAME_MS) / 1_000),
    );
    return `I answered for about ${seconds} seconds.`;
  }

  private finish(reason: 'pause' | 'done' | 'time') {
    const answer = this.answer;
    const session = this.session;
    if (!answer || !session || this.phase !== 'listening') {
      return;
    }
    if (answer.speechFrames === 0) {
      if (reason === 'done') {
        this.emit({ type: 'notice', kind: 'nothing-heard' });
        return;
      }
      this.answer = null;
      this.say(this.store.skip(session).lines);
      return;
    }
    answer.timers.forEach(timer => clearTimeout(timer));
    this.answer = null;
    const transcript = this.transcript(answer);
    this.emit({ type: 'answerEnd', turnId: answer.turnId, reason });
    this.emit({
      type: 'heard',
      turnId: answer.turnId,
      text: transcript,
      final: true,
    });
    this.state('thinking');
    this.later(() => {
      const next = this.store.answer(
        session,
        transcript,
        answer.speechFrames * FRAME_MS,
      );
      this.say(next.lines);
    }, PREVIEW_LIVE_THINKING_MS);
  }

  // ---------- The page's actions ----------

  private onPage(message: LivePageMessage) {
    const session = this.session;
    if (!session || message.type === 'played' || message.type === 'ping') {
      if (message.type === 'ping') {
        this.emit({ type: 'pong', t: message.t });
      }
      return;
    }
    if (this.done.has(message.id)) {
      return;
    }
    this.done.add(message.id);
    switch (message.type) {
      case 'interrupt': {
        const speaking = this.speaking;
        if (this.phase !== 'speaking' || speaking?.lineId !== message.lineId) {
          return;
        }
        this.stopTimers();
        this.speaking = null;
        if (speaking.kind === 'opening') {
          this.say([this.store.againLine(session)]);
          return;
        }
        this.listen(speaking);
        return;
      }
      case 'done':
        if (this.answer?.lineId === message.lineId) {
          this.finish('done');
        }
        return;
      case 'rephrase':
        this.say([this.store.rephrase(session)]);
        return;
      case 'skip':
        this.say(this.store.skip(session).lines);
        return;
      case 'pause':
        this.store.pause(session, message.paused);
        if (message.paused) {
          this.stopTimers();
          this.answer = null;
          this.state('paused');
        } else if (this.phase === 'paused') {
          this.say([this.store.againLine(session)]);
        }
        return;
      case 'end':
        this.store.end(session);
        this.closeSession('ended');
        return;
    }
  }

  private closeSession(reason: 'finished' | 'ended') {
    this.ended = true;
    this.stopTimers();
    this.emit({ type: 'ended', endReason: reason });
    this.close();
    this.onclose?.({ code: 1000 });
  }
}
