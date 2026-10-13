import { type ReactElement } from 'react';

import { createMockProfileGateway } from './mockProfileGateway';
import { renderWithProviders } from './renderWithProviders';

import { type SessionUser } from '@/core/auth/types';
import { InterviewProfileProvider } from '@/core/profile/InterviewProfileProvider';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

export const PROFILE_TEST_USER: SessionUser = {
  uid: 'uid-1',
  email: 'maya@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
};

interface Options {
  gateway?: ReturnType<typeof createMockProfileGateway>;
  /** The profile as already read; left out, the page reads it through the gateway. */
  interviewProfile?: Partial<InterviewProfileState>;
  route?: string;
  /** Router state at that URL (what a <Link state> passes). */
  routeState?: unknown;
}

/**
 * Renders a profile page as ProfileRoutes does for a signed-in user with the interview tools
 * on: inside the real InterviewProfileProvider, which reads through a mock profile gateway.
 */
export const renderProfilePage = (
  ui: ReactElement,
  {
    gateway = createMockProfileGateway(),
    interviewProfile,
    route = '/profile',
    routeState,
  }: Options = {},
) => ({
  gateway,
  ...renderWithProviders(
    <InterviewProfileProvider>{ui}</InterviewProfileProvider>,
    {
      route,
      routeState,
      profileGateway: gateway,
      flags: { interviewAssistant: true },
      interviewProfile,
      session: {
        status: SessionStatus.Ready,
        authResolved: true,
        user: PROFILE_TEST_USER,
        profile: { firstName: 'Maya', lastName: 'Okafor' },
        profileStatus: 'loaded',
      },
    },
  ),
});

export default renderProfilePage;
