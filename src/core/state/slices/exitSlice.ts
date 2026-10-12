// Web only (the app has no equivalent: it shows a toast and its navigator has one landing
// screen). How the user leaves the signed-in pages: where the route guards send them when the
// session ends, and the confirmation shown on the public home after the account was deleted.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { authStateChanged } from './sessionSlice';

export interface ExitState {
  /**
   * Where the route guards send the user when the session ends. `null` is the default (the
   * public home). Set before signing out, because the guard reacts to the end of the session
   * before the code that asked for the sign-out continues.
   */
  signedOutPath: string | null;
  /** The account was just deleted: the public home says so until the user leaves it. */
  accountDeleted: boolean;
}

export const initialExitState: ExitState = {
  signedOutPath: null,
  accountDeleted: false,
};

export const exitSlice = createSlice({
  name: 'exit',
  initialState: initialExitState,
  reducers: {
    signedOutPathChosen: (state, action: PayloadAction<string | null>) => {
      state.signedOutPath = action.payload;
    },
    accountDeleted: state => {
      state.accountDeleted = true;
    },
    accountDeletedNoticeCleared: state => {
      state.accountDeleted = false;
    },
  },
  extraReducers: builder => {
    // A new session starts from a clean slate.
    builder.addCase(authStateChanged, (state, action) =>
      action.payload ? initialExitState : state,
    );
  },
});

export const {
  signedOutPathChosen,
  accountDeleted,
  accountDeletedNoticeCleared,
} = exitSlice.actions;
