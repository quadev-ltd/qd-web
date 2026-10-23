import { useState } from 'react';
import { Navigate, Outlet } from 'react-router';

import AppLoading from '@/components/AppLoading';
import {
  COMPLETE_PROFILE_PATH,
  HOME_PATH,
  SIGN_IN_PATH,
  VERIFY_EMAIL_PATH,
} from '@/core/auth/paths';
import { useSessionStatus } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectSignedOutPath } from '@/core/state/selectors/exit';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

// The route guards read the session status, like the switch in the mobile Router
// (qd-mobile src/screens/Routing/Router.tsx): Initializing shows the loading screen,
// SignedOut the sign-in screens, NeedsEmailVerification the verify-email screen,
// NeedsProfile the complete-profile screen and Ready the signed-in ones. On the web every
// screen has its own address, so a user who opens the address of another status is sent to
// the one that matches theirs.

/** The page a session in this status belongs on; nothing for a visitor who is not signed in. */
const pathFor = (status: SessionStatus): string | undefined => {
  switch (status) {
    case SessionStatus.NeedsEmailVerification:
      return VERIFY_EMAIL_PATH;
    case SessionStatus.NeedsProfile:
      return COMPLETE_PROFILE_PATH;
    case SessionStatus.Ready:
      // The home sends an account with the interview tools on to its applications (D85).
      return HOME_PATH;
    default:
      return undefined;
  }
};

/**
 * The sign-in and sign-up routes. A user who is signed in has nothing to do there and is
 * sent to the page of their status (after an email sign-up, that is the verify-email page).
 */
export const SignedOutRoutes: React.FC = () => {
  const status = useSessionStatus();
  const path = pathFor(status);

  if (status === SessionStatus.Initializing) {
    return <AppLoading />;
  }
  if (path) {
    return <Navigate to={path} replace />;
  }
  return <Outlet />;
};

interface SessionRoutesProps {
  /** The only status these routes are for. */
  status: SessionStatus;
}

/**
 * Routes for one session status. A user in another status is sent to the page of theirs,
 * and a visitor who is not signed in to the sign-in screen. A user who signs out (or deletes
 * the account) while on one of these pages is sent to the public home instead, as the app
 * goes back to its landing screen, unless the page chose another place (`signedOutPath`).
 */
const SessionRoutes: React.FC<SessionRoutesProps> = ({ status: expected }) => {
  const status = useSessionStatus();
  const signedOutPath = useAppSelector(selectSignedOutPath);
  const [wasHere, setWasHere] = useState(status === expected);

  if (status === expected && !wasHere) {
    setWasHere(true);
  }

  if (status === SessionStatus.Initializing) {
    return <AppLoading />;
  }
  if (status === expected) {
    return <Outlet />;
  }
  if (status === SessionStatus.SignedOut) {
    return (
      <Navigate to={wasHere ? (signedOutPath ?? '/') : SIGN_IN_PATH} replace />
    );
  }
  return <Navigate to={pathFor(status) ?? SIGN_IN_PATH} replace />;
};

/** The signed-in routes: the home and the pages of the account. */
export const SignedInRoutes: React.FC = () => (
  <SessionRoutes status={SessionStatus.Ready} />
);

/** The verify-email route: for a signed-in user whose email is not verified yet. */
export const VerifyEmailRoutes: React.FC = () => (
  <SessionRoutes status={SessionStatus.NeedsEmailVerification} />
);

/** The complete-profile route: for a signed-in user whose profile has no names yet. */
export const CompleteProfileRoutes: React.FC = () => (
  <SessionRoutes status={SessionStatus.NeedsProfile} />
);
