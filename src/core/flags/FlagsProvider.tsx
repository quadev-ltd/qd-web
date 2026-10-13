// Mirrors qd-mobile src/core/flags/FlagsProvider.tsx: the same context, `useFlag` and
// `useFlags`, and the same order: the user's overrides, then Remote Config, then the code
// defaults. The website reads the overrides (through the auth gateway); it has no Remote
// Config client yet, so that layer is empty.
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { evaluateAll } from './evaluate';
import {
  DEFAULT_FLAGS,
  type EvaluatedFlags,
  type FlagKey,
  type FlagValues,
} from './registry';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import { logAuthError } from '@/core/auth/errors';
import { useSessionUser } from '@/core/session/hooks';

export interface FlagsState {
  flags: EvaluatedFlags;
  /**
   * False while the signed-in user's overrides are being read. Until then every flag has
   * its default (off), so a page that depends on a flag waits for this before it says
   * "not available".
   */
  ready: boolean;
}

/** Without a provider (e.g. in a test), every flag has its code default. */
export const FlagsContext = createContext<FlagsState>({
  flags: DEFAULT_FLAGS,
  ready: true,
});

const NO_OVERRIDES: FlagValues = {};
const NO_REMOTE_VALUES: FlagValues = {};

/**
 * Evaluates the feature flags for whoever is signed in. The overrides are read once per
 * user (Firestore Lite has no listener): a flag an admin changes shows the next time the
 * site is opened. If they cannot be read, the defaults apply. Mount it inside
 * SessionProvider.
 */
export const FlagsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const gateway = useAuthGateway();
  const uid = useSessionUser()?.uid ?? null;
  // What was read, and for whom: the overrides of a previous user are never applied.
  const [read, setRead] = useState<{ uid: string; overrides: FlagValues }>();

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let active = true;
    gateway.getFlagOverrides(uid).then(
      overrides => {
        if (active) {
          setRead({ uid, overrides });
        }
      },
      error => {
        logAuthError('getFlagOverrides', error, uid);
        if (active) {
          setRead({ uid, overrides: NO_OVERRIDES });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [gateway, uid]);

  const overrides = uid && read?.uid === uid ? read.overrides : undefined;
  const state = useMemo<FlagsState>(
    () => ({
      flags: evaluateAll(overrides ?? NO_OVERRIDES, NO_REMOTE_VALUES),
      ready: !uid || overrides !== undefined,
    }),
    [overrides, uid],
  );

  return (
    <FlagsContext.Provider value={state}>{children}</FlagsContext.Provider>
  );
};

/** Every flag, evaluated. */
export const useFlags = (): EvaluatedFlags => useContext(FlagsContext).flags;

/** Whether one feature flag is on for the current user. */
export const useFlag = (key: FlagKey): boolean =>
  useContext(FlagsContext).flags[key];

/** Whether the flags of the current user are known yet (see FlagsState.ready). */
export const useFlagsReady = (): boolean => useContext(FlagsContext).ready;

export default FlagsProvider;
