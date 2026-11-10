// The connection of a mock interview's real-time way (D100, research doc 24 §15): one WebSocket to
// the backend's `live-assist` relay per session. The page sends JSON messages and binary frames of
// the microphone; the relay sends JSON messages and binary frames of the interviewer's voice. A
// copy of quadev-backend's packages/live-protocol/src/index.ts at cf88e08 (10 Nov 2026), less what
// the page doesn't send or read; the relay parses what the page sends again and refuses what fails.
import { z } from 'zod';

import {
  MOCK_END_REASONS,
  MOCK_LINE_KINDS,
  MOCK_WAYS,
} from '@/core/profile/mockInterviews';

export const LIVE_PROTOCOL_VERSION = 1;

/** The microphone: 16-bit little-endian PCM, mono, 16 kHz, in frames of 100 ms (3,200 bytes). */
export const LIVE_INPUT = { sampleRate: 16_000, frameMs: 100 } as const;
export const MIC_FRAME_SAMPLES =
  (LIVE_INPUT.sampleRate * LIVE_INPUT.frameMs) / 1_000;
/** The interviewer's voice: 16-bit little-endian PCM, mono, 24 kHz. */
export const LIVE_OUTPUT = { sampleRate: 24_000 } as const;

/** The page sends `ping` this often; a socket that sent nothing for 90 seconds is closed. */
export const LIVE_PING_MS = 20_000;
/** A resume token lets an answer cut in the middle carry on, on the same server, for this long. */
export const RESUME_TOKEN_MS = 120_000;

// ---------- Binary frames: an 8-byte header, then PCM ----------
//   up (microphone):    [version u8 = 1][kind u8 = 1][flags u16 LE = 0][seq u32 LE]
//   down (interviewer): [version u8 = 1][kind u8 = 2][line u16 LE][seq u32 LE]   line: `l7` is 7

export const FRAME_HEADER_BYTES = 8;
export const FRAME_VERSION = 1;
export const FRAME_KINDS = { mic: 1, voice: 2 } as const;

/** One frame of the microphone, as sent. */
export const encodeMicFrame = (seq: number, pcm: Int16Array): ArrayBuffer => {
  const bytes = new ArrayBuffer(FRAME_HEADER_BYTES + pcm.byteLength);
  const view = new DataView(bytes);
  view.setUint8(0, FRAME_VERSION);
  view.setUint8(1, FRAME_KINDS.mic);
  view.setUint16(2, 0, true);
  view.setUint32(4, seq >>> 0, true);
  // Little-endian whatever the machine's order.
  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(FRAME_HEADER_BYTES + index * 2, pcm[index]!, true);
  }
  return bytes;
};

export interface VoiceFrame {
  /** The line's number: `l7` is 7. */
  line: number;
  seq: number;
  /** The samples, -1 to 1. */
  samples: Float32Array;
}

/** A frame of the interviewer's voice; `undefined` for anything else. */
export const decodeVoiceFrame = (data: ArrayBuffer): VoiceFrame | undefined => {
  if (
    data.byteLength < FRAME_HEADER_BYTES ||
    (data.byteLength - FRAME_HEADER_BYTES) % 2 !== 0
  ) {
    return undefined;
  }
  const view = new DataView(data);
  if (
    view.getUint8(0) !== FRAME_VERSION ||
    view.getUint8(1) !== FRAME_KINDS.voice
  ) {
    return undefined;
  }
  const count = (data.byteLength - FRAME_HEADER_BYTES) / 2;
  const samples = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    samples[index] =
      view.getInt16(FRAME_HEADER_BYTES + index * 2, true) / 0x8000;
  }
  return {
    line: view.getUint16(2, true),
    seq: view.getUint32(4, true),
    samples,
  };
};

/** The number of a line id: `l7` → 7. */
export const lineNumber = (lineId: string) => Number(lineId.slice(1));

// ---------- From the page (JSON text) ----------

export interface LiveHello {
  type: 'hello';
  version: typeof LIVE_PROTOCOL_VERSION;
  sessionId: string;
  idToken: string;
  appCheckToken: string;
  resumeToken?: string;
  client?: { browser: string; os: string; headphones: string };
}

/** The page's measures of a line it played (§13.5). */
export interface LivePlayed {
  lineId: string;
  firstSoundMs?: number;
  startMs?: number;
}

