// The browser's side of a mock interview's sound (D100, research doc 24 §4 and §12): the
// microphone, the recording of one answer, and the interviewer's lines played through one
// AudioContext, created on the press that starts or continues the interview so the browser lets
// it play. The recording stays in the page's memory until it is sent, and is never stored.
import { MOCK_AUDIO_BITS_PER_SECOND } from '@/core/profile/mockInterviews';

/** Why the microphone can't be used: blocked, none there (or taken), or a browser that can't record. */
export type MicrophoneFailure = 'refused' | 'missing' | 'unsupported';

export class MicrophoneError extends Error {
  constructor(public readonly failure: MicrophoneFailure) {
    super(failure);
    this.name = 'MicrophoneError';
  }
}

/** Whether this browser can record at all: some apps' built-in browsers and older Safari can't. */
export const canRecord = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof MediaRecorder !== 'undefined';

/** Asks for the microphone, with the browser's echo cancellation so the interviewer isn't heard. */
export const openMicrophone = async (): Promise<MediaStream> => {
  if (!canRecord()) {
    throw new MicrophoneError('unsupported');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    throw new MicrophoneError(
      name === 'NotAllowedError' || name === 'SecurityError'
        ? 'refused'
        : 'missing',
    );
  }
};

/** What the recording is made as: Opus in WebM where it can be (Chrome, Edge, Firefox), else AAC (Safari). */
export const recordingMimeType = (): string =>
  [
    'audio/webm;codecs=opus',
    'audio/mp4',
    'audio/webm',
    'audio/ogg;codecs=opus',
  ].find(type => MediaRecorder.isTypeSupported(type)) ?? '';

/** A recording's bytes in base64, as the call takes them. */
export const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Not read'));
    reader.readAsDataURL(blob);
  });

export interface Recording {
  blob: Blob;
  mimeType: string;
  /** How long it is, its pauses left out. */
  durationMs: number;
}

/**
 * One answer being recorded. It can pause (the tab left) and go on, and is stopped to be sent or
 * dropped to start again. Its time is counted here, so the page shows "Recording · 1:12".
 */
export class AnswerRecorder {
  private readonly recorder: MediaRecorder;
  private readonly chunks: Blob[] = [];
  private startedAt = 0;
  private pausedAt: number | null = null;
  private pausedMs = 0;
  private stopped: Promise<void>;

  constructor(
    stream: MediaStream,
    private readonly now: () => number = () => performance.now(),
  ) {
    const mimeType = recordingMimeType();
    this.recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: MOCK_AUDIO_BITS_PER_SECOND,
    });
    this.recorder.ondataavailable = event => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.stopped = new Promise(resolve => {
      this.recorder.onstop = () => resolve();
    });
  }

  start() {
    this.startedAt = this.now();
    // Chunks every second, so a microphone lost mid-answer keeps what was said.
    this.recorder.start(1_000);
  }

  pause() {
    if (this.recorder.state === 'recording') {
      this.recorder.pause();
      this.pausedAt = this.now();
    }
  }

  resume() {
    if (this.recorder.state === 'paused') {
      this.recorder.resume();
      this.pausedMs += this.now() - (this.pausedAt ?? this.now());
      this.pausedAt = null;
    }
  }

  /** How long it has recorded, its pauses left out. */
  elapsedMs(): number {
    if (this.startedAt === 0) {
      return 0;
    }
    const until = this.pausedAt ?? this.now();
    return Math.max(0, until - this.startedAt - this.pausedMs);
  }

  /** Stops, and gives what was recorded. */
  async stop(): Promise<Recording> {
    const durationMs = this.elapsedMs();
    if (this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    await this.stopped;
    const mimeType = this.recorder.mimeType || recordingMimeType();
    return {
      blob: new Blob(this.chunks, { type: mimeType }),
      mimeType,
      durationMs: Math.round(durationMs),
    };
  }

  /** Stops and forgets what was recorded. */
  discard() {
    if (this.recorder.state !== 'inactive') {
      this.recorder.stop();
    }
    this.chunks.length = 0;
  }
}

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
