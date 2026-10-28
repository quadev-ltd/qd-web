// Text practice (D94) through Firebase: the owner's practice turns read with Firestore Lite and
// the callables of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/practice.ts. None of the reads needs a composite index (the backend's
// docs/api.md): they filter on equality and the page picks the newest.
import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore/lite';

import { db } from './app';
import { call, mapped, millis } from './interviewProfile';

import logger from '@/core/logger';
import { usageDayPath } from '@/core/profile/contract';
import {
  type PracticeTurn,
  PracticeTurnSchema,
  practiceTurnsPath,
  REMOVE_PRACTICE_TURN,
  RemovePracticeTurnResponseSchema,
  START_PRACTICE_TURN,
  type StartPracticeTurnRequest,
  StartPracticeTurnResponseSchema,
} from '@/core/profile/practice';
import { USAGE_SERVICES } from '@/core/profile/usageLimits';

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): PracticeTurn[] => {
  const parsed = documents.map(document => {
    const data = document.data() ?? {};
    return PracticeTurnSchema.safeParse({
      ...data,
      id: document.id,
      createdAt: millis(data.createdAt),
      updatedAt: millis(data.updatedAt),
    });
  });
  const rejected = parsed.filter(result => !result.success).length;
  if (rejected > 0) {
    logger().logError(
      new Error(`${operation}: ${rejected} document(s) not understood`),
    );
  }
  return parsed.flatMap(result => (result.success ? [result.data] : []));
};

export const getPracticeTurn = (
  uid: string,
  turnId: string,
): Promise<PracticeTurn | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), practiceTurnsPath(uid, turnId)));
    return snapshot.exists()
      ? (parse('getPracticeTurn', [snapshot])[0] ?? null)
      : null;
  });

/** The turns of one list of an interview's likely questions, in no order. */
export const getListPracticeTurns = (
  uid: string,
  interviewId: string,
  listId: string,
): Promise<PracticeTurn[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), practiceTurnsPath(uid)),
        where('interviewId', '==', interviewId),
        where('question.listId', '==', listId),
      ),
    );
    return parse('getListPracticeTurns', snapshot.docs);
  });

/** The turns of an application's brief questions, in no order. */
export const getBriefPracticeTurns = (
  uid: string,
  applicationId: string,
): Promise<PracticeTurn[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), practiceTurnsPath(uid)),
        where('applicationId', '==', applicationId),
        where('question.source', '==', 'brief'),
      ),
    );
    return parse('getBriefPracticeTurns', snapshot.docs);
  });

/**
 * Starts practising a question: the backend writes its key points (one model call, 5 to 15
 * seconds, a minute at most) and stores the turn. A failed attempt stores nothing.
 */
export const startPracticeTurn = async (
  request: StartPracticeTurnRequest,
): Promise<{ turnId: string }> => {
  const { turnId } = await call(
    START_PRACTICE_TURN,
    StartPracticeTurnResponseSchema,
    request,
  );
  return { turnId };
};

export const removePracticeTurn = async (turnId: string): Promise<void> => {
  await call(REMOVE_PRACTICE_TURN, RemovePracticeTurnResponseSchema, {
    turnId,
  });
};

/** How many practice calls the backend made for this user today (UTC). */
export const getPracticeToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown =
      snapshot.data()?.services?.[USAGE_SERVICES.practice]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
