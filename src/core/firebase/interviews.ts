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
import { usageDayPath } from '@/core/profile/contract';
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
  WRITE_INTERVIEW_QUESTIONS,
  WriteInterviewQuestionsResponseSchema,
} from '@/core/profile/interviews';
import { USAGE_SERVICES } from '@/core/profile/usageLimits';

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): ApplicationInterview[] => {
  const parsed = documents.map(document => {
    const data = document.data() ?? {};
    const questions = data.questions as DocumentData | undefined;
    return ApplicationInterviewSchema.safeParse({
      ...data,
      id: document.id,
      startsAt: millis(data.startsAt),
      createdAt: millis(data.createdAt),
      updatedAt: millis(data.updatedAt),
      ...(questions
        ? { questions: { ...questions, builtAt: millis(questions.builtAt) } }
        : {}),
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

/**
 * Writes an interview's likely questions (D94): one model call, 5 to 15 seconds, a minute at most.
 * The list is then on the interview (`getInterview`); a failed attempt changes nothing.
 */
export const writeInterviewQuestions = async (
  applicationId: string,
  interviewId: string,
): Promise<{ questions: number }> => {
  const { questions } = await call(
    WRITE_INTERVIEW_QUESTIONS,
    WriteInterviewQuestionsResponseSchema,
    { applicationId, interviewId },
  );
  return { questions };
};

/** How many lists of likely questions the backend wrote for this user today (UTC). */
export const getInterviewQuestionsToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown =
      snapshot.data()?.services?.[USAGE_SERVICES.interviewQuestions]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
