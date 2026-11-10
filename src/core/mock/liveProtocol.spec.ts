import {
  decodeVoiceFrame,
  encodeMicFrame,
  FRAME_HEADER_BYTES,
  lineNumber,
  parseRelayMessage,
} from './liveProtocol';

describe('the relay’s frames and messages (doc 24 §15.3, §15.4)', () => {
  it('a microphone frame: version 1, kind 1, no flags, its number, little-endian PCM', () => {
    const frame = new DataView(
      encodeMicFrame(0x0102_0304, new Int16Array([1, -2, 32_767])),
    );
    expect(frame.byteLength).toBe(FRAME_HEADER_BYTES + 6);
    expect([
      frame.getUint8(0),
      frame.getUint8(1),
      frame.getUint16(2, true),
      frame.getUint32(4, true),
    ]).toEqual([1, 1, 0, 0x0102_0304]);
    expect([
      frame.getInt16(8, true),
      frame.getInt16(10, true),
      frame.getInt16(12, true),
    ]).toEqual([1, -2, 32_767]);
  });

  it('a voice frame: its line and number, the samples -1 to 1; anything else is no frame', () => {
    const bytes = new ArrayBuffer(FRAME_HEADER_BYTES + 4);
    const view = new DataView(bytes);
    view.setUint8(0, 1);
    view.setUint8(1, 2);
    view.setUint16(2, 7, true);
    view.setUint32(4, 3, true);
    view.setInt16(8, -32_768, true);
    view.setInt16(10, 16_384, true);
    const frame = decodeVoiceFrame(bytes);
    expect(frame).toMatchObject({ line: 7, seq: 3 });
    expect([...frame!.samples]).toEqual([-1, 0.5]);

    view.setUint8(1, 1);
    expect(decodeVoiceFrame(bytes)).toBeUndefined();
    expect(decodeVoiceFrame(new ArrayBuffer(5))).toBeUndefined();
    expect(lineNumber('l12')).toBe(12);
  });

  it('reads the relay’s messages, and leaves out what it doesn’t know', () => {
    expect(
      parseRelayMessage(
        JSON.stringify({ type: 'state', state: 'listening', timeLeftMs: 5 }),
      ),
    ).toEqual({ type: 'state', state: 'listening', timeLeftMs: 5 });
    expect(
      parseRelayMessage(JSON.stringify({ type: 'state', state: 'singing' })),
    ).toBeUndefined();
    expect(parseRelayMessage('not json')).toBeUndefined();
    expect(
      parseRelayMessage(
        JSON.stringify({ type: 'error', reason: 'replaced', retry: false }),
      ),
    ).toEqual({ type: 'error', reason: 'replaced', retry: false });
  });
});
