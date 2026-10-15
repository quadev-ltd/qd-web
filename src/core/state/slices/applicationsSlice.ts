// The job applications of the signed-in user, as the pages last read them (delivery 2a), with
// the profile's revision that tells whether a brief is out of date. Web only. The application
// pages keep it in step with the profile gateway (src/core/profile/ApplicationsProvider.tsx).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

import { type JobApplication } from '@/core/profile/applications';

export type ApplicationsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ApplicationsState {
  /** Whose applications these are. Another user starts from nothing. */
  uid: string | null;
  status: ApplicationsStatus;
  /** The most recently changed first. */
  applications: JobApplication[];
  /** The profile's revision when they were read; `null` when it could not be read. */
  profileRevision: number | null;
}

export const initialApplicationsState: ApplicationsState = {
  uid: null,
  status: 'idle',
  applications: [],
  profileRevision: null,
};

const latestFirst = (a: JobApplication, b: JobApplication) =>
  (b.updatedAt ?? b.createdAt ?? Number.MAX_SAFE_INTEGER) -
  (a.updatedAt ?? a.createdAt ?? Number.MAX_SAFE_INTEGER);

export const applicationsSlice = createSlice({
  name: 'applications',
  initialState: initialApplicationsState,
  reducers: {
    /** A read of the applications started, for this user. */
    applicationsLoadStarted: (
      state,
      { payload: uid }: PayloadAction<string>,
    ) => {
      if (state.uid !== uid) {
        Object.assign(state, initialApplicationsState, { uid });
      }
      state.status = 'loading';
    },
    applicationsLoaded: (
      state,
      {
        payload,
      }: PayloadAction<{
        uid: string;
        applications: JobApplication[];
        profileRevision: number | null;
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== payload.uid) {
        return;
      }
      state.status = 'loaded';
      state.applications = [...payload.applications].sort(latestFirst);
      state.profileRevision = payload.profileRevision;
    },
    applicationsLoadFailed: (
      state,
      { payload: uid }: PayloadAction<string>,
    ) => {
      if (state.uid === uid) {
        state.status = 'error';
      }
    },
    /** An application was added, changed, or read again. */
    applicationChanged: (state, { payload }: PayloadAction<JobApplication>) => {
      state.applications = [
        payload,
        ...state.applications.filter(({ id }) => id !== payload.id),
      ].sort(latestFirst);
    },
    /** The profile's revision was read again, after a resource was added or removed. */
    profileRevisionRead: (state, { payload }: PayloadAction<number>) => {
      state.profileRevision = payload;
    },
    applicationRemoved: (state, { payload: id }: PayloadAction<string>) => {
      state.applications = state.applications.filter(
        application => application.id !== id,
      );
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of theirs is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialApplicationsState
        : state,
    );
  },
});

export const {
  applicationsLoadStarted,
  applicationsLoaded,
  applicationsLoadFailed,
  applicationChanged,
  applicationRemoved,
  profileRevisionRead,
} = applicationsSlice.actions;

export default applicationsSlice.reducer;
