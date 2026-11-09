// Text practice (D94, research doc 21 §3): the candidate practises one question at a time. A turn
// holds the question and the 3 to 5 key points the profile gives for it and, from the backend's
// slice 3, the candidate's typed answers with their feedback (up to 5 tries). Turns are under the
// user, not the application: removing an application or an interview keeps them, marked as
// removed, until the candidate removes them (D99) or they are 12 months old (D24). The names,
// limits and checks are quadev-backend's packages/shared/src/practiceTurn.ts (slice 3's contract,
// 9 Nov 2026); the backend applies them again and refuses what fails.
import { z } from 'zod';

import { INTERVIEW_QUESTION_KINDS, INTERVIEW_TYPES } from './interviews';

// ---------- Limits ----------

/** An account holds this many turns at most (`turn-limit`): the candidate removes old ones. */
export const PRACTICE_TURNS_MAX = 500;
/** A question of the candidate's own: as long as a question of an interview's list. */
export const PRACTICE_QUESTION_MAX_CHARS = 300;
/** How long a turn is kept after it was last practised (D24). */
export const PRACTICE_RETENTION_MONTHS = 12;
/** A typed answer, trimmed: 1 to 5,000 characters. */
export const PRACTICE_ANSWER_MAX_CHARS = 5_000;
/** Answers to one turn (`attempt-limit`): then a new turn starts with new key points. */
export const PRACTICE_ATTEMPTS_MAX = 5;

export const PRACTICE_QUESTION_SOURCES = [
  'typed',
  'interview',
  'brief',
] as const;
export type PracticeQuestionSource = (typeof PRACTICE_QUESTION_SOURCES)[number];

/** `failed-precondition` reasons of the practice calls. */
export const PracticeRefusal = {
  /** The interview's list was written again, or the brief lost the question: read the page again. */
  QuestionChanged: 'question-changed',
  /** The account holds PRACTICE_TURNS_MAX turns. */
  TurnLimit: 'turn-limit',
  /** The turn has PRACTICE_ATTEMPTS_MAX answers. */
  AttemptLimit: 'attempt-limit',
} as const;

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const PRACTICE_TURNS_COLLECTION = 'practiceTurns';

export const practiceTurnsPath = (uid: string, turnId?: string) =>
  `users/${uid}/${PRACTICE_TURNS_COLLECTION}${turnId === undefined ? '' : `/${turnId}`}`;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);
const optionalText = z.string().min(1).optional().catch(undefined);

/** One point to cover in the answer. With `itemId` it is that skill map item's fact; without, advice. */
export const PracticeKeyPointSchema = z.object({
  text: z.string().min(1),
  itemId: optionalText,
});
export type PracticeKeyPoint = z.infer<typeof PracticeKeyPointSchema>;

/** Lines that can't be read are left out, rather than the whole feedback. */
const lines = z
  .array(z.unknown())
  .catch([])
  .transform(items =>
    items.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    ),
  );

/**
 * Feedback on what was written: content, structure and clarity, never tone or confidence (FR-14).
 * Lines about tone are dropped by the backend, and so are the sentences of the example with a
 * number or a name that the answer, the profile, the question and the job don't give.
 */
export const PracticeFeedbackSchema = z.object({
  /** 0 to 5: "What you covered". */
  covered: lines,
  /** 0 to 5: "What you left out". */
  missing: lines,
  structure: z.string().catch(''),
  clarity: z.string().catch(''),
  /** 1 to 3: "Try this next time". */
  suggestions: lines,
  /** "An answer built from your profile"; absent when nothing of it was kept. */
  example: optionalText,
});
export type PracticeFeedback = z.infer<typeof PracticeFeedbackSchema>;

/** One try: the answer as sent and its feedback. Its number is its place in `attempts`, from 1. */
export const PracticeAttemptSchema = z.object({
  answer: z.string(),
  feedback: PracticeFeedbackSchema,
  at: timestamp,
});
export type PracticeAttempt = z.infer<typeof PracticeAttemptSchema>;

