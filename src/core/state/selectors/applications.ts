import { type RootState } from '../store';

export const selectApplications = (state: RootState) => state.applications;
