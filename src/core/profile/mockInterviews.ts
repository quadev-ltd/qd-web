// Mock interviews (D100, research doc 24): an AI interviewer asks the questions of one interview,
// spoken, and the candidate answers by voice. Slice 1's way is "take turns": the question is
// played with the microphone off, the answer is recorded until "I'm done" and sent in the call
// itself, never stored; the next line comes back with its audio. The session keeps each question
// as asked and the answer as text, for 12 months (D24). A copy of quadev-backend's
// packages/shared/src/mockInterview.ts at 5ab5f7e (10 Nov 2026), less what the pages don't read
// (`skills`, `costUsd`, the backend's own fields); the backend applies the limits again and
// refuses what fails.
import { z } from 'zod';

import { INTERVIEW_QUESTION_KINDS, INTERVIEW_TYPES } from './interviews';
import { type PracticeKeyPoint, PracticeKeyPointSchema } from './practice';

// ---------- Limits ----------

/** Sessions one account keeps (`session-limit`): the candidate removes old ones in Sessions. */
export const MOCK_SESSIONS_MAX = 200;
/** An answer is sent for the candidate at 3 minutes; the page warns 30 seconds before. */
export const MOCK_ANSWER_MAX_MS = 180_000;
export const MOCK_ANSWER_WARN_MS = 150_000;
/** What the recorder asks for: 3 minutes stay near 0.7 MB in both formats. */
export const MOCK_AUDIO_BITS_PER_SECOND = 32_000;
/** "Anything else?" on the feedback card. */
export const MOCK_FEEDBACK_COMMENT_MAX_CHARS = 1_000;
/** A session not updated for this long is shown as not finished: the backend ends it at its next call. */
export const MOCK_IDLE_MS = 30 * 60_000;
/** How long the retention runs after the session last changed (D24). */
export const MOCK_RETENTION_MONTHS = 12;

export const MOCK_WAYS = ['take-turns', 'real-time', 'voice-model'] as const;
export type MockWay = (typeof MOCK_WAYS)[number];
/** The ways built so far: the setup offers only these. */
export const MOCK_WAYS_BUILT: readonly MockWay[] = ['take-turns'];

export const MOCK_LENGTHS = [10, 20] as const;
export type MockLength = (typeof MOCK_LENGTHS)[number];

/** "Voice 1" and "Voice 2" in the setup; the voices' names wait for the backend's check. */
export const MOCK_VOICES = ['gemini', 'chirp'] as const;
export type MockVoice = (typeof MOCK_VOICES)[number];

export const MOCK_SESSION_STATUSES = ['active', 'ended'] as const;
export const MOCK_END_REASONS = [
  /** The plan is done, or the time is up. */
  'finished',
  /** The candidate ended it. */
  'ended',
  /** No call for 30 minutes, or paused for longer. */
  'timed-out',
  /** The day's cost limit was reached mid-session. */
  'quota',
  /** The model failed twice in a row. */
  'failed',
] as const;
export type MockEndReason = (typeof MOCK_END_REASONS)[number];

export const MOCK_LINE_KINDS = [
  'opening',
  'question',
  'follow-up',
  'rephrase',
  'closing',
] as const;
export type MockLineKind = (typeof MOCK_LINE_KINDS)[number];

/**
 * When the page shows a question's hints (FR-22, slice H1): with the question, when the candidate
 * asks (the default), or once they've answered. The backend writes them for every question
 * whatever is chosen; the choice only changes what the page shows.
 */
export const MOCK_HINTS_SHOWN = [
  'with-question',
  'on-request',
  'after-answer',
] as const;
export type MockHintsShown = (typeof MOCK_HINTS_SHOWN)[number];
export const DEFAULT_MOCK_HINTS_SHOWN: MockHintsShown = 'on-request';

export const MOCK_FEEL = [1, 2, 3, 4, 5] as const;
export const MOCK_WAIT = ['ok', 'a-bit-long', 'too-long'] as const;
export const MOCK_CUT_OFF = ['no', 'once', 'more'] as const;
export const MOCK_HEADPHONES = ['yes', 'no', 'unknown'] as const;

