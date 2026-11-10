// The browser's side of a mock interview's sound in real time (D100, research doc 24 §15.3): the
// microphone streamed in 100 ms frames of 16 kHz PCM through an AudioWorklet, and the
// interviewer's voice, 24 kHz PCM frames, played in order as they come. One AudioContext for both,
// made or resumed in the press that starts or continues the interview, so the browser lets it play.
// Nothing is recorded or kept.
import {
  type LiveStreamerLike,
  type LiveVoiceLike,
} from './LiveInterviewController';
import { LIVE_OUTPUT } from './liveProtocol';

/** The worklet's module, served from public/ as it is. */
const CAPTURE_MODULE = '/mock/live-capture.js';
/** A frame is started this far ahead, so frames that come late still join up. */
const LEAD_SECONDS = 0.05;

/** Whether this browser can stream the microphone: an AudioWorklet and getUserMedia. */
export const canStream = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.mediaDevices?.getUserMedia === 'function' &&
  typeof AudioWorkletNode !== 'undefined';

interface PlayingLine {
  /** When its first frame starts, on the context's clock. */
  startAt: number;
  sources: Set<AudioBufferSourceNode>;
}

export class LiveAudio implements LiveVoiceLike {
  private context: AudioContext | null = null;
  private captureLoaded: Promise<void> | null = null;
  /** When the next frame starts, on the context's clock. */
  private nextAt = 0;
  private readonly lines = new Map<number, PlayingLine>();

  onStarted: ((line: number, at: number) => void) | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  private ensureContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }

  async unlock(): Promise<boolean> {
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      try {
        await context.resume();
      } catch {
        // Held back until the next press.
      }
    }
    return context.state === 'running';
  }

  push(line: number, samples: Float32Array) {
    const context = this.context;
    if (!context || samples.length === 0) {
      return;
    }
    const buffer = context.createBuffer(
      1,
      samples.length,
      LIVE_OUTPUT.sampleRate,
    );
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(this.nextAt, context.currentTime + LEAD_SECONDS);
    source.start(startAt);
    this.nextAt = startAt + buffer.duration;
    let playing = this.lines.get(line);
    if (!playing) {
      playing = { startAt, sources: new Set() };
      this.lines.set(line, playing);
      // Heard once it reaches the speaker, after the output's own delay.
      const latency = context.outputLatency || context.baseLatency || 0;
      this.onStarted?.(
        line,
        this.now() + (startAt - context.currentTime + latency) * 1_000,
      );
    }
    const sources = playing.sources;
    sources.add(source);
    source.onended = () => sources.delete(source);
  }

  stop(line: number): number {
    const playing = this.lines.get(line);
    const context = this.context;
    if (!playing || !context) {
      return 0;
    }
    this.lines.delete(line);
    playing.sources.forEach(source => {
      source.onended = null;
      try {
        source.stop();
      } catch {
        // Already ended.
      }
    });
    if (this.lines.size === 0) {
      this.nextAt = 0;
    }
    return Math.max(0, (context.currentTime - playing.startAt) * 1_000);
  }

  playing(): boolean {
    return this.context !== null && this.nextAt > this.context.currentTime;
  }

  /** Streams the microphone through the worklet; nothing of it is heard. */
  async stream(
    media: MediaStream,
    onFrame: (pcm: Int16Array, level: number) => void,
  ): Promise<LiveStreamerLike> {
    const context = this.ensureContext();
    this.captureLoaded ??= context.audioWorklet.addModule(CAPTURE_MODULE);
    await this.captureLoaded;
    const source = context.createMediaStreamSource(media);
    const capture = new AudioWorkletNode(context, 'live-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    capture.port.onmessage = (
      event: MessageEvent<{ pcm: ArrayBuffer; level: number }>,
    ) => onFrame(new Int16Array(event.data.pcm), event.data.level);
    // Joined to the output, so every browser runs it; at no volume.
    const silent = context.createGain();
    silent.gain.value = 0;
    source.connect(capture);
    capture.connect(silent).connect(context.destination);
    return {
      stop: () => {
        capture.port.onmessage = null;
        source.disconnect();
        capture.disconnect();
        silent.disconnect();
      },
    };
  }

  close() {
    this.lines.clear();
    this.nextAt = 0;
    this.captureLoaded = null;
    void this.context?.close();
    this.context = null;
  }
}
