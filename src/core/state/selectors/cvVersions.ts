import { type RootState } from '../store';

export const selectCvVersions = (state: RootState) => state.cvVersions;
