// The interviews of one application (D89), kept in the `interviews` slice: read through the
// profile gateway the first time the application's Interviews tab, or one of them, opens in a
// session; the pages then change them only through the backend's callables, and read again
// what they changed.
import { useCallback, useEffect } from 'react';

import { useApplicationsActions } from './ApplicationsProvider';
import { logProfileError } from './errors';
import { useProfileGateway } from './ProfileGatewayProvider';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectInterviews } from '@/core/state/selectors/interviews';
import {
  interviewChanged,
  interviewRemoved,
  interviewsLoaded,
  interviewsLoadFailed,
  interviewsLoadStarted,
  type InterviewsStatus,
  questionsWritingEnded,
  questionsWritingStarted,
} from '@/core/state/slices/interviewsSlice';

export const useInterviews = (applicationId: string) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const { refreshApplication } = useApplicationsActions();
  const uid = useSessionUser()?.uid ?? null;
  const state = useAppSelector(selectInterviews);
  const known =
    uid !== null && state.uid === uid
      ? state.byApplication[applicationId]
      : undefined;

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(interviewsLoadStarted({ uid, applicationId }));
    try {
      const interviews = await gateway.getInterviews(uid, applicationId);
      dispatch(interviewsLoaded({ uid, applicationId, interviews }));
    } catch (error) {
      logProfileError('getInterviews', error, uid);
      dispatch(interviewsLoadFailed({ uid, applicationId }));
    }
  }, [applicationId, dispatch, gateway, uid]);

  const loaded = known !== undefined;
  useEffect(() => {
    if (uid && !loaded) {
      reload();
    }
    // Once per application and user: the store keeps them for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, applicationId]);

  /**
   * After a change: reads the interview again into the list (out of it when it is gone), and
   * the application, whose `interviewTimes` the list of applications shows.
   */
  const refresh = useCallback(
    async (interviewId: string) => {
      if (!uid) {
        return;
      }
      try {
        const interview = await gateway.getInterview(
          uid,
          applicationId,
          interviewId,
        );
        dispatch(
          interview
            ? interviewChanged({ applicationId, interview })
            : interviewRemoved({ applicationId, interviewId }),
        );
      } catch {
        // What is on screen stays until the next read.
      }
      await refreshApplication(applicationId).catch(() => null);
    },
    [applicationId, dispatch, gateway, refreshApplication, uid],
  );

  /** After "Remove": out of the list, and the application read again. */
  const removed = useCallback(
    async (interviewId: string) => {
      dispatch(interviewRemoved({ applicationId, interviewId }));
      await refreshApplication(applicationId).catch(() => null);
    },
    [applicationId, dispatch, refreshApplication],
  );

  /**
   * Writes an interview's likely questions (D94), then reads the interview again. Rejects with
   * the backend's refusal; the interview is marked as being written meanwhile.
   */
  const writeQuestions = useCallback(
    async (interviewId: string) => {
      dispatch(questionsWritingStarted(interviewId));
      try {
        await gateway.writeInterviewQuestions(applicationId, interviewId);
        await refresh(interviewId);
      } finally {
        dispatch(questionsWritingEnded(interviewId));
      }
    },
    [applicationId, dispatch, gateway, refresh],
  );

  const status: InterviewsStatus = known?.status ?? 'loading';
  return {
    status,
    interviews: known?.interviews ?? [],
    writingQuestions: state.writingQuestions,
    reload,
    refresh,
    removed,
    writeQuestions,
  };
};

export default useInterviews;
