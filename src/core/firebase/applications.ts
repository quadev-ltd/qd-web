// Job applications through Firebase: the owner's documents read with Firestore Lite and the
// callables of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/applications.ts.
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
import {
  applicationsPath,
  BRIEF_SERVICE,
  CREATE_JOB_APPLICATION,
  type CreateJobApplicationRequest,
  CreateJobApplicationResponseSchema,
  type JobApplication,
  JobApplicationSchema,
  PREPARE_APPLICATION_BRIEF,
  PrepareApplicationBriefResponseSchema,
  REMOVE_JOB_APPLICATION,
  RemoveJobApplicationResponseSchema,
  UPDATE_JOB_APPLICATION,
  type UpdateJobApplicationRequest,
  UpdateJobApplicationResponseSchema,
} from '@/core/profile/applications';
import { interviewProfilePath, usageDayPath } from '@/core/profile/contract';
import { type UploadTarget } from '@/core/profile/gateway';

/** An application as the contract reads it: every Firestore Timestamp in milliseconds. */
const withDates = (id: string, data: DocumentData) => {
  const brief = data.brief as DocumentData | undefined;
  const job = data.job as DocumentData | undefined;
  return {
    ...data,
    id,
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    ...(brief ? { brief: { ...brief, builtAt: millis(brief.builtAt) } } : {}),
    ...(job ? { job: { ...job, takenAt: millis(job.takenAt) } } : {}),
  };
};

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): JobApplication[] => {
  const parsed = documents.map(document =>
    JobApplicationSchema.safeParse(
      withDates(document.id, document.data() ?? {}),
    ),
  );
  const rejected = parsed.filter(result => !result.success).length;
  if (rejected > 0) {
    logger().logError(
      new Error(`${operation}: ${rejected} document(s) not understood`),
    );
  }
  return parsed.flatMap(result => (result.success ? [result.data] : []));
};

/**
 * The applications, the most recently changed first. Sorted here: at 50 at most, an index of
 * the backend's for it is not worth having.
 */
export const getApplications = (uid: string): Promise<JobApplication[]> =>
  mapped(async () => {
    const snapshot = await getDocs(collection(db(), applicationsPath(uid)));
    return parse('getApplications', snapshot.docs).sort(
      (a, b) =>
        (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
    );
  });

export const getApplication = (
  uid: string,
  applicationId: string,
): Promise<JobApplication | null> =>
  mapped(async () => {
    const snapshot = await getDoc(
      doc(db(), applicationsPath(uid, applicationId)),
    );
    return snapshot.exists()
      ? (parse('getApplication', [snapshot])[0] ?? null)
      : null;
  });

export const getProfileRevision = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), interviewProfilePath(uid)));
    const revision: unknown = snapshot.data()?.revision;
    return typeof revision === 'number' && revision > 0 ? revision : 0;
  });

export const createApplication = (
  request: CreateJobApplicationRequest,
): Promise<{ applicationId: string; upload?: UploadTarget }> =>
  call(CREATE_JOB_APPLICATION, CreateJobApplicationResponseSchema, request);

export const updateApplication = async (
  request: UpdateJobApplicationRequest,
): Promise<{ revision: number }> => {
  const { revision } = await call(
    UPDATE_JOB_APPLICATION,
    UpdateJobApplicationResponseSchema,
    request,
  );
  return { revision };
};

export const removeApplication = async (
  applicationId: string,
): Promise<void> => {
  await call(REMOVE_JOB_APPLICATION, RemoveJobApplicationResponseSchema, {
    applicationId,
  });
};

export const prepareBrief = async (applicationId: string): Promise<void> => {
  await call(PREPARE_APPLICATION_BRIEF, PrepareApplicationBriefResponseSchema, {
    applicationId,
  });
};

/** How many briefs the backend prepared for this user today (UTC). */
export const getBriefsToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown = snapshot.data()?.services?.[BRIEF_SERVICE]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
