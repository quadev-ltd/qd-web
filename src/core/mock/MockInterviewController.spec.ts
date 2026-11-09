import { MicrophoneError, PlaybackBlockedError } from './audio';
import {
  type MockDeps,
  MockInterviewController,
  type RecorderLike,
} from './MockInterviewController';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type MockLine } from '@/core/profile/mockInterviews';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';

const line = (
  lineId: string,
  kind: MockLine['kind'],
  text: string,
  turnId?: string,
): MockLine => ({
  lineId,
  kind,
  ...(turnId ? { turnId } : {}),
  text,
  audio: { mimeType: 'audio/mpeg', base64: `audio-${lineId}`, durationMs: 500 },
});

const OPENING = line('l1', 'opening', 'Hello. I’m an AI interviewer.');
const Q1 = line('l2', 'question', 'Tell me about yourself.', 't1');
const Q2 = line('l3', 'question', 'Tell me about an incident you led.', 't2');
const CLOSING = line('l4', 'closing', 'That’s all my questions.');

const SETUP = {
  applicationId: 'a1',
  interviewId: 'i1',
  way: 'take-turns' as const,
  lengthMinutes: 10 as const,
  voice: 'gemini' as const,
};

/** A microphone whose track can be lost. */
const fakeStream = () => {
  const listeners: (() => void)[] = [];
  const track = {
    readyState: 'live',
    addEventListener: (_: string, listener: () => void) =>
      listeners.push(listener),
    stop: vi.fn(),
  };
  return {
    stream: {
      getAudioTracks: () => [track],
      getTracks: () => [track],
    } as unknown as MediaStream,
    lose: () => {
      track.readyState = 'ended';
      listeners.forEach(listener => listener());
    },
  };
};

