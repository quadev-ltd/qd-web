// Mirrors qd-mobile src/core/state/store.ts (without the API slice, which the web does not have;
// the `exit`, `interviewProfile` and `applications` slices are web only).
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { applicationsSlice } from './slices/applicationsSlice';
import { exitSlice } from './slices/exitSlice';
import { interviewProfileSlice } from './slices/interviewProfileSlice';
import { sessionSlice } from './slices/sessionSlice';

// No persistence: the auth gateway keeps the session, and the profile is read again.
export const rootReducer = combineReducers({
  [sessionSlice.reducerPath]: sessionSlice.reducer,
  [exitSlice.reducerPath]: exitSlice.reducer,
  [interviewProfileSlice.reducerPath]: interviewProfileSlice.reducer,
  [applicationsSlice.reducerPath]: applicationsSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const createStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];
