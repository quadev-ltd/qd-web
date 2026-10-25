// The interviews of an application (D89) through Firebase: the owner's documents read with
// Firestore Lite and the callables of quadev-backend's `interview-profile` codebase. The contract
// is in src/core/profile/interviews.ts.
import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore/lite';

import { db } from './app';
import { call, mapped, millis } from './interviewProfile';

import logger from '@/core/logger';
import {
  type ApplicationInterview,
  ApplicationInterviewSchema,
  CREATE_APPLICATION_INTERVIEW,
  type CreateInterviewRequest,
  CreateInterviewResponseSchema,
  interviewsPath,
  REMOVE_APPLICATION_INTERVIEW,
  RemoveInterviewResponseSchema,
  UPDATE_APPLICATION_INTERVIEW,
  type UpdateInterviewRequest,
  UpdateInterviewResponseSchema,
} from '@/core/profile/interviews';

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): ApplicationInterview[] => {
  const parsed = documents.map(document => {
    const data = document.data() ?? {};
    return ApplicationInterviewSchema.safeParse({
      ...data,
      id: document.id,
      startsAt: millis(data.startsAt),
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

/** The interviews of one application, the earliest first. */
export const getInterviews = (
  uid: string,
  applicationId: string,
): Promise<ApplicationInterview[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), interviewsPath(uid, applicationId)),
        orderBy('startsAt'),
      ),
    );
    return parse('getInterviews', snapshot.docs);
  });

export const getInterview = (
  uid: string,
  applicationId: string,
  interviewId: string,
): Promise<ApplicationInterview | null> =>
  mapped(async () => {
    const snapshot = await getDoc(
      doc(db(), interviewsPath(uid, applicationId, interviewId)),
    );
    return snapshot.exists()
      ? (parse('getInterview', [snapshot])[0] ?? null)
      : null;
  });

export const createInterview = async (
  request: CreateInterviewRequest,
): Promise<{ interviewId: string }> => {
  const { interviewId } = await call(
    CREATE_APPLICATION_INTERVIEW,
    CreateInterviewResponseSchema,
    request,
  );
  return { interviewId };
};

export const updateInterview = async (
  request: UpdateInterviewRequest,
): Promise<{ revision: number }> => {
  const { revision } = await call(
    UPDATE_APPLICATION_INTERVIEW,
    UpdateInterviewResponseSchema,
    request,
  );
  return { revision };
};

export const removeInterview = async (
  applicationId: string,
  interviewId: string,
): Promise<void> => {
  await call(REMOVE_APPLICATION_INTERVIEW, RemoveInterviewResponseSchema, {
    applicationId,
    interviewId,
  });
};
