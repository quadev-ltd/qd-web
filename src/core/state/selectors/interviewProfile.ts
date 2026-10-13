import { type RootState } from '../store';

export const selectInterviewProfile = (state: RootState) =>
  state.interviewProfile;
