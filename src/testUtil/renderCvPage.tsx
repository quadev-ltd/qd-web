import { type ReactElement } from 'react';

import { createMockProfileGateway } from './mockProfileGateway';
import { PROFILE_TEST_USER } from './renderProfilePage';
import { renderWithProviders } from './renderWithProviders';

import { type FlagValues } from '@/core/flags/registry';
import { ApplicationsProvider } from '@/core/profile/ApplicationsProvider';
import { CvVersionsProvider } from '@/core/profile/CvVersionsProvider';
import { InterviewProfileProvider } from '@/core/profile/InterviewProfileProvider';
import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
import { type CvVersionsState } from '@/core/state/slices/cvVersionsSlice';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

interface Options {
  gateway?: ReturnType<typeof createMockProfileGateway>;
  interviewProfile?: Partial<InterviewProfileState>;
  applications?: Partial<ApplicationsState>;
  /** The versions as already read; left out, the page reads them through the gateway. */
  cvVersions?: Partial<CvVersionsState>;
  route?: string;
  /** More flags than the interview tools and the CV tool: cover letters (D98). */
  flags?: FlagValues;
}

/**
 * Renders a CV page as ProfileRoutes and CvRoutes do for a signed-in user with the interview
 * tools and the CV tool on: inside the real profile, applications and versions providers,
 * which read through a mock profile gateway.
 */
export const renderCvPage = (
  ui: ReactElement,
  {
    gateway = createMockProfileGateway(),
    interviewProfile,
    applications,
    cvVersions,
    route = '/cv',
    flags,
  }: Options = {},
) => ({
  gateway,
  ...renderWithProviders(
    <InterviewProfileProvider>
      <ApplicationsProvider>
        <CvVersionsProvider>{ui}</CvVersionsProvider>
      </ApplicationsProvider>
    </InterviewProfileProvider>,
    {
      route,
      profileGateway: gateway,
      flags: { interviewAssistant: true, cvTool: true, ...flags },
      interviewProfile,
      applications,
      cvVersions,
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

export default renderCvPage;
