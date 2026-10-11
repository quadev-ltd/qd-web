// Mirrors qd-mobile src/core/state/store.ts (without the API slice, which the web does not have).
import { combineReducers, configureStore } from '@reduxjs/toolkit';

import { sessionSlice } from './slices/sessionSlice';

// No persistence: the auth gateway keeps the session.
export const rootReducer = combineReducers({
  [sessionSlice.reducerPath]: sessionSlice.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const createStore = (preloadedState?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState,
  });

export type AppStore = ReturnType<typeof createStore>;
export type AppDispatch = AppStore['dispatch'];
