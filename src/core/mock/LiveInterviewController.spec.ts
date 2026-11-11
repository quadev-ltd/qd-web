import {
  type LiveDeps,
  LiveInterviewController,
  LIVE_RECONNECT_WAITS_MS,
  LIVE_SPEECH_LEVEL,
  LIVE_SPEECH_LEVEL_PLAYING,
  type LiveVoiceLike,
} from './LiveInterviewController';
import {
  FRAME_HEADER_BYTES,
  type LiveRelayMessage,
  type LiveSocket,
} from './liveProtocol';

import { MicrophoneError } from '@/core/audio/recording';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';

const SETUP = {
  hints: 'on-request' as const,
  applicationId: 'a1',
  interviewId: 'i1',
  way: 'real-time' as const,
  lengthMinutes: 10 as const,
  voice: 'gemini' as const,
};

/** The relay's side of one connection, driven by the spec. */
class FakeSocket implements LiveSocket {
  onopen: (() => void) | null = null;
  onmessage: ((data: string | ArrayBuffer) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readonly sent: (string | ArrayBuffer)[] = [];
  closed = false;

  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
  }

  /** The JSON messages the page sent, parsed. */
  messages(): Record<string, unknown>[] {
    return this.sent
      .filter((data): data is string => typeof data === 'string')
      .map(data => JSON.parse(data) as Record<string, unknown>);
  }

  frames(): ArrayBuffer[] {
    return this.sent.filter(
      (data): data is ArrayBuffer => typeof data !== 'string',
    );
  }

  relay(message: LiveRelayMessage) {
    this.onmessage?.(JSON.stringify(message));
  }

  voice(line: number, samples: number[]) {
    const bytes = new ArrayBuffer(FRAME_HEADER_BYTES + samples.length * 2);
    const view = new DataView(bytes);
    view.setUint8(0, 1);
    view.setUint8(1, 2);
    view.setUint16(2, line, true);
    samples.forEach((sample, index) =>
      view.setInt16(FRAME_HEADER_BYTES + index * 2, sample, true),
    );
    this.onmessage?.(bytes);
  }

  drop() {
    this.onclose?.({ code: 1006 });
  }
}

const READY: LiveRelayMessage = {
  type: 'ready',
  sessionId: 's1',
  way: 'real-time',
  resumeToken: 'resume-1',
  timeLeftMs: 600_000,
  paused: false,
};

const fakeVoice = () => {
  const voice: LiveVoiceLike & {
    pushed: { line: number; samples: Float32Array }[];
    stopped: number[];
    isPlaying: boolean;
  } = {
    pushed: [],
    stopped: [],
    isPlaying: false,
    onStarted: null,
    unlock: vi.fn(() => Promise.resolve(true)),
    push(line, samples) {
      this.pushed.push({ line, samples });
    },
    stop(line) {
      this.stopped.push(line);
      return 1_234.4;
    },
    playing() {
      return this.isPlaying;
    },
    close: vi.fn(),
  };
  return voice;
};

