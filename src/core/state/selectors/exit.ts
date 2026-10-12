import { type RootState } from '../store';

export const selectSignedOutPath = (state: RootState) =>
  state.exit.signedOutPath;
export const selectAccountDeleted = (state: RootState) =>
  state.exit.accountDeleted;
