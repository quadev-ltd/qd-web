import { useState } from 'react';
import { Navigate, Outlet } from 'react-router';

import AppLoading from '@/components/AppLoading';
import { useSessionStatus } from '@/core/session/hooks';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

// The route guards read the session status, like the switch in the mobile Router
// (qd-mobile src/screens/Routing/Router.tsx): Initializing shows the loading screen,
// SignedOut the sign-in screens, Ready the signed-in ones.
// NeedsEmailVerification and NeedsProfile have no screen on the web yet (they arrive with
// the backend); until then such a user is treated as not signed in.

/** The path of the signed-in home. */
export const HOME_PATH = '/home';

/**
 * The sign-in and sign-up routes. A user whose session is ready has nothing to do there
 * and is sent to the signed-in home.
 */
export const SignedOutRoutes: React.FC = () => {
  const status = useSessionStatus();

  if (status === SessionStatus.Initializing) {
    return <AppLoading />;
  }
  if (status === SessionStatus.Ready) {
    return <Navigate to={HOME_PATH} replace />;
  }
  return <Outlet />;
};

/**
 * The signed-in routes. A visitor who is not signed in is sent to the sign-in screen. A
 * user who signs out while on one of these pages is sent to the public home instead, as
 * the app goes back to its landing screen.
 */
export const SignedInRoutes: React.FC = () => {
  const status = useSessionStatus();
  const [wasReady, setWasReady] = useState(status === SessionStatus.Ready);

  if (status === SessionStatus.Ready && !wasReady) {
    setWasReady(true);
  }

  if (status === SessionStatus.Initializing) {
    return <AppLoading />;
  }
  if (status !== SessionStatus.Ready) {
    return <Navigate to={wasReady ? '/' : '/sign-in'} replace />;
  }
  return <Outlet />;
};
