// Mirrors qd-mobile src/core/flags/FlagsProvider.tsx: the same context, `useFlag` and
// `useFlags`. The app reads the user's overrides and Remote Config; the website has no remote
// source yet, so both are empty here and every flag has its code default.
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { evaluateAll } from './evaluate';
import {
  DEFAULT_FLAGS,
  type EvaluatedFlags,
  type FlagKey,
  type FlagValues,
} from './registry';

/** Without a provider (e.g. in a test), every flag has its code default. */
const FlagsContext = createContext<EvaluatedFlags>(DEFAULT_FLAGS);

const NO_OVERRIDES: FlagValues = {};
const NO_REMOTE_VALUES: FlagValues = {};

/**
 * Evaluates the feature flags: the user's overrides, then the remote values, then the code
 * defaults. Until the backend is connected the first two are empty. Mount it inside
 * SessionProvider (the overrides will belong to the signed-in user).
 */
export const FlagsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const flags = useMemo(() => evaluateAll(NO_OVERRIDES, NO_REMOTE_VALUES), []);

  return (
    <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>
  );
};

/** Every flag, evaluated. */
export const useFlags = (): EvaluatedFlags => useContext(FlagsContext);

/** Whether one feature flag is on for the current user. */
export const useFlag = (key: FlagKey): boolean => useContext(FlagsContext)[key];

export default FlagsProvider;
