import {
  createBrowserRouter,
  Outlet,
  type RouteObject,
  ScrollRestoration,
} from 'react-router';

import { HOME_PATH, SignedInRoutes, SignedOutRoutes } from './guards';

import { env } from '@/core/env';
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

// Registered only when env.ACCOUNT_ENABLED is on. While it is off (production, until the
// account backend is connected) these paths show the Not found page.
// Each screen is loaded on demand (`lazy`), so the public pages do not download the account
// screens, and a build with the flag off never requests them.
const accountRoutes: RouteObject[] = [
  {
    element: <SignedOutRoutes />,
    children: [
      {
        path: '/sign-in',
        lazy: async () => ({
          Component: (await import('@/screens/SignIn/SignInScreen'))
            .SignInScreen,
        }),
      },
      {
        path: '/sign-up',
        lazy: async () => ({
          Component: (await import('@/screens/SignUp/SignUpScreen'))
            .SignUpScreen,
        }),
      },
    ],
  },
  {
    element: <SignedInRoutes />,
    children: [
      {
        path: HOME_PATH,
        lazy: async () => ({
          Component: (await import('@/screens/Home/HomeScreen')).HomeScreen,
        }),
      },
    ],
  },
  // For everyone: a signed-out visitor who forgot the password, and a signed-in user who
  // wants to change it (the link on the signed-in home).
  {
    path: '/forgot-password',
    lazy: async () => ({
      Component: (await import('@/screens/ForgotPassword/ForgotPasswordScreen'))
        .ForgotPasswordScreen,
    }),
  },
];

export const createRoutes = (
  accountEnabled: boolean = env.ACCOUNT_ENABLED,
): RouteObject[] => [
  {
    element: <RootLayout />,
    errorElement: <ErrorScreen />,
    children: [
      { path: '/', element: <PublicHomeScreen /> },
      { path: '/privacy-policy', element: <PrivacyPolicyScreen /> },
      { path: '/terms-and-conditions', element: <TermsAndConditionsScreen /> },
      { path: '/delete-account', element: <DeleteAccountInfoScreen /> },
      ...(accountEnabled ? accountRoutes : []),
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
];

export const createRouter = () => createBrowserRouter(createRoutes());
