// The CV versions of the signed-in user, as the pages last read them (delivery 2b). Web only.
// The CV pages keep it in step with the profile gateway (src/core/profile/CvVersionsProvider.tsx).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

import { type CvDetails } from '@/core/profile/cvDetails';
import { type CvVersion } from '@/core/profile/cvVersions';
import { type UsageLimits } from '@/core/profile/usageLimits';

export type CvVersionsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface CvVersionsState {
  /** Whose versions these are. Another user starts from nothing. */
  uid: string | null;
  status: CvVersionsStatus;
  /** The newest first. */
  versions: CvVersion[];
  /** How many were made today, for "4 of 5 left today"; `null` until it is read. */
  madeToday: number | null;
  /** The user's overrides of the daily limits (`usageLimits/{uid}`); `null` for the defaults. */
  limits: UsageLimits | null;
  /** The CV's details (doc 19 §3.1), read apart: when they can't be, the versions still show. */
  detailsStatus: CvVersionsStatus;
  /** `null` while no field is filled. */
  details: CvDetails | null;
}

export const initialCvVersionsState: CvVersionsState = {
  uid: null,
  status: 'idle',
  versions: [],
  madeToday: null,
  limits: null,
  detailsStatus: 'idle',
  details: null,
};

const newestFirst = (a: CvVersion, b: CvVersion) =>
  (b.createdAt ?? Number.MAX_SAFE_INTEGER) -
  (a.createdAt ?? Number.MAX_SAFE_INTEGER);

export const cvVersionsSlice = createSlice({
  name: 'cvVersions',
  initialState: initialCvVersionsState,
  reducers: {
    /** A read of the versions started, for this user. */
    cvVersionsLoadStarted: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid !== uid) {
        Object.assign(state, initialCvVersionsState, { uid });
      }
      state.status = 'loading';
    },
    cvVersionsLoaded: (
      state,
      {
        payload,
      }: PayloadAction<{
        uid: string;
        versions: CvVersion[];
        madeToday: number | null;
        limits?: UsageLimits | null;
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== payload.uid) {
        return;
      }
      state.status = 'loaded';
      state.versions = [...payload.versions].sort(newestFirst);
      state.madeToday = payload.madeToday;
      state.limits = payload.limits ?? null;
    },
    cvVersionsLoadFailed: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid === uid) {
        state.status = 'error';
      }
    },
    /** A version was made, changed, or read again. */
    cvVersionChanged: (state, { payload }: PayloadAction<CvVersion>) => {
      state.versions = [
        payload,
        ...state.versions.filter(({ id }) => id !== payload.id),
      ].sort(newestFirst);
    },
    cvVersionRemoved: (state, { payload: id }: PayloadAction<string>) => {
      state.versions = state.versions.filter(version => version.id !== id);
    },
    /** Today's count was read again, after a version was made, with the user's limits. */
    cvVersionsTodayRead: (
      state,
      {
        payload,
      }: PayloadAction<
        number | { madeToday: number; limits: UsageLimits | null }
      >,
    ) => {
      if (typeof payload === 'number') {
        state.madeToday = payload;
      } else {
        state.madeToday = payload.madeToday;
        state.limits = payload.limits;
      }
    },
    /** A read of the CV's details started, for this user. */
    cvDetailsLoadStarted: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid !== uid) {
        Object.assign(state, initialCvVersionsState, { uid });
      }
      state.detailsStatus = 'loading';
    },
    cvDetailsLoaded: (
      state,
      { payload }: PayloadAction<{ uid: string; details: CvDetails | null }>,
    ) => {
      if (state.uid !== payload.uid) {
        return;
      }
      state.detailsStatus = 'loaded';
      state.details = payload.details;
    },
    cvDetailsLoadFailed: (state, { payload: uid }: PayloadAction<string>) => {
      if (state.uid === uid) {
        state.detailsStatus = 'error';
      }
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of theirs is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialCvVersionsState
        : state,
    );
  },
});

export const {
  cvVersionsLoadStarted,
  cvVersionsLoaded,
  cvVersionsLoadFailed,
  cvVersionChanged,
  cvVersionRemoved,
  cvVersionsTodayRead,
  cvDetailsLoadStarted,
  cvDetailsLoaded,
  cvDetailsLoadFailed,
} = cvVersionsSlice.actions;

export default cvVersionsSlice.reducer;