const setUp = (overrides: Partial<MockDeps> = {}) => {
  let clock = 1_000;
  let ids = 0;
  const gateway = createMockProfileGateway();
  gateway.startMockInterview.mockResolvedValue({
    sessionId: 's1',
    lines: [OPENING, Q1],
    status: 'active',
    timeLeftMs: 600_000,
  });
  gateway.answerMockQuestion.mockResolvedValue({
    turnId: 't1',
    transcript: 'I build payment systems.',
    lines: [Q2],
    status: 'active',
    timeLeftMs: 540_000,
  });
  const microphone = fakeStream();
  const recorders: (RecorderLike & {
    started: boolean;
    paused: boolean;
    discarded: boolean;
  })[] = [];
  const played: string[] = [];
  const deps: MockDeps = {
    gateway,
    openMicrophone: vi.fn(() => Promise.resolve(microphone.stream)),
    createRecorder: () => {
      const recorder = {
        started: false,
        paused: false,
        discarded: false,
        start() {
          recorder.started = true;
        },
        pause() {
          recorder.paused = true;
        },
        resume() {
          recorder.paused = false;
        },
        elapsedMs: () => 12_000,
        stop: () =>
          Promise.resolve({
            blob: new Blob(['answer']),
            mimeType: 'audio/webm;codecs=opus',
            durationMs: 12_000,
          }),
        discard() {
          recorder.discarded = true;
        },
      };
      recorders.push(recorder);
      return recorder;
    },
    player: {
      unlock: vi.fn(() => Promise.resolve(true)),
      play: vi.fn(({ base64 }: { base64: string }) => {
        played.push(base64);
        clock += 300;
        return Promise.resolve({
          started: Promise.resolve(clock),
          ended: Promise.resolve(),
          stop: vi.fn(),
        });
      }),
      close: vi.fn(),
    },
    client: () =>
      Promise.resolve({
        browser: 'Chrome 142',
        os: 'macOS',
        headphones: 'no' as const,
      }),
    toBase64: () => Promise.resolve('YW5zd2Vy'),
    uuid: () => `request-${(ids += 1)}`,
    now: () => clock,
    wait: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  const controller = new MockInterviewController(deps);
  const onStarted = vi.fn();
  controller.whenStarted(onStarted);
  return {
    controller,
    deps,
    gateway,
    recorders,
    played,
    microphone,
    onStarted,
  };
};

describe('a mock interview taken in turns (D100)', () => {
  it('starts on the press: the microphone, the start call, the opening and the question, then records', async () => {
    const { controller, deps, gateway, recorders, played, onStarted } = setUp();

    await controller.start(SETUP);

    expect(deps.player.unlock).toHaveBeenCalled();
    expect(gateway.startMockInterview).toHaveBeenCalledWith({
      requestId: 'request-1',
      ...SETUP,
      client: { browser: 'Chrome 142', os: 'macOS', headphones: 'no' },
    });
    expect(onStarted).toHaveBeenCalledWith('s1');
    expect(played).toEqual(['audio-l1', 'audio-l2']);
    const view = controller.getView();
    expect(view.phase).toBe('answering');
    expect(view.question).toEqual({
      lineId: 'l2',
      turnId: 't1',
      text: 'Tell me about yourself.',
      kind: 'question',
    });
    expect(view.timeLeft?.ms).toBe(600_000);
    expect(recorders).toHaveLength(1);
    expect(recorders[0]!.started).toBe(true);
  });

  it('sends the answer with what it measured, then plays the next question and records again', async () => {
    const { controller, gateway, recorders, played } = setUp();
    await controller.start(SETUP);

    await controller.done();

    expect(gateway.answerMockQuestion).toHaveBeenCalledWith({
      requestId: 'request-2',
      sessionId: 's1',
      lineId: 'l2',
      audio: {
        mimeType: 'audio/webm;codecs=opus',
        base64: 'YW5zd2Vy',
        durationMs: 12_000,
      },
      played: [
        { lineId: 'l1', firstSoundMs: 300, startMs: 300 },
        { lineId: 'l2', firstSoundMs: 600, startMs: 600 },
      ],
    });
    expect(played.at(-1)).toBe('audio-l3');
    expect(controller.getView().question?.lineId).toBe('l3');
    expect(controller.getView().phase).toBe('answering');
    expect(recorders).toHaveLength(2);
  });

  it('“Stop and answer now” stops the interviewer and records at once', async () => {
    let finish: () => void = () => {};
    const { controller, deps, recorders } = setUp();
    vi.mocked(deps.player.play).mockImplementation(() =>
      Promise.resolve({
        started: Promise.resolve(0),
        ended: new Promise<void>(resolve => {
          finish = resolve;
        }),
        stop: () => finish(),
      }),
    );

    void controller.start(SETUP);
    await vi.waitFor(() => expect(controller.getView().phase).toBe('speaking'));
    controller.stopAndAnswer();

    expect(controller.getView().phase).toBe('answering');
    expect(recorders).toHaveLength(1);
  });

  it('says when nothing was heard, and answers again', async () => {
    const { controller, gateway, recorders } = setUp();
    gateway.answerMockQuestion.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.MockNothingHeard),
    );
    await controller.start(SETUP);

    await controller.done();
    expect(controller.getView()).toMatchObject({
      phase: 'issue',
      issue: 'nothing-heard',
    });

    controller.restartAnswer();
    expect(controller.getView().phase).toBe('answering');
    expect(recorders).toHaveLength(2);
  });

  it('keeps an answer that couldn’t be sent, and sends it again as the same request', async () => {
    const { controller, gateway } = setUp();
    gateway.answerMockQuestion.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );
    await controller.start(SETUP);

    await controller.done();
    expect(controller.getView()).toMatchObject({
      phase: 'issue',
      issue: 'send-failed',
    });
    expect(controller.holdsAnswer()).toBe(true);

    await controller.sendAgain();
    const requests = gateway.answerMockQuestion.mock.calls.map(
      ([request]) => request.requestId,
    );
    expect(requests).toEqual(['request-2', 'request-2']);
    expect(controller.getView().question?.lineId).toBe('l3');
  });

  it('sends a busy call again a second later, with the same request', async () => {
    const { controller, deps, gateway } = setUp();
    gateway.answerMockQuestion.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.MockBusy),
    );
    await controller.start(SETUP);

    await controller.done();

    expect(deps.wait).toHaveBeenCalledWith(1_000);
    expect(gateway.answerMockQuestion).toHaveBeenCalledTimes(2);
    expect(controller.getView().question?.lineId).toBe('l3');
  });

  it('ends after the closing line', async () => {
    const { controller, gateway, played } = setUp();
    gateway.answerMockQuestion.mockResolvedValueOnce({
      turnId: 't1',
      transcript: 'Done.',
      lines: [CLOSING],
      status: 'ended',
      timeLeftMs: 0,
    });
    await controller.start(SETUP);

    await controller.done();

    expect(played.at(-1)).toBe('audio-l4');
    expect(controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'finished',
    });
  });

  it('Repeat plays the question again from the page and starts the answer again', async () => {
    const { controller, gateway, recorders, played } = setUp();
    await controller.start(SETUP);

    await controller.repeat();
    await controller.done();

    expect(played).toEqual(['audio-l1', 'audio-l2', 'audio-l2', 'audio-l3']);
    expect(recorders[0]!.discarded).toBe(true);
    expect(gateway.answerMockQuestion.mock.calls[0]![0].played).toContainEqual(
      expect.objectContaining({ lineId: 'l2', repeats: 1 }),
    );
  });

  it('“Say it differently” once: the other wording becomes the question to answer', async () => {
    const { controller, gateway } = setUp();
    gateway.rephraseMockQuestion.mockResolvedValue({
      lines: [line('l3', 'rephrase', 'Who are you, at work?', 't1')],
      status: 'active',
    });
    await controller.start(SETUP);

    await controller.sayDifferently();
    expect(gateway.rephraseMockQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', lineId: 'l2' }),
    );
    expect(controller.getView()).toMatchObject({
      phase: 'answering',
      rephrased: true,
      question: { lineId: 'l3', kind: 'rephrase' },
    });

    await controller.sayDifferently();
    expect(gateway.rephraseMockQuestion).toHaveBeenCalledTimes(1);
  });

  it('skips a question: what was recorded is dropped', async () => {
    const { controller, gateway, recorders } = setUp();
    gateway.skipMockQuestion.mockResolvedValue({
      lines: [Q2],
      status: 'active',
      timeLeftMs: 500_000,
    });
    await controller.start(SETUP);

    await controller.skip();

    expect(recorders[0]!.discarded).toBe(true);
    expect(gateway.skipMockQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', lineId: 'l2' }),
    );
    expect(controller.getView().question?.lineId).toBe('l3');
  });

  it('pauses with the tab, recording and clock, and continues the same answer', async () => {
    const { controller, gateway, recorders } = setUp();
    await controller.start(SETUP);

    controller.pause();
    expect(controller.getView()).toMatchObject({
      phase: 'paused',
      pausedDuring: 'answering',
    });
    expect(recorders[0]!.paused).toBe(true);
    expect(gateway.pauseMockInterview).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 's1', paused: true }),
    );

    await controller.continueAnswering();
    expect(gateway.pauseMockInterview).toHaveBeenLastCalledWith({
      sessionId: 's1',
      paused: false,
    });
    expect(recorders[0]!.paused).toBe(false);
    expect(controller.getView().phase).toBe('answering');
    expect(recorders).toHaveLength(1);
  });

  it('asks for a tap when the browser holds the sound back, then plays on', async () => {
    const { controller, deps, played } = setUp();
    vi.mocked(deps.player.play).mockRejectedValueOnce(
      new PlaybackBlockedError(),
    );

    await controller.start(SETUP);
    expect(controller.getView().phase).toBe('tap');

    await controller.tapToHear();
    expect(played).toEqual(['audio-l1', 'audio-l2']);
    expect(controller.getView().phase).toBe('answering');
  });

  it('says when the microphone was refused or isn’t there', async () => {
    const refused = setUp({
      openMicrophone: () => Promise.reject(new MicrophoneError('refused')),
    });
    await refused.controller.start(SETUP);
    expect(refused.controller.getView().phase).toBe('mic-refused');
    expect(refused.gateway.startMockInterview).not.toHaveBeenCalled();

    const missing = setUp({
      openMicrophone: () => Promise.reject(new MicrophoneError('missing')),
    });
    await missing.controller.start(SETUP);
    expect(missing.controller.getView().phase).toBe('mic-missing');
  });

  it('keeps what was said when the microphone is lost, to send or answer again', async () => {
    const { controller, microphone, gateway } = setUp();
    await controller.start(SETUP);

    microphone.lose();
    await vi.waitFor(() =>
      expect(controller.getView()).toMatchObject({
        phase: 'issue',
        issue: 'mic-lost',
      }),
    );
    await controller.sendAgain();
    expect(gateway.answerMockQuestion).toHaveBeenCalledTimes(1);
  });

  it('says why a start was refused, and starts again as the same request', async () => {
    const { controller, gateway } = setUp();
    gateway.startMockInterview.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );

    await controller.start(SETUP);
    expect(controller.getView()).toMatchObject({
      phase: 'idle',
      startFailure: ProfileErrorCode.DailyLimit,
    });
  });

  it('ends on “End interview”, dropping the answer, and when the backend says it ended', async () => {
    const ended = setUp();
    await ended.controller.start(SETUP);
    await ended.controller.end();
    expect(ended.gateway.endMockInterview).toHaveBeenCalledWith('s1', [
      { lineId: 'l1', firstSoundMs: 300, startMs: 300 },
      { lineId: 'l2', firstSoundMs: 600, startMs: 600 },
    ]);
    expect(ended.controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'ended',
    });
    expect(ended.recorders[0]!.discarded).toBe(true);

    const failed = setUp();
    failed.gateway.answerMockQuestion.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.MockSessionFailed),
    );
    await failed.controller.start(SETUP);
    await failed.controller.done();
    expect(failed.controller.getView()).toMatchObject({
      phase: 'ended',
      endReason: 'failed',
    });

    const quota = setUp();
    quota.gateway.answerMockQuestion.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    await quota.controller.start(SETUP);
    await quota.controller.done();
    expect(quota.controller.getView().endReason).toBe('quota');
  });

  it('continues after a reload: the waiting line again, unpaused', async () => {
    const { controller, gateway, played } = setUp();
    gateway.resumeMockInterview.mockResolvedValue({
      lines: [Q2],
      status: 'active',
      paused: true,
      timeLeftMs: 400_000,
    });

    await controller.resume('s1');

    expect(gateway.pauseMockInterview).toHaveBeenCalledWith({
      sessionId: 's1',
      paused: false,
    });
    expect(played).toEqual(['audio-l3']);
    expect(controller.getView()).toMatchObject({
      phase: 'answering',
      sessionId: 's1',
    });
  });
});
