// The browser's side of a mock interview's sound (D100, research doc 24 §4 and §12): the
// interviewer's lines played through one AudioContext, created on the press that starts or
// continues the interview so the browser lets it play. The microphone and the recording of an
// answer are in @/core/audio/recording, shared with dictation.

/** The sound was held back by the browser until the page is pressed again. */
export class PlaybackBlockedError extends Error {
  constructor() {
    super('blocked');
    this.name = 'PlaybackBlockedError';
  }
}

export interface Playback {
  /** When the first sound was heard (performance.now()), once it starts. */
  started: Promise<number>;
  /** When the line has been played to its end, or stopped. */
  ended: Promise<void>;
  stop(): void;
}

const bytesOf = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

/**
 * Plays the interviewer's lines. `unlock` is called in the press that starts or continues the
 * interview: the browser lets a context made or resumed there play sound.
 */
export class LinePlayer {
  private context: AudioContext | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** In a press: makes the context, or resumes it. Resolves whether it can play. */
  async unlock(): Promise<boolean> {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch {
        // Held back: the page asks for a tap.
      }
    }
    return this.context.state === 'running';
  }

  /** Plays one line from its audio. Rejects with PlaybackBlockedError when the browser holds it back. */
  async play(audio: { base64: string }): Promise<Playback> {
    const context = (this.context ??= new AudioContext());
    if (context.state !== 'running') {
      throw new PlaybackBlockedError();
    }
    const buffer = await context.decodeAudioData(bytesOf(audio.base64));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const ended = new Promise<void>(resolve => {
      source.onended = () => resolve();
    });
    source.start();
    // The sound reaches the speaker after the output's own delay.
    const latencyMs =
      (context.outputLatency || context.baseLatency || 0) * 1_000;
    return {
      started: Promise.resolve(this.now() + latencyMs),
      ended,
      stop: () => {
        try {
          source.stop();
        } catch {
          // Already ended.
        }
      },
    };
  }

  close() {
    void this.context?.close();
    this.context = null;
  }
}