/** `users/{uid}/practiceTurns/{turnId}`. */
export const PracticeTurnSchema = z.object({
  id: z.string().min(1),
  /** Kept after the application is removed. */
  applicationId: z.string().min(1),
  /** The application's names when the turn started, to show once it is gone. */
  application: z
    .object({ title: optionalText, company: optionalText })
    .catch({}),
  applicationRemoved: z.literal(true).optional().catch(undefined),
  interviewId: optionalText,
  /** The interview's name and type when the turn started. */
  interview: z
    .object({
      name: optionalText,
      type: z.enum(INTERVIEW_TYPES).optional().catch(undefined),
    })
    .optional()
    .catch(undefined),
  /** Its interview was removed, on its own or with its application. */
  interviewRemoved: z.literal(true).optional().catch(undefined),
  question: z.object({
    text: z.string().min(1),
    kind: z.enum(INTERVIEW_QUESTION_KINDS).catch('role'),
    source: z.enum(PRACTICE_QUESTION_SOURCES),
    /** `interview` only: the list it was practised from, and the question's id there. */
    listId: optionalText,
    questionId: optionalText,
  }),
  /** 3 to 5. One that can't be read is left out. */
  keyPoints: z
    .array(z.unknown())
    .catch([])
    .transform(points =>
      points.flatMap(point => {
        const parsed = PracticeKeyPointSchema.safeParse(point);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  /** The answers with their feedback, the first first: up to PRACTICE_ATTEMPTS_MAX. */
  attempts: z
    .array(z.unknown())
    .catch([])
    .transform(attempts =>
      attempts.flatMap(attempt => {
        const parsed = PracticeAttemptSchema.safeParse(attempt);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  createdAt: timestamp,
  /** Moves with each answer: the newest is the turn "Practise again" opens. */
  updatedAt: timestamp,
});
export type PracticeTurn = z.infer<typeof PracticeTurnSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const START_PRACTICE_TURN = 'startPracticeTurn';
export const ANSWER_PRACTICE_TURN = 'answerPracticeTurn';
export const REMOVE_PRACTICE_TURN = 'removePracticeTurn';
/** Every turn of one application (D99), whether the application is still there or not. */
export const REMOVE_APPLICATION_PRACTICE = 'removeApplicationPractice';

/** The question to practise: typed, one of an interview's list, or one of the brief's. */
export type PracticeQuestionRequest =
  | { source: 'typed'; text: string }
  /** `listId` is left out only for a list that has none: the call then gives it one. */
  | { source: 'interview'; listId?: string; questionId: string }
  | { source: 'brief'; text: string };

/** A typed answer to a turn: one model call, 5 to 15 seconds, a minute at most. */
export interface AnswerPracticeTurnRequest {
  turnId: string;
  /** Trimmed, 1 to PRACTICE_ANSWER_MAX_CHARS characters. */
  answer: string;
}

export interface StartPracticeTurnRequest {
  applicationId: string;
  /** Needed for a question of an interview's list; optional for a typed one. */
  interviewId?: string;
  question: PracticeQuestionRequest;
}

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** The turn itself is on its document; this is how many key points it has. */
export const StartPracticeTurnResponseSchema = z.object({
  applicationId: documentId,
  turnId: documentId,
  keyPoints: z.number().int().nonnegative(),
});
/** The feedback is on the turn's document, as the last of its `attempts`. */
export const AnswerPracticeTurnResponseSchema = z.object({
  turnId: documentId,
  attempts: z.number().int().positive(),
});
export const RemovePracticeTurnResponseSchema = z.object({
  turnId: documentId,
});
/** How many turns and mock interviews (D100) were removed: 0 when it had none. */
export const RemoveApplicationPracticeResponseSchema = z.object({
  applicationId: documentId,
  removed: z.number().int().nonnegative(),
  removedSessions: z.number().int().nonnegative().catch(0),
});

// ---------- What the pages work out ----------

/** Where a question's turn stands on a page: the newest turn, which "Practise again" opens. */
export interface PracticeMark {
  turnId: string;
  /** Answers given. */
  tries: number;
}

/**
 * The newest turn of each question, by `updatedAt`, as the backend says the pages read them: an
 * interview's list keyed by `questionId`, the brief's by the question's text.
 */
export const practiceMarksOf = (
  turns: PracticeTurn[],
  keyOf: (turn: PracticeTurn) => string | undefined,
): Map<string, PracticeMark> => {
  const newest = new Map<string, PracticeTurn>();
  for (const turn of turns) {
    const key = keyOf(turn);
    if (key === undefined) {
      continue;
    }
    const seen = newest.get(key);
    if (!seen || (turn.updatedAt ?? 0) > (seen.updatedAt ?? 0)) {
      newest.set(key, turn);
    }
  }
  return new Map(
    [...newest].map(([key, turn]) => [
      key,
      { turnId: turn.id, tries: turn.attempts.length },
    ]),
  );
};

/** One practice being started, so the page can say so while the key points are written. */
export const practiceStartKey = ({
  applicationId,
  interviewId,
  question,
}: StartPracticeTurnRequest): string => {
  switch (question.source) {
    case 'interview':
      return `interview/${interviewId ?? ''}/${question.questionId}`;
    case 'brief':
      return `brief/${applicationId}/${question.text}`;
    case 'typed':
      return `typed/${applicationId}/${interviewId ?? ''}`;
  }
};

/**
 * The same question asked again, for "Start again with new key points" once a turn has its 5
 * tries; `null` when it can't be asked from what the turn holds (an interview's question with no
 * list or interview to name).
 */
export const practiceRestartRequest = (
  turn: PracticeTurn,
): StartPracticeTurnRequest | null => {
  const { applicationId, interviewId, question } = turn;
  switch (question.source) {
    case 'interview':
      return interviewId && question.questionId
        ? {
            applicationId,
            interviewId,
            question: {
              source: 'interview',
              listId: question.listId,
              questionId: question.questionId,
            },
          }
        : null;
    case 'brief':
      return {
        applicationId,
        question: { source: 'brief', text: question.text },
      };
    case 'typed':
      return {
        applicationId,
        ...(interviewId ? { interviewId } : {}),
        question: { source: 'typed', text: question.text },
      };
  }
};
