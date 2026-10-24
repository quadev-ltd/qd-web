import { type ReactElement } from 'react';

import { createMockProfileGateway } from './mockProfileGateway';
import { renderWithProviders } from './renderWithProviders';

import { type SessionUser } from '@/core/auth/types';
import { type FlagValues } from '@/core/flags/registry';
import { ApplicationsProvider } from '@/core/profile/ApplicationsProvider';
import { InterviewProfileProvider } from '@/core/profile/InterviewProfileProvider';
import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
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
  /** The applications as already read; left out, a page that shows them reads them. */
  applications?: Partial<ApplicationsState>;
  route?: string;
  /** Router state at that URL (what a <Link state> passes). */
  routeState?: unknown;
  /** Flags on top of the interview tools' (`cvTool`). */
  flags?: FlagValues;
}

/**
 * Renders a profile or application page as ProfileRoutes and ApplicationRoutes do for a
 * signed-in user with the interview tools on: inside the real InterviewProfileProvider and
 * ApplicationsProvider, which read through a mock profile gateway.
 */
export const renderProfilePage = (
  ui: ReactElement,
  {
    gateway = createMockProfileGateway(),
    interviewProfile,
    applications,
    route = '/profile',
    routeState,
    flags,
  }: Options = {},
) => ({
  gateway,
  ...renderWithProviders(
    <InterviewProfileProvider>
      <ApplicationsProvider>{ui}</ApplicationsProvider>
    </InterviewProfileProvider>,
    {
      route,
      routeState,
      profileGateway: gateway,
      flags: { interviewAssistant: true, ...flags },
      interviewProfile,
      applications,
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