/** Each action has an id the page makes, so one sent again after a reconnect is done once. */
export type LivePageMessage =
  | { type: 'done'; id: string; lineId: string }
  | { type: 'interrupt'; id: string; lineId: string; atMs: number }
  | { type: 'rephrase'; id: string; lineId: string }
  | { type: 'skip'; id: string; lineId: string }
  | { type: 'pause'; id: string; paused: boolean }
  | { type: 'end'; id: string }
  | { type: 'played'; played: LivePlayed[] }
  | { type: 'ping'; t: number };

// ---------- From the relay (JSON text) ----------

export const LIVE_STATES = [
  'speaking',
  'listening',
  'thinking',
  'paused',
  'ended',
] as const;
export type LiveState = (typeof LIVE_STATES)[number];

export const LIVE_ERRORS = [
  'auth',
  'app-check',
  'flag',
  'no-session',
  'session-ended',
  'way-mismatch',
  'replaced',
  'quota',
  'busy',
  'internal',
  /** The first message was not a valid `hello`, or came late. */
  'hello',
] as const;
export type LiveError = (typeof LIVE_ERRORS)[number];

/** How an answer ended: a pause noticed, "I'm done", or 3 minutes. */
export const LIVE_ANSWER_ENDS = ['pause', 'done', 'time'] as const;

const lineId = z.string().regex(/^l[1-9]\d{0,3}$/);
const ms = z.number().int().nonnegative();

export const LiveRelayMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ready'),
    sessionId: z.string().min(1),
    way: z.enum(MOCK_WAYS),
    resumeToken: z.string(),
    timeLeftMs: ms,
    paused: z.boolean(),
  }),
  /** The interviewer starts a line; its audio follows. */
  z.object({
    type: z.literal('line'),
    lineId,
    kind: z.enum(MOCK_LINE_KINDS),
    turnId: z.string().min(1).optional(),
    text: z.string(),
  }),
  /** All of the line's audio is sent. */
  z.object({
    type: z.literal('lineEnd'),
    lineId,
    text: z.string(),
    durationMs: ms,
  }),
  /** What the page shows; `timeLeftMs` sets its clock again. */
  z.object({
    type: z.literal('state'),
    state: z.enum(LIVE_STATES),
    timeLeftMs: ms.optional(),
  }),
  /** The answer's words as they are written down. */
  z.object({
    type: z.literal('heard'),
    turnId: z.string(),
    text: z.string(),
    final: z.boolean(),
  }),
  z.object({
    type: z.literal('answerEnd'),
    turnId: z.string(),
    reason: z.enum(LIVE_ANSWER_ENDS),
  }),
  /** `answer-time`: 30 seconds of the answer left. `nothing-heard`: "I'm done" with no words; still listening. */
  z.object({
    type: z.literal('notice'),
    kind: z.enum(['answer-time', 'nothing-heard']),
    leftMs: ms.optional(),
  }),
  /** `voice-model`: the model stopped speaking because it heard the candidate. */
  z.object({ type: z.literal('interrupted'), lineId }),
  z.object({ type: z.literal('ended'), endReason: z.enum(MOCK_END_REASONS) }),
  /** The relay is going away: connect again at once, with the token. */
  z.object({ type: z.literal('reconnect'), resumeToken: z.string() }),
  z.object({
    type: z.literal('error'),
    reason: z.enum(LIVE_ERRORS),
    retry: z.boolean(),
  }),
  z.object({ type: z.literal('pong'), t: z.number() }),
]);
export type LiveRelayMessage = z.infer<typeof LiveRelayMessageSchema>;

/** A message from the relay, or `undefined` when it isn't one this page knows. */
export const parseRelayMessage = (
  text: string,
): LiveRelayMessage | undefined => {
  try {
    const parsed = LiveRelayMessageSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The socket, as the page uses it: the browser's WebSocket in the Firebase gateway, the preview's
 * fake relay in the preview. Binary messages come as ArrayBuffers.
 */
export interface LiveSocket {
  send(data: string | ArrayBuffer): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((data: string | ArrayBuffer) => void) | null;
  onclose: ((event: { code: number }) => void) | null;
}

/** What the relay needs in `hello` to know the page and its user. */
export interface LiveTokens {
  idToken: string;
  appCheckToken: string;
}
