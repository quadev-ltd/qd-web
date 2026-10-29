// The cover letters of the signed-in user's applications (D98), as the pages last read them, by
// application: each application's are read when its "CV and letter" tab or one of its letters
// first opens (src/core/profile/useCoverLetters.ts). Web only.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { applicationRemoved } from './applicationsSlice';
import { authStateChanged } from './sessionSlice';

import { type CoverLetter } from '@/core/profile/coverLetters';

export type CoverLettersStatus = 'loading' | 'loaded' | 'error';

export interface ApplicationLetters {
  status: CoverLettersStatus;
  /** The newest first. */
  letters: CoverLetter[];
}

export interface CoverLettersState {
  /** Whose letters these are. Another user starts from nothing. */
  uid: string | null;
  byApplication: Record<string, ApplicationLetters>;
}

export const initialCoverLettersState: CoverLettersState = {
  uid: null,
  byApplication: {},
};

const newestFirst = (a: CoverLetter, b: CoverLetter) =>
  (b.createdAt ?? 0) - (a.createdAt ?? 0);

export const coverLettersSlice = createSlice({
  name: 'coverLetters',
  initialState: initialCoverLettersState,
  reducers: {
    lettersLoadStarted: (
      state,
      {
        payload: { uid, applicationId },
      }: PayloadAction<{ uid: string; applicationId: string }>,
    ) => {
      // New objects, not the initial state's, which is frozen.
      if (state.uid !== uid) {
        state.uid = uid;
        state.byApplication = {};
      }
      const known = state.byApplication[applicationId];
      state.byApplication[applicationId] = {
        status: 'loading',
        letters: known?.letters ?? [],
      };
    },
    lettersLoaded: (
      state,
      {
        payload: { uid, applicationId, letters },
      }: PayloadAction<{
        uid: string;
        applicationId: string;
        letters: CoverLetter[];
      }>,
    ) => {
      // An answer for a user who has gone is dropped.
      if (state.uid !== uid) {
        return;
      }
      state.byApplication[applicationId] = {
        status: 'loaded',
        letters: [...letters].sort(newestFirst),
      };
    },
    lettersLoadFailed: (
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
    /** A letter was asked for, changed or read again. */
    letterChanged: (state, { payload: letter }: PayloadAction<CoverLetter>) => {
      const known = state.byApplication[letter.applicationId];
      if (known) {
        known.letters = [
          ...known.letters.filter(({ id }) => id !== letter.id),
          letter,
        ].sort(newestFirst);
      }
    },
    letterRemoved: (
      state,
      {
        payload: { applicationId, letterId },
      }: PayloadAction<{ applicationId: string; letterId: string }>,
    ) => {
      const known = state.byApplication[applicationId];
      if (known) {
        known.letters = known.letters.filter(({ id }) => id !== letterId);
      }
    },
  },
  extraReducers: builder => {
    // The user signed out, or another one signed in: nothing of theirs is kept.
    builder.addCase(authStateChanged, (state, { payload: user }) =>
      state.uid !== null && user?.uid !== state.uid
        ? initialCoverLettersState
        : state,
    );
    // An application's letters go with it.
    builder.addCase(applicationRemoved, (state, { payload: applicationId }) => {
      delete state.byApplication[applicationId];
    });
  },
});

export const {
  lettersLoadStarted,
  lettersLoaded,
  lettersLoadFailed,
  letterChanged,
  letterRemoved,
} = coverLettersSlice.actions;

export default coverLettersSlice.reducer;