/** `details.reason` of the mock interview callables' refusals. */
export const MockRefusal = {
  /** The session ended (finished, ended, timed out, failed or out of quota). */
  SessionEnded: 'session-ended',
  /** The model failed again on this line: the session ended as `failed`. */
  SessionFailed: 'session-failed',
  /** The account keeps MOCK_SESSIONS_MAX sessions. */
  SessionLimit: 'session-limit',
  /** Only `take-turns` is built. */
  WayNotBuilt: 'way-not-built',
  /** The line no longer waits for an answer, and the request is not the one that answered it. */
  NotCurrent: 'not-current',
  /** Another call is working on the session: retry after a second with the same `requestId`. */
  Busy: 'busy',
  /** No words in the recording: the question stays open. */
  NothingHeard: 'nothing-heard',
  /** Feedback before the session ended. */
  NotEnded: 'not-ended',
  AudioType: 'audio-type',
  AudioTooBig: 'audio-too-big',
  AnswerTooLong: 'answer-too-long',
} as const;

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const MOCK_SESSIONS_COLLECTION = 'mockSessions';

export const mockSessionsPath = (uid: string, sessionId?: string) =>
  `users/${uid}/${MOCK_SESSIONS_COLLECTION}${sessionId === undefined ? '' : `/${sessionId}`}`;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);
const optionalTimestamp = z.number().optional().catch(undefined);
const optionalText = z.string().min(1).optional().catch(undefined);
const count = z.number().int().nonnegative().catch(0);

