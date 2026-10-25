// The interviews of the signed-in user's applications (D89), as the pages last read them, by
// application: each application's are read when its Interviews tab or one of them first opens
// (src/core/profile/useInterviews.ts). Web only.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { applicationRemoved } from './applicationsSlice';
import { authStateChanged } from './sessionSlice';

import { type ApplicationInterview } from '@/core/profile/interviews';

export type InterviewsStatus = 'loading' | 'loaded' | 'error';

export interface ApplicationInterviews {
  status: InterviewsStatus;
  /** The earliest first. */
  interviews: ApplicationInterview[];
}

export interface InterviewsState {
  /** Whose interviews these are. Another user starts from nothing. */
  uid: string | null;
  byApplication: Record<string, ApplicationInterviews>;
}

export const initialInterviewsState: InterviewsState = {
  uid: null,
  byApplication: {},
};

const earliestFirst = (a: ApplicationInterview, b: ApplicationInterview) =>
  a.startsAt - b.startsAt;

export const interviewsSlice = createSlice({
  name: 'interviews',
  initialState: initialInterviewsState,
  reducers: {
    /** A read of one application's interviews started, for this user. */
    interviewsLoadStarted: (
      state,
      {
        payload: { uid, applicationId },
      }: PayloadAction<{ uid: string; applicationId: string }>,
    ) => {
      if (state.uid !== uid) {
        Object.assign(state, initialInterviewsState, { uid });
      }
      const known = state.byApplication[applicationId];
      state.byApplication[applicationId] = {
        status: 'loading',
        interviews: known?.interviews ?? [],
      };
    },
    interviewsLoaded: (
      state,
      {
        payload: { uid, applicationId, interviews },
      }: PayloadAction<{
        uid: string;
        applicationId: string;
        interviews: ApplicationInterview[];
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== uid) {
        return;
      }
      state.byApplication[applicationId] = {
        status: 'loaded',
        interviews: [...interviews].sort(earliestFirst),
      };
    },
    interviewsLoadFailed: (
      state,
      {
        payload: { uid, applicationId },
      }: PayloadAction<{ uid: string; applicationId: string }>,
    ) => {
      const known = state.byApplication[applicationId];
      if (state.uid === uid && known) {
        known.status = 'error';
      }
    },
    /** An interview was added or changed, and read again. */
    interviewChanged: (
      state,
      {
        payload: { applicationId, interview },
      }: PayloadAction<{
        applicationId: string;
        interview: ApplicationInterview;
      }>,
    ) => {
      const known = state.byApplication[applicationId];
      if (known) {
        known.interviews = [
          ...known.interviews.filter(({ id }) => id !== interview.id),
          interview,
        ].sort(earliestFirst);
      }
    },
    interviewRemoved: (
      state,
      {
        payload: { applicationId, interviewId },
      }: PayloadAction<{ applicationId: string; interviewId: string }>,
    ) => {
      const known = state.byApplication[applicationId];
      if (known) {
        known.interviews = known.interviews.filter(
          ({ id }) => id !== interviewId,
        );
      }
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of theirs is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialInterviewsState
        : state,
    );
    // An application's interviews go with it.
    builder.addCase(applicationRemoved, (state, { payload: applicationId }) => {
      delete state.byApplication[applicationId];
    });
  },
});

export const {
  interviewsLoadStarted,
  interviewsLoaded,
  interviewsLoadFailed,
  interviewChanged,
  interviewRemoved,
} = interviewsSlice.actions;

export default interviewsSlice.reducer;
