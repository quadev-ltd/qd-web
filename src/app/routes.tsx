import {
  createBrowserRouter,
  Outlet,
  type RouteObject,
  ScrollRestoration,
} from 'react-router';

import DeleteAccountInfoScreen from '@/screens/DeleteAccountInfo/DeleteAccountInfoScreen';
import ErrorScreen from '@/screens/Error/ErrorScreen';
import NotFoundScreen from '@/screens/NotFound/NotFoundScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicy/PrivacyPolicyScreen';
import PublicHomeScreen from '@/screens/PublicHome/PublicHomeScreen';
import TermsAndConditionsScreen from '@/screens/TermsAndConditions/TermsAndConditionsScreen';

// Every page starts at the top; going back restores the previous scroll position.
const RootLayout: React.FC = () => (
  <>
    <Outlet />
    <ScrollRestoration />
  </>
);

// The account routes (/sign-in, /sign-up, /forgot-password, /home) are added with
// the account screens, and only when env.ACCOUNT_ENABLED is on. Until then those
// paths show the Not found page.
export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <ErrorScreen />,
    children: [
      { path: '/', element: <PublicHomeScreen /> },
      { path: '/privacy-policy', element: <PrivacyPolicyScreen /> },
      { path: '/terms-and-conditions', element: <TermsAndConditionsScreen /> },
      { path: '/delete-account', element: <DeleteAccountInfoScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];

export const createRouter = () => createBrowserRouter(routes);