/** A list whose items that can't be read are left out, rather than the whole document. */
const listOf = <T extends z.ZodType>(schema: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform(items =>
      items.flatMap(item => {
        const parsed = schema.safeParse(item);
        return parsed.success ? [parsed.data as z.infer<T>] : [];
      }),
    );

/** One question of the plan, in the order the interviewer asks them. */
export const MockPlanQuestionSchema = z.object({
  /** `p1`, `p2`, … */
  id: z.string().min(1),
  text: z.string().min(1),
  /** The other wording, for "Say it differently". */
  rephrased: z.string().catch(''),
  kind: z.enum(INTERVIEW_QUESTION_KINDS).catch('role'),
});
export type MockPlanQuestion = z.infer<typeof MockPlanQuestionSchema>;

/** How the line after an answer or a skip was made, and what the browser reported of it. */
export const MockWaitSchema = z.object({
  after: z.enum(['answer', 'skip']).catch('answer'),
  serverMs: optionalTimestamp,
  firstSoundMs: optionalTimestamp,
});

/** One question asked: planned, or a follow-up of the planned one before it. */
export const MockTurnSchema = z.object({
  /** `t1`, `t2`, … */
  id: z.string().min(1),
  kind: z.enum(['planned', 'follow-up']).catch('planned'),
  /** The plan question it belongs to; a follow-up's is its question's. */
  planId: z.string().catch(''),
  /** As first asked; `rephrased` once "Say it differently" was asked. */
  question: z.string().min(1),
  rephrased: optionalText,
  status: z.enum(['open', 'answered', 'skipped']).catch('open'),
  answer: z
    .object({
      transcript: z.string(),
      spokenMs: count,
      words: count,
    })
    .optional()
    .catch(undefined),
  wait: MockWaitSchema.optional().catch(undefined),
  repeats: count,
  askedAt: timestamp,
  answeredAt: timestamp,
});
export type MockTurn = z.infer<typeof MockTurnSchema>;

/**
 * One question's hints, written in the background: a planned question's from the start, a
 * follow-up's once it is asked. 3 to 5 key points, as text practice's (with `itemId`, that skill
 * map item's fact; without, advice).
 */
export const MockHintsSchema = z.object({
  status: z.enum(['writing', 'ready', 'failed']),
  keyPoints: z
    .array(z.unknown())
    .catch([])
    .optional()
    .transform(points =>
      (points ?? []).flatMap(point => {
        const parsed = PracticeKeyPointSchema.safeParse(point);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  /** With `failed`: `model`, or `quota` once the day's $2 is reached. */
  reason: z.enum(['model', 'quota']).optional().catch(undefined),
});
export type MockHints = z.infer<typeof MockHintsSchema>;

export const MockFeedbackSchema = z.object({
  feel: z.number().int().min(1).max(5),
  wait: z.enum(MOCK_WAIT),
  cutOff: z.enum(MOCK_CUT_OFF).optional().catch(undefined),
  comment: optionalText,
});
export type MockFeedback = z.infer<typeof MockFeedbackSchema>;

/** `users/{uid}/mockSessions/{sessionId}`. */
export const MockSessionSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  /** The application's names when it started, to show once it is gone. */
  application: z
    .object({ title: optionalText, company: optionalText })
    .catch({}),
  applicationRemoved: z.literal(true).optional().catch(undefined),
  interviewId: optionalText,
  interview: z
    .object({
      name: optionalText,
      type: z.enum(INTERVIEW_TYPES).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  interviewRemoved: z.literal(true).optional().catch(undefined),
  way: z.enum(MOCK_WAYS).catch('take-turns'),
  lengthMinutes: z.union([z.literal(10), z.literal(20)]).catch(10),
  voice: z.enum(MOCK_VOICES).catch('gemini'),
  /** A session started before hints (slice H1) shows them on request. */
  hintsShown: z.enum(MOCK_HINTS_SHOWN).catch(DEFAULT_MOCK_HINTS_SHOWN),
  /** By `mockHintsKey`: `p1`… for planned questions, `t5`… for follow-ups. */
  hints: z
    .record(z.string(), z.unknown())
    .catch({})
    .optional()
    .transform(entries =>
      Object.fromEntries(
        Object.entries(entries ?? {}).flatMap(([key, entry]) => {
          const parsed = MockHintsSchema.safeParse(entry);
          return parsed.success ? [[key, parsed.data]] : [];
        }),
      ),
    ),
  status: z.enum(MOCK_SESSION_STATUSES),
  endReason: z.enum(MOCK_END_REASONS).optional().catch(undefined),
  plan: z
    .object({ questions: listOf(MockPlanQuestionSchema) })
    .catch({ questions: [] }),
  turns: listOf(MockTurnSchema),
  /** The line waiting for an answer while `active`. */
  current: z
    .object({ turnId: z.string().min(1), lineId: z.string().min(1) })
    .optional()
    .catch(undefined),
  startedAt: timestamp,
  endedAt: timestamp,
  pausedAt: timestamp,
  pausedMs: count,
  feedback: MockFeedbackSchema.optional().catch(undefined),
  createdAt: timestamp,
  /** Moves with every call: Sessions orders by it, and an active session idle for 30 minutes is not finished. */
  updatedAt: timestamp,
});
export type MockSession = z.infer<typeof MockSessionSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const START_MOCK_INTERVIEW = 'startMockInterview';
export const ANSWER_MOCK_QUESTION = 'answerMockQuestion';
export const REPHRASE_MOCK_QUESTION = 'rephraseMockQuestion';
export const SKIP_MOCK_QUESTION = 'skipMockQuestion';
export const PAUSE_MOCK_INTERVIEW = 'pauseMockInterview';
export const RESUME_MOCK_INTERVIEW = 'resumeMockInterview';
export const END_MOCK_INTERVIEW = 'endMockInterview';
export const SEND_MOCK_FEEDBACK = 'sendMockFeedback';
export const REMOVE_MOCK_SESSION = 'removeMockSession';

/** What the browser measured of one line it played, sent with the next call (§13.5). */
export interface MockPlayed {
  lineId: string;
  /** From "I'm done", Skip or "Say it differently" to the line's first sound. */
  firstSoundMs?: number;
  /** From the call's response to the first sound. */
  startMs?: number;
  /** The browser held the sound back until a tap. */
  tapped?: boolean;
  /** Played again with Repeat. */
  repeats?: number;
}

/** The browser, its system and a guess at headphones; never the devices' labels. */
export interface MockClient {
  browser: string;
  os: string;
  headphones: (typeof MOCK_HEADPHONES)[number];
}

export interface MockAudio {
  /** `audio/webm` or `audio/mp4` as recorded, a `;codecs=…` part allowed. */
  mimeType: string;
  base64: string;
  durationMs: number;
}

export interface StartMockInterviewRequest {
  /** A UUID per press, reused for "Try again". */
  requestId: string;
  applicationId: string;
  interviewId?: string;
  way: MockWay;
  lengthMinutes: MockLength;
  voice: MockVoice;
  /** `on-request` when left out. */
  hints?: MockHintsShown;
  client?: MockClient;
}

export interface AnswerMockQuestionRequest {
  requestId: string;
  sessionId: string;
  lineId: string;
  audio: MockAudio;
  played?: MockPlayed[];
}

/** "Say it differently" and Skip. */
export interface MockLineRequest {
  requestId: string;
  sessionId: string;
  lineId: string;
  played?: MockPlayed[];
}

export interface PauseMockInterviewRequest {
  sessionId: string;
  paused: boolean;
  played?: MockPlayed[];
}

export interface SendMockFeedbackRequest {
  sessionId: string;
  feel: number;
  wait: (typeof MOCK_WAIT)[number];
  /** Not asked on take turns. */
  cutOff?: (typeof MOCK_CUT_OFF)[number];
  comment?: string;
}

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** What the interviewer says: shown, and played in order. The audio is kept by nobody. */
export const MockLineSchema = z.object({
  lineId: z.string().min(1),
  kind: z.enum(MOCK_LINE_KINDS),
  turnId: z.string().min(1).optional(),
  text: z.string().min(1),
  audio: z.object({
    mimeType: z.string().min(1),
    base64: z.string().min(1),
    durationMs: z.number().nonnegative(),
  }),
});
export type MockLine = z.infer<typeof MockLineSchema>;

const timeLeftMs = z.number().catch(0);

export const StartMockInterviewResponseSchema = z.object({
  sessionId: documentId,
  lines: z.array(MockLineSchema).min(1),
  timeLeftMs,
});
export const AnswerMockQuestionResponseSchema = z.object({
  sessionId: documentId,
  turnId: z.string().min(1),
  transcript: z.string(),
  lines: z.array(MockLineSchema).min(1),
  status: z.enum(MOCK_SESSION_STATUSES),
  timeLeftMs,
});
export const RephraseMockQuestionResponseSchema = z.object({
  sessionId: documentId,
  lines: z.array(MockLineSchema).min(1),
});
export const SkipMockQuestionResponseSchema = z.object({
  sessionId: documentId,
  lines: z.array(MockLineSchema).min(1),
  status: z.enum(MOCK_SESSION_STATUSES),
  timeLeftMs,
});
export const PauseMockInterviewResponseSchema = z.object({
  sessionId: documentId,
  paused: z.boolean(),
  timeLeftMs,
});
export const ResumeMockInterviewResponseSchema = z.object({
  sessionId: documentId,
  lines: z.array(MockLineSchema).min(1),
  paused: z.boolean(),
  timeLeftMs,
});
export const EndMockInterviewResponseSchema = z.object({
  sessionId: documentId,
  status: z.literal('ended'),
});
export const MockSessionIdResponseSchema = z.object({
  sessionId: documentId,
});

/** The lines of a call and what follows them, as the pages use them. */
export interface MockLines {
  lines: MockLine[];
  /** `ended` once the closing line is among them. */
  status: (typeof MOCK_SESSION_STATUSES)[number];
  /** Absent when the call doesn't say ("Say it differently"). */
  timeLeftMs?: number;
}

// ---------- What the pages work out ----------

/** Where a turn's hints are kept: its plan question for a planned turn, itself for a follow-up. */
export const mockHintsKey = (
  turn: Pick<MockTurn, 'kind' | 'planId' | 'id'>,
): string => (turn.kind === 'planned' ? turn.planId : turn.id);

/** What there is to show of a question's hints: the points, nothing this time, or not yet. */
export type MockHintsState =
  | { status: 'ready'; keyPoints: PracticeKeyPoint[] }
  | { status: 'none' }
  | { status: 'pending' };

/**
 * A turn's hints as the page shows them: pending while they're written (or before the session
 * read has the turn), none when they failed or came back empty.
 */
export const mockHintsOf = (
  session: Pick<MockSession, 'turns' | 'hints'>,
  turnId: string,
): MockHintsState => {
  const turn = session.turns.find(({ id }) => id === turnId);
  const hints = turn ? session.hints[mockHintsKey(turn)] : undefined;
  if (!hints || hints.status === 'writing') {
    return { status: 'pending' };
  }
  return hints.status === 'ready' && hints.keyPoints.length > 0
    ? { status: 'ready', keyPoints: hints.keyPoints }
    : { status: 'none' };
};

/** A session still `active` but not updated for 30 minutes: the backend ends it at its next call. */
export const isMockIdle = (session: MockSession, now: number): boolean =>
  session.status === 'active' &&
  session.updatedAt !== null &&
  now - session.updatedAt > MOCK_IDLE_MS;

/**
 * "Question 3 of 5": the planned question a turn belongs to, by its place in the plan (a
 * follow-up keeps its question's number), and how many the plan has.
 */
export const mockProgress = (
  session: Pick<MockSession, 'plan' | 'turns'>,
  turnId: string | undefined,
): { number: number; of: number } | null => {
  const of = session.plan.questions.length;
  const turn = session.turns.find(({ id }) => id === turnId);
  const index = turn
    ? session.plan.questions.findIndex(({ id }) => id === turn.planId)
    : -1;
  return of > 0 && index >= 0 ? { number: index + 1, of } : null;
};
