import { act, renderHook } from '@testing-library/react';

import { useRecorder } from './useRecorder';

const fake = vi.hoisted(() => ({
  canRecord: true,
  open: vi.fn<() => Promise<MediaStream>>(),
  recorders: [] as {
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    discard: ReturnType<typeof vi.fn>;
  }[],
}));

vi.mock('./recording', async importOriginal => ({
  ...(await importOriginal<object>()),
  canRecord: () => fake.canRecord,
  openMicrophone: () => fake.open(),
  AnswerRecorder: class {
    start = vi.fn();
    stop = vi.fn(() =>
      Promise.resolve({
        blob: new Blob(['sound']),
        mimeType: 'audio/webm',
        durationMs: 4_000,
      }),
    );
    discard = vi.fn();
    elapsedMs = () => 4_000;
    constructor() {
      fake.recorders.push(this);
    }
  },
}));

/** A microphone whose track can be lost. */
const microphone = () => {
  const listeners: (() => void)[] = [];
  const track = {
    stop: vi.fn(),
    addEventListener: (_: string, listener: () => void) =>
      listeners.push(listener),
  };
  const stream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, track, lose: () => listeners.forEach(lost => lost()) };
};

beforeEach(() => {
  fake.canRecord = true;
  fake.open.mockReset();
  fake.recorders.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('one recording at a time (D102, shared with mock interviews’ recorder)', () => {
  it('asks for the microphone, records, and lets it go once stopped', async () => {
    const mic = microphone();
    let give: (stream: MediaStream) => void = () => {};
    fake.open.mockReturnValue(new Promise(resolve => (give = resolve)));
    const { result } = renderHook(() =>
      useRecorder({ maxMs: 180_000, onEnd: vi.fn() }),
    );
    expect(result.current.phase).toBe('idle');

    act(() => void result.current.start());
    expect(result.current.phase).toBe('asking');
    await act(async () => give(mic.stream));
    expect(result.current.phase).toBe('recording');
    expect(fake.recorders[0]!.start).toHaveBeenCalled();
    expect(result.current.elapsedMs()).toBe(4_000);

    let recording: unknown;
    await act(async () => {
      recording = await result.current.stop();
    });
    expect(recording).toMatchObject({ mimeType: 'audio/webm' });
    expect(mic.track.stop).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('says why the microphone can’t be used, and that a browser can’t record', async () => {
    const { MicrophoneError } = await import('./recording');
    fake.open.mockRejectedValueOnce(new MicrophoneError('refused'));
    fake.open.mockRejectedValueOnce(new Error('NotFoundError'));
    const { result } = renderHook(() =>
      useRecorder({ maxMs: 180_000, onEnd: vi.fn() }),
    );

    await act(() => result.current.start());
    expect(result.current.phase).toBe('refused');
    await act(() => result.current.start());
    expect(result.current.phase).toBe('missing');

    fake.canRecord = false;
    const { result: cannot } = renderHook(() =>
      useRecorder({ maxMs: 180_000, onEnd: vi.fn() }),
    );
    expect(cannot.current.phase).toBe('unsupported');
  });

  it('ends at its longest, and when the microphone is lost', async () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();
    const first = microphone();
    fake.open.mockResolvedValueOnce(first.stream);
    const { result } = renderHook(() => useRecorder({ maxMs: 180_000, onEnd }));

    await act(() => result.current.start());
    act(() => vi.advanceTimersByTime(179_999));
    expect(onEnd).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onEnd).toHaveBeenCalledTimes(1);

    first.lose();
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('drops the recording on cancel, and lets go of a microphone given after it', async () => {
    const mic = microphone();
    fake.open.mockResolvedValueOnce(mic.stream);
    const { result } = renderHook(() =>
      useRecorder({ maxMs: 180_000, onEnd: vi.fn() }),
    );
    await act(() => result.current.start());
    act(() => result.current.cancel());
    expect(fake.recorders[0]!.discard).toHaveBeenCalled();
    expect(mic.track.stop).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');

    const late = microphone();
    let give: (stream: MediaStream) => void = () => {};
    fake.open.mockReturnValue(new Promise(resolve => (give = resolve)));
    act(() => void result.current.start());
    act(() => result.current.cancel());
    await act(async () => give(late.stream));
    expect(late.track.stop).toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
    expect(fake.recorders).toHaveLength(1);
  });

  it('lets go of the microphone when the page closes', async () => {
    const mic = microphone();
    fake.open.mockResolvedValueOnce(mic.stream);
    const { result, unmount } = renderHook(() =>
      useRecorder({ maxMs: 180_000, onEnd: vi.fn() }),
    );
    await act(() => result.current.start());
    unmount();
    expect(fake.recorders[0]!.discard).toHaveBeenCalled();
    expect(mic.track.stop).toHaveBeenCalled();
  });
});
