// Cover letters (D98) through Firebase: the owner's letters read with Firestore Lite and the
// callables of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/coverLetters.ts. An application's letters are read by equality, with no index.
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
  type CoverLetter,
  CoverLetterCreatingResponseSchema,
  CoverLetterResponseSchema,
  CoverLetterSchema,
  coverLettersPath,
  CREATE_COVER_LETTER,
  type CreateCoverLetterRequest,
  MARK_COVER_LETTER_SENT,
  MarkCoverLetterSentResponseSchema,
  REMOVE_COVER_LETTER,
} from '@/core/profile/coverLetters';
import { USAGE_SERVICES } from '@/core/profile/usageLimits';

/** A Timestamp that may be absent, in milliseconds; absent stays absent. */
const optionalMillis = (value: unknown) =>
  value === undefined ? undefined : millis(value);

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): CoverLetter[] => {
  const parsed = documents.map(document => {
    const data = document.data() ?? {};
    return CoverLetterSchema.safeParse({
      ...data,
      id: document.id,
      createdAt: millis(data.createdAt),
      updatedAt: millis(data.updatedAt),
      readyAt: optionalMillis(data.readyAt),
      sentAt: optionalMillis(data.sentAt),
      savedAt: optionalMillis(data.savedAt),
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

/** The letters of one application, in no order: the page sorts them. */
export const getApplicationLetters = (
  uid: string,
  applicationId: string,
): Promise<CoverLetter[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), coverLettersPath(uid)),
        where('applicationId', '==', applicationId),
      ),
    );
    return parse('getApplicationLetters', snapshot.docs);
  });

export const getCoverLetter = (
  uid: string,
  letterId: string,
): Promise<CoverLetter | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), coverLettersPath(uid, letterId)));
    return snapshot.exists()
      ? (parse('getCoverLetter', [snapshot])[0] ?? null)
      : null;
  });

/**
 * Asks for a letter: stored as `creating` at once and written in the background (under a minute),
 * then `ready` or `failed`. Resolves its id; follow the letter's document.
 */
export const createCoverLetter = async (
  request: CreateCoverLetterRequest,
): Promise<{ letterId: string }> => {
  const { letterId } = await call(
    CREATE_COVER_LETTER,
    CoverLetterCreatingResponseSchema,
    request,
  );
  return { letterId };
};

/** "Mark as sent", or not: an application has one letter sent at most. */
export const markCoverLetterSent = async (
  letterId: string,
  sent: boolean,
): Promise<void> => {
  await call(MARK_COVER_LETTER_SENT, MarkCoverLetterSentResponseSchema, {
    letterId,
    sent,
  });
};

export const removeCoverLetter = async (letterId: string): Promise<void> => {
  await call(REMOVE_COVER_LETTER, CoverLetterResponseSchema, { letterId });
};

/** How many letters the backend wrote for this user today (UTC). */
export const getCoverLettersToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown =
      snapshot.data()?.services?.[USAGE_SERVICES.coverLetter]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
