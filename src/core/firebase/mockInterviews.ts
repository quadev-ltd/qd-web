// Mock interviews (D100) through Firebase: the owner's sessions read with Firestore Lite and the
// callables of quadev-backend's `interview-profile` codebase. The contract is in
// src/core/profile/mockInterviews.ts. Sessions orders by one field and the counts filter on one,
// so no read needs a composite index. The audio of an answer goes in the call and is kept nowhere.
import {
  collection,
  doc,
  type DocumentData,
  getCount,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore/lite';

import { db } from './app';
import { call, mapped, millis } from './interviewProfile';

import logger from '@/core/logger';
import { usageDayPath } from '@/core/profile/contract';
import {
  ANSWER_MOCK_QUESTION,
  type AnswerMockQuestionRequest,
  AnswerMockQuestionResponseSchema,
  END_MOCK_INTERVIEW,
  EndMockInterviewResponseSchema,
  type MockLineRequest,
  type MockLines,
  type MockPlayed,
  type MockSession,
  MockSessionIdResponseSchema,
  MockSessionSchema,
  mockSessionsPath,
  PAUSE_MOCK_INTERVIEW,
  type PauseMockInterviewRequest,
  PauseMockInterviewResponseSchema,
  REMOVE_MOCK_SESSION,
  REPHRASE_MOCK_QUESTION,
  RephraseMockQuestionResponseSchema,
  RESUME_MOCK_INTERVIEW,
  ResumeMockInterviewResponseSchema,
  SEND_MOCK_FEEDBACK,
  type SendMockFeedbackRequest,
  SKIP_MOCK_QUESTION,
  SkipMockQuestionResponseSchema,
  START_MOCK_INTERVIEW,
  type StartMockInterviewRequest,
  StartMockInterviewResponseSchema,
} from '@/core/profile/mockInterviews';
import { USAGE_SERVICES } from '@/core/profile/usageLimits';

/** A turn with its Timestamps in milliseconds. */
const turnWithDates = (turn: unknown) =>
  turn && typeof turn === 'object'
    ? {
        ...turn,
        askedAt: millis((turn as DocumentData).askedAt),
        answeredAt: millis((turn as DocumentData).answeredAt),
      }
    : turn;

/** The ones that match the contract; one that does not is counted in the log, never shown. */
const parse = (
  operation: string,
  documents: { id: string; data(): DocumentData | undefined }[],
): MockSession[] => {
  const parsed = documents.map(document => {
    const data = document.data() ?? {};
    return MockSessionSchema.safeParse({
      ...data,
      id: document.id,
      turns: Array.isArray(data.turns)
        ? data.turns.map(turnWithDates)
        : data.turns,
      startedAt: millis(data.startedAt),
      endedAt: millis(data.endedAt),
      pausedAt: millis(data.pausedAt),
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

/** Every mock interview of the user (200 at most), the most recently changed first: Sessions. */
export const getMockSessions = (uid: string): Promise<MockSession[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), mockSessionsPath(uid)),
        orderBy('updatedAt', 'desc'),
      ),
    );
    return parse('getMockSessions', snapshot.docs);
  });

export const getMockSession = (
  uid: string,
  sessionId: string,
): Promise<MockSession | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), mockSessionsPath(uid, sessionId)));
    return snapshot.exists()
      ? (parse('getMockSession', [snapshot])[0] ?? null)
      : null;
  });

/** How many mock interviews the account keeps: a count, not a read of each. */
export const countMockSessions = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getCount(collection(db(), mockSessionsPath(uid)));
    return snapshot.data().count;
  });

/** How many mock interviews one application has (D99). */
export const countApplicationMockSessions = (
  uid: string,
  applicationId: string,
): Promise<number> =>
  mapped(async () => {
    const snapshot = await getCount(
      query(
        collection(db(), mockSessionsPath(uid)),
        where('applicationId', '==', applicationId),
      ),
    );
    return snapshot.data().count;
  });

/**
 * Starts a mock interview: the backend writes its plan and voices the opening and the first
 * question (5 to 15 seconds). Nothing is stored when it fails.
 */
export const startMockInterview = async (
  request: StartMockInterviewRequest,
): Promise<{ sessionId: string } & MockLines> => {
  const { sessionId, lines, timeLeftMs } = await call(
    START_MOCK_INTERVIEW,
    StartMockInterviewResponseSchema,
    request,
  );
  return { sessionId, lines, status: 'active', timeLeftMs };
};

/** Sends a recorded answer (the upload, then 2 to 5 seconds): the next line comes back voiced. */
export const answerMockQuestion = async (
  request: AnswerMockQuestionRequest,
): Promise<{ turnId: string; transcript: string } & MockLines> => {
  const { turnId, transcript, lines, status, timeLeftMs } = await call(
    ANSWER_MOCK_QUESTION,
    AnswerMockQuestionResponseSchema,
    request,
  );
  return { turnId, transcript, lines, status, timeLeftMs };
};

export const rephraseMockQuestion = async (
  request: MockLineRequest,
): Promise<MockLines> => {
  const { lines } = await call(
    REPHRASE_MOCK_QUESTION,
    RephraseMockQuestionResponseSchema,
    request,
  );
  return { lines, status: 'active' };
};

export const skipMockQuestion = async (
  request: MockLineRequest,
): Promise<MockLines> => {
  const { lines, status, timeLeftMs } = await call(
    SKIP_MOCK_QUESTION,
    SkipMockQuestionResponseSchema,
    request,
  );
  return { lines, status, timeLeftMs };
};

export const pauseMockInterview = async (
  request: PauseMockInterviewRequest,
): Promise<{ paused: boolean; timeLeftMs: number }> => {
  const { paused, timeLeftMs } = await call(
    PAUSE_MOCK_INTERVIEW,
    PauseMockInterviewResponseSchema,
    request,
  );
  return { paused, timeLeftMs };
};

export const resumeMockInterview = async (
  sessionId: string,
): Promise<MockLines & { paused: boolean }> => {
  const { lines, paused, timeLeftMs } = await call(
    RESUME_MOCK_INTERVIEW,
    ResumeMockInterviewResponseSchema,
    { sessionId },
  );
  return { lines, status: 'active', paused, timeLeftMs };
};

export const endMockInterview = async (
  sessionId: string,
  played?: MockPlayed[],
): Promise<void> => {
  await call(END_MOCK_INTERVIEW, EndMockInterviewResponseSchema, {
    sessionId,
    ...(played && played.length > 0 ? { played } : {}),
  });
};

export const sendMockFeedback = async (
  request: SendMockFeedbackRequest,
): Promise<void> => {
  await call(SEND_MOCK_FEEDBACK, MockSessionIdResponseSchema, request);
};

export const removeMockSession = async (sessionId: string): Promise<void> => {
  await call(REMOVE_MOCK_SESSION, MockSessionIdResponseSchema, { sessionId });
};

/** How many mock interviews were started today (UTC): the service counts sessions, not calls. */
export const getMockInterviewsToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown =
      snapshot.data()?.services?.[USAGE_SERVICES.mockInterview]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });
