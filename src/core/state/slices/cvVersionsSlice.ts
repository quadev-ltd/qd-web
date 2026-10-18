// The CV versions of the signed-in user, as the pages last read them (delivery 2b). Web only.
// The CV pages keep it in step with the profile gateway (src/core/profile/CvVersionsProvider.tsx).
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

import { type CvVersion } from '@/core/profile/cvVersions';

export type CvVersionsStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface CvVersionsState {
  /** Whose versions these are. Another user starts from nothing. */
  uid: string | null;
  status: CvVersionsStatus;
  /** The newest first. */
  versions: CvVersion[];
  /** How many were made today, for "4 of 5 left today"; `null` until it is read. */
  madeToday: number | null;
}

export const initialCvVersionsState: CvVersionsState = {
  uid: null,
  status: 'idle',
  versions: [],
  madeToday: null,
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
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== payload.uid) {
        return;
      }
      state.status = 'loaded';
      state.versions = [...payload.versions].sort(newestFirst);
      state.madeToday = payload.madeToday;
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
    /** Today's count was read again, after a version was made. */
    cvVersionsTodayRead: (state, { payload }: PayloadAction<number>) => {
      state.madeToday = payload;
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
} = cvVersionsSlice.actions;

export default cvVersionsSlice.reducer;
