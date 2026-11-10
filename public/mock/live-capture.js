// The microphone of a mock interview's real-time way (D100, research doc 24 §15.3), as an
// AudioWorklet: the input brought down to 16 kHz mono, posted in frames of 100 ms (1,600 samples
// of 16-bit PCM), each with its level (RMS, 0 to 1). Served as it is: an AudioWorklet loads a
// module by its address. The page sends the frames to the relay; nothing is kept.
const OUTPUT_RATE = 16000;
const FRAME_SAMPLES = 1600;

class LiveCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is the context's: 48 or 44.1 kHz on most devices.
    this.ratio = sampleRate / OUTPUT_RATE;
    this.frame = new Int16Array(FRAME_SAMPLES);
    this.filled = 0;
    this.squares = 0;
    // The input samples that make the next output sample, averaged: a plain low-pass for speech.
    this.sum = 0;
    this.count = 0;
    this.position = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) {
      return true;
    }
    for (let index = 0; index < channel.length; index += 1) {
      this.sum += channel[index];
      this.count += 1;
      this.position += 1;
      if (this.position < this.ratio) {
        continue;
      }
      this.position -= this.ratio;
      const value = Math.max(-1, Math.min(1, this.sum / this.count));
      this.sum = 0;
      this.count = 0;
      this.frame[this.filled] = value < 0 ? value * 0x8000 : value * 0x7fff;
      this.squares += value * value;
      this.filled += 1;
      if (this.filled === FRAME_SAMPLES) {
        const level = Math.sqrt(this.squares / FRAME_SAMPLES);
        this.port.postMessage({ pcm: this.frame.buffer, level }, [
          this.frame.buffer,
        ]);
        this.frame = new Int16Array(FRAME_SAMPLES);
        this.filled = 0;
        this.squares = 0;
      }
    }
    return true;
  }
}

registerProcessor('live-capture', LiveCapture);
