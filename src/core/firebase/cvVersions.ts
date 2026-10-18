// CV versions through Firebase: the owner's documents read with Firestore Lite and the callables
// of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/cvVersions.ts.
import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
} from 'firebase/firestore/lite';

import { db } from './app';
import { call, mapped, millis } from './interviewProfile';

import logger from '@/core/logger';
import { usageDayPath } from '@/core/profile/contract';
import {
  ANSWER_CV_QUESTION,
  CREATE_CV_VERSION,
  type CreateCvVersionRequest,
  CreateCvVersionResponseSchema,
  CV_SERVICE,
  type CvChangeDecisionRequest,
  CvReviewResponseSchema,
  type CvVersion,
  CvVersionSchema,
  cvVersionsPath,
  type CvVersionStatus,
  DECIDE_CV_CHANGE,
  MARK_CV_VERSION_SENT,
  MarkCvVersionSentResponseSchema,
  REMOVE_CV_VERSION,
  RemoveCvVersionResponseSchema,
} from '@/core/profile/cvVersions';

/** A version as the contract reads it: every Firestore Timestamp in milliseconds. */
const withDates = (id: string, data: DocumentData) => ({
  ...data,
  id,
  createdAt: millis(data.createdAt),
  updatedAt: millis(data.updatedAt),
  ...(data.readyAt === undefined ? {} : { readyAt: millis(data.readyAt) }),
  ...(data.sentAt === undefined ? {} : { sentAt: millis(data.sentAt) }),
});

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): CvVersion[] => {
  const parsed = documents.map(document =>
    CvVersionSchema.safeParse(withDates(document.id, document.data() ?? {})),
  );
  const rejected = parsed.filter(result => !result.success).length;
  if (rejected > 0) {
    logger().logError(
      new Error(`${operation}: ${rejected} document(s) not understood`),
    );
  }
  return parsed.flatMap(result => (result.success ? [result.data] : []));
};

/** The versions, the newest first. Sorted here: at 50 at most, no index is worth having. */
export const getCvVersions = (uid: string): Promise<CvVersion[]> =>
  mapped(async () => {
    const snapshot = await getDocs(collection(db(), cvVersionsPath(uid)));
    return parse('getCvVersions', snapshot.docs).sort(
      (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
    );
  });

export const getCvVersion = (
  uid: string,
  versionId: string,
): Promise<CvVersion | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), cvVersionsPath(uid, versionId)));
    return snapshot.exists()
      ? (parse('getCvVersion', [snapshot])[0] ?? null)
      : null;
  });

export const createCvVersion = async (
  request: CreateCvVersionRequest,
): Promise<{ versionId: string; status: CvVersionStatus }> => {
  const { versionId, status } = await call(
    CREATE_CV_VERSION,
    CreateCvVersionResponseSchema,
    request,
  );
  return { versionId, status };
};

export const removeCvVersion = async (versionId: string): Promise<void> => {
  await call(REMOVE_CV_VERSION, RemoveCvVersionResponseSchema, { versionId });
};

export const decideCvChange = async (
  versionId: string,
  changeId: string,
  decision: CvChangeDecisionRequest,
  text?: string,
): Promise<{ open: number }> => {
  const { open } = await call(DECIDE_CV_CHANGE, CvReviewResponseSchema, {
    versionId,
    changeId,
    decision,
    ...(decision === 'edit' ? { text } : {}),
  });
  return { open };
};

export const answerCvQuestion = async (
  versionId: string,
  questionId: string,
  answer?: string,
): Promise<{ open: number }> => {
  const { open } = await call(ANSWER_CV_QUESTION, CvReviewResponseSchema, {
    versionId,
    questionId,
    ...(answer ? { answer } : {}),
  });
  return { open };
};

export const markCvVersionSent = async (
  versionId: string,
  sent: boolean,
): Promise<void> => {
  await call(MARK_CV_VERSION_SENT, MarkCvVersionSentResponseSchema, {
    versionId,
    sent,
  });
};

/** How many versions the backend made for this user today (UTC). */
export const getCvVersionsToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown = snapshot.data()?.services?.[CV_SERVICE]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
