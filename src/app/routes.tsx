import { useEffect } from 'react';
import {
  createBrowserRouter,
  Outlet,
  type RouteObject,
  ScrollRestoration,
  useLocation,
} from 'react-router';

import {
  CompleteProfileRoutes,
  SignedInRoutes,
  SignedOutRoutes,
  VerifyEmailRoutes,
} from './guards';

import {
  COMPLETE_PROFILE_PATH,
  DELETE_ACCOUNT_PATH,
  HOME_PATH,
  SIGN_IN_PATH,
  VERIFY_EMAIL_PATH,
} from '@/core/auth/paths';
import { env } from '@/core/env';
import {
  PROFILE_PATH,
  RESOURCE_PATH,
  SKILL_MAP_ITEM_PATH,
} from '@/core/profile/paths';
import { useAppDispatch } from '@/core/state/hooks';
import { accountDeletedNoticeCleared } from '@/core/state/slices/exitSlice';
import DeleteAccountInfoScreen from '@/screens/DeleteAccountInfo/DeleteAccountInfoScreen';
import ErrorScreen from '@/screens/Error/ErrorScreen';
import NotFoundScreen from '@/screens/NotFound/NotFoundScreen';
import PrivacyPolicyScreen from '@/screens/PrivacyPolicy/PrivacyPolicyScreen';
import PublicHomeScreen from '@/screens/PublicHome/PublicHomeScreen';
import TermsAndConditionsScreen from '@/screens/TermsAndConditions/TermsAndConditionsScreen';

// Every page starts at the top; going back restores the previous scroll position.
const RootLayout: React.FC = () => {
  const dispatch = useAppDispatch();
  const { pathname } = useLocation();

  // "Your account was deleted" is said on the public home, once: it is forgotten when the
  // user opens another page. Only the path decides (not the notice itself), because the
  // notice can arrive while the delete-account page is still the current one.
  useEffect(() => {
    if (pathname !== '/') {
      dispatch(accountDeletedNoticeCleared());
    }
  }, [dispatch, pathname]);

  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  );
};

// Registered only when env.ACCOUNT_ENABLED is on. While it is off (production, until the
// account backend is connected) these paths show the Not found page.
// Each screen is loaded on demand (`lazy`), so the public pages do not download the account
// screens, and a build with the flag off never requests them.
const accountRoutes: RouteObject[] = [
  {
    element: <SignedOutRoutes />,
    children: [
      {
        path: SIGN_IN_PATH,
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
      {
        path: DELETE_ACCOUNT_PATH,
        lazy: async () => ({
          Component: (
            await import('@/screens/DeleteAccount/DeleteAccountScreen')
          ).DeleteAccountScreen,
        }),
      },
      // The interview profile. Its routes say "not available" to an account without the
      // interviewAssistant flag, so the addresses work for everyone who is signed in.
      {
        lazy: async () => ({
          Component: (await import('@/screens/Profile/ProfileRoutes'))
            .ProfileRoutes,
        }),
        children: [
          {
            path: PROFILE_PATH,
            lazy: async () => ({
              Component: (await import('@/screens/Profile/ProfileScreen'))
                .ProfileScreen,
            }),
          },
          {
            path: RESOURCE_PATH,
            lazy: async () => ({
              Component: (
                await import('@/screens/Profile/Resource/ResourceScreen')
              ).ResourceScreen,
            }),
          },
          // The skill map, and one item of it: the same page, so the search and the
          // filters stay as they are while items are opened.
          {
            path: SKILL_MAP_ITEM_PATH,
            lazy: async () => ({
              Component: (
                await import('@/screens/Profile/SkillMap/SkillMapScreen')
              ).SkillMapScreen,
            }),
          },
        ],
      },
    ],
  },
  // The two steps between signing in and the signed-in pages, as in the app's onboarding
  // stack: each is open only to a user whose session is at that step.
  {
    element: <VerifyEmailRoutes />,
    children: [
      {
        path: VERIFY_EMAIL_PATH,
        lazy: async () => ({
          Component: (await import('@/screens/VerifyEmail/VerifyEmailScreen'))
            .VerifyEmailScreen,
        }),
      },
    ],
  },
  {
    element: <CompleteProfileRoutes />,
    children: [
      {
        path: COMPLETE_PROFILE_PATH,
        lazy: async () => ({
          Component: (
            await import('@/screens/CompleteProfile/CompleteProfileScreen')
          ).CompleteProfileScreen,
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