const setUp = (overrides: Partial<LiveDeps> = {}) => {
  let clock = 1_000;
  let ids = 0;
  const gateway = createMockProfileGateway();
  gateway.startMockInterview.mockResolvedValue({
    sessionId: 's1',
    lines: [],
    status: 'active',
    timeLeftMs: 600_000,
    connect: { url: 'wss://relay.example' },
  });
  gateway.resumeMockInterview.mockResolvedValue({
    lines: [],
    status: 'active',
    paused: false,
    timeLeftMs: 420_000,
    connect: { url: 'wss://relay.example' },
  });
  const sockets: FakeSocket[] = [];
  gateway.openLiveSocket.mockImplementation(() => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
  const track = { readyState: 'live', stop: vi.fn() };
  const microphone = {
    getAudioTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  let onFrame: ((pcm: Int16Array, level: number) => void) | null = null;
  const streamer = { stop: vi.fn() };
  const voice = fakeVoice();
  const deps: LiveDeps = {
    gateway,
    openMicrophone: vi.fn(() => Promise.resolve(microphone)),
    stream: vi.fn((_, frame) => {
      onFrame = frame;
      return Promise.resolve(streamer);
    }),
    voice,
    client: () =>
      Promise.resolve({ browser: 'Chrome 142', os: 'macOS', headphones: 'no' }),
    uuid: () => `id-${(ids += 1)}`,
    now: () => clock,
    wait: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const controller = new LiveInterviewController(deps);
  const latest = () => sockets.at(-1)!;
  return {
    controller,
    gateway,
    deps,
    voice,
    sockets,
    latest,
    track,
    streamer,
    pass: (ms: number) => {
      clock += ms;
    },
    /** A frame of the microphone at this level. */
    speak: (level: number) => onFrame?.(new Int16Array(1_600), level),
    /** Opened, said hello, and ready. */
    connected: async () => {
      await vi.waitFor(() => expect(sockets.length).toBeGreaterThan(0));
      latest().onopen?.();
      await vi.waitFor(() =>
        expect(
          latest()
            .messages()
            .some(({ type }) => type === 'hello'),
        ).toBe(true),
      );
      latest().relay(READY);
    },
  };
};

/** The relay says a line, its voice, then "listening". */
const ask = (
  socket: FakeSocket,
  lineId: string,
  kind: 'opening' | 'question' | 'follow-up' | 'rephrase' | 'closing',
  text: string,
  turnId?: string,
) => {
  socket.relay({ type: 'state', state: 'speaking', timeLeftMs: 590_000 });
  socket.relay({
    type: 'line',
    lineId,
    kind,
    ...(turnId ? { turnId } : {}),
    text,
  });
  socket.voice(Number(lineId.slice(1)), [0, 16_384, -16_384]);
  socket.relay({ type: 'lineEnd', lineId, text, durationMs: 500 });
};

describe('LiveInterviewController: starting (D100, doc 24 §15.2)', () => {
  it('starts the session, connects to where the call says, and says hello with the tokens', async () => {
    const { controller, gateway, latest, connected } = setUp();
    const started = vi.fn();
    controller.whenStarted(started);

    const starting = controller.start(SETUP);
    await connected();
    await starting;

    expect(gateway.startMockInterview).toHaveBeenCalledWith(
      expect.objectContaining({ way: 'real-time', requestId: 'id-1' }),
    );
    expect(started).toHaveBeenCalledWith('s1');
    expect(gateway.openLiveSocket).toHaveBeenCalledWith('wss://relay.example');
    expect(latest().messages()[0]).toEqual({
      type: 'hello',
      version: 1,
      sessionId: 's1',
      idToken: 'id-token',
      appCheckToken: 'app-check-token',
      client: { browser: 'Chrome 142', os: 'macOS', headphones: 'no' },
    });
    expect(controller.getView()).toMatchObject({
      phase: 'thinking',
      sessionId: 's1',
      timeLeft: { ms: 600_000 },
    });
  });

  it('says why the microphone can’t be used', async () => {
    const { controller } = setUp({
      openMicrophone: () => Promise.reject(new MicrophoneError('refused')),
    });
    await controller.start(SETUP);
    expect(controller.getView().phase).toBe('mic-refused');
  });

  it('a refused start says why, and connects nowhere', async () => {
    const { controller, gateway } = setUp();
    gateway.startMockInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    await controller.start(SETUP);
    expect(controller.getView()).toMatchObject({
      phase: 'idle',
      startFailure: ProfileErrorCode.DailyLimit,
    });
    expect(gateway.openLiveSocket).not.toHaveBeenCalled();
  });

  it('continuing after a reload: the call says where the relay is, and nothing else', async () => {
    const { controller, gateway, connected } = setUp();
    const resuming = controller.resume('s1');
    await connected();
    await resuming;
    expect(gateway.resumeMockInterview).toHaveBeenCalledWith('s1');
    expect(gateway.startMockInterview).not.toHaveBeenCalled();
    expect(gateway.openLiveSocket).toHaveBeenCalledWith('wss://relay.example');
  });

  it('continuing one left paused (a reload with the tab hidden): it goes on', async () => {
    const { controller, latest, connected } = setUp();
    const resuming = controller.resume('s1');
    await vi.waitFor(() => expect(latest()).toBeDefined());
    latest().onopen?.();
    await vi.waitFor(() =>
      expect(
        latest()
          .messages()
          .some(({ type }) => type === 'hello'),
      ).toBe(true),
    );
    latest().relay({ ...READY, paused: true });
    await resuming;
    expect(latest().messages().at(-1)).toMatchObject({
      type: 'pause',
      paused: false,
    });
    expect(controller.getView().phase).toBe('thinking');
    // A reconnect isn't a press: a pause made there stays.
    latest().drop();
    await connected();
    latest().relay({ ...READY, paused: true });
    expect(controller.getView().phase).toBe('paused');
  });

  it('continuing one that ended meanwhile shows its end', async () => {
    const { controller, gateway } = setUp();
    gateway.resumeMockInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MockSessionEnded),
    );
    await controller.resume('s1');
    expect(controller.getView().phase).toBe('ended');
  });
});

describe('LiveInterviewController: the interview (doc 24 §15.3 to §15.5)', () => {
  it('shows what the relay says: the line spoken, then your turn with the words heard, then thinking', async () => {
    const { controller, latest, connected, voice, pass } = setUp();
    void controller.start(SETUP);
    await connected();

    ask(latest(), 'l1', 'opening', 'Hello. I’m an AI interviewer.');
    expect(controller.getView()).toMatchObject({
      phase: 'speaking',
      speaking: { lineId: 'l1', kind: 'opening' },
    });
    expect(controller.getView().question).toBeUndefined();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');
    expect(voice.pushed.map(({ line }) => line)).toEqual([1, 2]);
    expect(voice.pushed[0]!.samples[1]).toBeCloseTo(0.5);

    latest().relay({ type: 'state', state: 'listening' });
    expect(controller.getView()).toMatchObject({
      phase: 'listening',
      question: { lineId: 'l2', turnId: 't1' },
    });
    pass(42_000);
    expect(controller.listeningMs()).toBe(42_000);
    latest().relay({
      type: 'heard',
      turnId: 't1',
      text: 'I build payment systems',
      final: false,
    });
    expect(controller.getView().heard).toBe('I build payment systems');
    expect(controller.holdsAnswer()).toBe(true);
    latest().relay({ type: 'notice', kind: 'answer-time', leftMs: 30_000 });
    expect(controller.getView().answerTimeWarn).toBe(true);

    pass(6_000);
    latest().relay({ type: 'answerEnd', turnId: 't1', reason: 'pause' });
    latest().relay({ type: 'state', state: 'thinking' });
    expect(controller.getView()).toMatchObject({
      phase: 'thinking',
      answered: 't1',
      answerEndedMs: 48_000,
      answerTimeWarn: false,
    });
  });

  it('streams the microphone all the time it isn’t paused, numbered', async () => {
    const { controller, latest, connected, speak } = setUp();
    void controller.start(SETUP);
    await connected();
    speak(0);
    speak(0);
    expect(latest().frames()).toHaveLength(2);
    const second = new DataView(latest().frames()[1]!);
    expect([
      second.getUint8(0),
      second.getUint8(1),
      second.getUint32(4, true),
    ]).toEqual([1, 1, 1]);
    expect(latest().frames()[1]!.byteLength).toBe(FRAME_HEADER_BYTES + 3_200);

    latest().relay({ type: 'state', state: 'paused' });
    speak(0);
    expect(latest().frames()).toHaveLength(2);
  });

  it('speaking over the interviewer stops it and starts the answer; louder while it plays', async () => {
    const { controller, latest, connected, speak, voice } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');
    voice.isPlaying = true;

    // Quiet speech doesn't stop it while it plays: some of the voice comes back in.
    speak(LIVE_SPEECH_LEVEL);
    speak(LIVE_SPEECH_LEVEL);
    expect(voice.stopped).toEqual([]);
    speak(LIVE_SPEECH_LEVEL_PLAYING);
    speak(LIVE_SPEECH_LEVEL_PLAYING);
    expect(voice.stopped).toEqual([2]);
    expect(latest().messages().at(-1)).toEqual({
      type: 'interrupt',
      id: 'id-2',
      lineId: 'l2',
      atMs: 1_234,
    });
    // Once a line; its frames still coming are dropped.
    speak(1);
    speak(1);
    expect(
      latest()
        .messages()
        .filter(({ type }) => type === 'interrupt'),
    ).toHaveLength(1);
    latest().voice(2, [1, 2]);
    expect(voice.pushed).toHaveLength(1);
  });

  it('the closing isn’t interrupted; "Stop and answer now" interrupts the rest', async () => {
    const { controller, latest, connected, speak } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l9', 'closing', 'That’s all my questions.');
    speak(1);
    speak(1);
    controller.stopAndAnswer();
    expect(
      latest()
        .messages()
        .some(({ type }) => type === 'interrupt'),
    ).toBe(false);

    ask(latest(), 'l3', 'follow-up', 'What was your part?', 't2');
    controller.stopAndAnswer();
    expect(latest().messages().at(-1)).toMatchObject({
      type: 'interrupt',
      lineId: 'l3',
    });
  });

  it('"I’m done", "Say it differently" (once) and Skip are messages for the line to answer', async () => {
    const { controller, latest, connected } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');
    latest().relay({ type: 'state', state: 'listening' });

    controller.done();
    controller.sayDifferently();
    ask(latest(), 'l3', 'rephrase', 'Who are you?', 't1');
    expect(controller.getView()).toMatchObject({
      rephrased: true,
      question: { lineId: 'l3' },
    });
    controller.sayDifferently();
    controller.skip();
    expect(
      latest()
        .messages()
        .filter(({ type }) => type !== 'hello' && type !== 'played'),
    ).toEqual([
      { type: 'done', id: 'id-2', lineId: 'l2' },
      { type: 'rephrase', id: 'id-3', lineId: 'l2' },
      { type: 'skip', id: 'id-4', lineId: 'l3' },
    ]);
    // A new question can be said differently again.
    ask(latest(), 'l4', 'question', 'An incident you led?', 't2');
    expect(controller.getView().rephrased).toBe(false);
  });

  it('"I’m done" with nothing heard yet says so, and keeps listening', async () => {
    const { controller, latest, connected } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');
    latest().relay({ type: 'state', state: 'listening' });
    latest().relay({ type: 'notice', kind: 'nothing-heard' });
    expect(controller.getView()).toMatchObject({
      phase: 'listening',
      nothingHeard: true,
    });
  });

  it('tells the relay when each line was first heard (§13.5)', async () => {
    const { controller, latest, connected, voice, pass } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');
    pass(300);
    voice.onStarted?.(2, 1_320);
    expect(latest().messages().at(-1)).toEqual({
      type: 'played',
      played: [{ lineId: 'l2', firstSoundMs: 320, startMs: 320 }],
    });
  });

  it('pauses: the voice stops, the relay is told, and back the question is said again', async () => {
    const { controller, latest, connected, voice } = setUp();
    void controller.start(SETUP);
    await connected();
    ask(latest(), 'l2', 'question', 'Tell me about yourself.', 't1');

    controller.pause();
    expect(controller.getView().phase).toBe('paused');
    expect(voice.stopped).toEqual([2]);
    controller.hearAgain();
    expect(
      latest()
        .messages()
        .filter(({ type }) => type === 'pause'),
    ).toEqual([
      { type: 'pause', id: 'id-2', paused: true },
      { type: 'pause', id: 'id-3', paused: false },
    ]);
  });
});

describe('LiveInterviewController: the connection lost (doc 24 §15.5, Web-X6-RT-States)', () => {
  it('reconnects with the resume token, and carries on', async () => {
    const { controller, latest, connected, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().drop();
    expect(controller.getView().phase).toBe('reconnecting');

    await connected();
    expect(sockets).toHaveLength(2);
    expect(latest().messages()[0]).toMatchObject({
      type: 'hello',
      resumeToken: 'resume-1',
    });
    ask(latest(), 'l3', 'question', 'Tell me about yourself.', 't1');
    expect(controller.getView().phase).toBe('speaking');
  });

  it('a resume token older than 2 minutes isn’t sent', async () => {
    const { controller, latest, connected, pass } = setUp();
    void controller.start(SETUP);
    await connected();
    pass(121_000);
    latest().drop();
    await connected();
    expect(latest().messages()[0]).not.toHaveProperty('resumeToken');
  });

  it('“We couldn’t reconnect” after its tries; "Try again" tries again', async () => {
    const { controller, latest, connected, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().drop();
    for (let tries = 0; tries < LIVE_RECONNECT_WAITS_MS.length; tries += 1) {
      await vi.waitFor(() => expect(sockets).toHaveLength(tries + 2));
      latest().drop();
    }
    await vi.waitFor(() =>
      expect(controller.getView().phase).toBe('disconnected'),
    );

    void controller.reconnect();
    await connected();
    expect(controller.getView().phase).toBe('thinking');
  });

  it('the relay going away: connects again at once with the new token', async () => {
    const { controller, latest, connected, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().relay({ type: 'reconnect', resumeToken: 'resume-2' });
    expect(sockets[0]!.closed).toBe(true);
    await connected();
    expect(latest().messages()[0]).toMatchObject({ resumeToken: 'resume-2' });
  });

  it('taken over in another tab: "Continue here" takes it back', async () => {
    const { controller, latest, connected, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().relay({ type: 'error', reason: 'replaced', retry: false });
    latest().drop();
    expect(controller.getView().phase).toBe('replaced');
    expect(sockets).toHaveLength(1);

    void controller.reconnect();
    await connected();
    expect(sockets).toHaveLength(2);
  });

  it('a refusal with a retry reconnects; one without says why', async () => {
    const { controller, latest, connected, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().relay({ type: 'error', reason: 'busy', retry: true });
    await vi.waitFor(() => expect(sockets).toHaveLength(2));
    latest().onopen?.();
    await vi.waitFor(() => expect(latest().messages()).toHaveLength(1));
    latest().relay({ type: 'error', reason: 'flag', retry: false });
    expect(controller.getView()).toMatchObject({
      phase: 'idle',
      startFailure: ProfileErrorCode.FlagOff,
    });
  });
});

describe('LiveInterviewController: the end', () => {
  it('ends when the relay says so, and lets go of the microphone', async () => {
    const { controller, latest, connected, track, streamer } = setUp();
    void controller.start(SETUP);
    await connected();
    latest().relay({ type: 'ended', endReason: 'finished' });
    expect(controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'finished',
    });
    expect(track.stop).toHaveBeenCalled();
    expect(streamer.stop).toHaveBeenCalled();
    expect(latest().closed).toBe(true);
  });

  it('ended elsewhere, or out of today’s money', async () => {
    const first = setUp();
    void first.controller.start(SETUP);
    await first.connected();
    first
      .latest()
      .relay({ type: 'error', reason: 'session-ended', retry: false });
    expect(first.controller.getView()).toMatchObject({ phase: 'ended' });

    const second = setUp();
    void second.controller.start(SETUP);
    await second.connected();
    second.latest().relay({ type: 'error', reason: 'quota', retry: false });
    expect(second.controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'quota',
    });
  });

  it('"End interview" is a message while connected, and the call when not', async () => {
    const { controller, latest, connected, gateway, sockets } = setUp();
    void controller.start(SETUP);
    await connected();
    await controller.end();
    expect(latest().messages().at(-1)).toEqual({ type: 'end', id: 'id-2' });
    latest().relay({ type: 'ended', endReason: 'ended' });
    expect(controller.getView().endReason).toBe('ended');
    expect(gateway.endMockInterview).not.toHaveBeenCalled();

    const lost = setUp();
    void lost.controller.start(SETUP);
    await lost.connected();
    lost.latest().drop();
    for (let tries = 0; tries < LIVE_RECONNECT_WAITS_MS.length; tries += 1) {
      await vi.waitFor(() => expect(lost.sockets).toHaveLength(tries + 2));
      lost.latest().drop();
    }
    await vi.waitFor(() =>
      expect(lost.controller.getView().phase).toBe('disconnected'),
    );
    await lost.controller.end();
    expect(lost.gateway.endMockInterview).toHaveBeenCalledWith('s1');
    expect(lost.controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'ended',
    });
    expect(sockets).toHaveLength(1);
  });
});

describe('LiveInterviewController: the voice model (doc 24 §15, way 3)', () => {
  const VOICE_MODEL = { ...SETUP, way: 'voice-model' as const };

  it('starts with no voice: the model speaks in its own', async () => {
    const { controller, gateway, connected } = setUp();
    void controller.start(VOICE_MODEL);
    await connected();
    expect(gateway.startMockInterview).toHaveBeenCalledWith(
      expect.not.objectContaining({ voice: expect.anything() }),
    );
    expect(gateway.startMockInterview).toHaveBeenCalledWith(
      expect.objectContaining({ way: 'voice-model' }),
    );
  });

  it('its words come at the line’s end; the opening asks the first question', async () => {
    const { controller, latest, connected } = setUp();
    void controller.start(VOICE_MODEL);
    await connected();
    latest().relay({ ...READY, way: 'voice-model' });
    latest().relay({ type: 'state', state: 'speaking' });
    latest().relay({
      type: 'line',
      lineId: 'l1',
      kind: 'opening',
      turnId: 't1',
      text: '',
    });
    expect(controller.getView()).toMatchObject({
      way: 'voice-model',
      speaking: { lineId: 'l1', text: '' },
      question: { lineId: 'l1', turnId: 't1' },
    });
    latest().relay({
      type: 'lineEnd',
      lineId: 'l1',
      text: 'Hello. Tell me about yourself.',
      durationMs: 4_000,
    });
    expect(controller.getView()).toMatchObject({
      speaking: { text: 'Hello. Tell me about yourself.' },
      question: { text: 'Hello. Tell me about yourself.' },
      linesEnded: 1,
    });

    // No answerEnd: the answer ended when the model speaks again
    latest().relay({ type: 'state', state: 'listening' });
    controller.done();
    expect(latest().messages().at(-1)).toMatchObject({
      type: 'done',
      lineId: 'l1',
    });
    latest().relay({ type: 'state', state: 'thinking' });
    expect(controller.getView()).toMatchObject({
      answered: 't1',
      answeredLine: 'l1',
    });
  });

  it('cut off within its first word: no words, said so', async () => {
    const { controller, latest, connected, speak } = setUp();
    void controller.start(VOICE_MODEL);
    await connected();
    latest().relay({ ...READY, way: 'voice-model' });
    latest().relay({ type: 'state', state: 'speaking' });
    latest().relay({
      type: 'line',
      lineId: 'l3',
      kind: 'question',
      turnId: 't2',
      text: '',
    });
    speak(1);
    speak(1);
    expect(latest().messages().at(-1)).toMatchObject({
      type: 'interrupt',
      lineId: 'l3',
    });
    latest().relay({ type: 'interrupted', lineId: 'l3' });
    latest().relay({ type: 'lineEnd', lineId: 'l3', text: '', durationMs: 80 });
    expect(controller.getView().cutOffLine).toBe('l3');
  });
});
