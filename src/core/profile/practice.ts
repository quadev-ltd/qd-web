// Text practice (D94, research doc 21 §3): the candidate practises one question at a time. A turn
// holds the question and the 3 to 5 key points the profile gives for it and, from the backend's
// slice 3, the candidate's typed answers with their feedback. Turns are under the user, not the
// application: removing an application or an interview keeps them, marked as removed, until the
// candidate removes them (D99) or they are 12 months old (D24). The names, limits and checks are
// quadev-backend's packages/shared/src/practiceTurn.ts (as of 4ae7328); the backend applies them
// again and refuses what fails.
import { z } from 'zod';

import { INTERVIEW_QUESTION_KINDS, INTERVIEW_TYPES } from './interviews';

// ---------- Limits ----------

/** An account holds this many turns at most (`turn-limit`): the candidate removes old ones. */
export const PRACTICE_TURNS_MAX = 500;
/** A question of the candidate's own: as long as a question of an interview's list. */
export const PRACTICE_QUESTION_MAX_CHARS = 300;
/** How long a turn is kept after it was last practised (D24). */
export const PRACTICE_RETENTION_MONTHS = 12;

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
  /** The answers with their feedback: from the backend's slice 3. Only counted until then. */
  attempts: z.array(z.unknown()).catch([]),
  createdAt: timestamp,
  /** Moves with each answer: the newest is the turn "Practise again" opens. */
  updatedAt: timestamp,
});
export type PracticeTurn = z.infer<typeof PracticeTurnSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const START_PRACTICE_TURN = 'startPracticeTurn';
export const REMOVE_PRACTICE_TURN = 'removePracticeTurn';

/** The question to practise: typed, one of an interview's list, or one of the brief's. */
export type PracticeQuestionRequest =
  | { source: 'typed'; text: string }
  /** `listId` is left out only for a list that has none: the call then gives it one. */
  | { source: 'interview'; listId?: string; questionId: string }
  | { source: 'brief'; text: string };

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
export const RemovePracticeTurnResponseSchema = z.object({
  turnId: documentId,
});

// ---------- What the pages work out ----------

/** Where a question's turn stands on a page: the newest turn, which "Practise again" opens. */
export interface PracticeMark {
  turnId: string;
  /** Answers given: 0 until the backend's slice 3. */
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
