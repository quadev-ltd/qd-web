// Mock interviews where the job is (D100, doc 24 §19): "Your mock interviews" on the interview's
// page (Web-A8-Interview-Questions), the chip on the Interviews tab (Web-A8-Interviews), and the
// application's Sessions tab (Web-R1-Application-Tab).
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import ApplicationScreen from '@/screens/Applications/ApplicationScreen';
import { InterviewScreen } from '@/screens/Applications/interviews/InterviewScreen';
import {
  applicationFixture,
  interviewFixture,
} from '@/testUtil/applicationFixtures';
import { mockSessionFixture } from '@/testUtil/mockFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { practiceTurnFixture } from '@/testUtil/practiceFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const NOW = Date.parse('2026-10-28T12:00:00Z');

const at = (iso: string) => Date.parse(iso);

/** Four held for the interview, one going, one of another interview. */
const SESSIONS = [
  mockSessionFixture({ id: 's1', startedAt: at('2026-10-24T10:00:00Z') }),
  mockSessionFixture({
    id: 's2',
    way: 'take-turns',
    startedAt: at('2026-10-27T19:05:00Z'),
  }),
  mockSessionFixture({ id: 's3', startedAt: at('2026-10-25T10:00:00Z') }),
  mockSessionFixture({ id: 's4', startedAt: at('2026-10-26T10:00:00Z') }),
  mockSessionFixture({
    id: 's5',
    status: 'active',
    endReason: undefined,
    endedAt: null,
    updatedAt: NOW,
    startedAt: at('2026-10-28T11:55:00Z'),
  }),
  mockSessionFixture({
    id: 's6',
    interviewId: 'i2',
    interview: { name: 'Recruiter call' },
  }),
];

const renderAt = (
  route: string,
  element: React.ReactElement,
  path: string,
  gateway = createMockProfileGateway(),
  flags: Record<string, boolean> = { mockInterview: true },
) => {
  gateway.getInterviews.mockResolvedValue([
    interviewFixture(),
    interviewFixture({ id: 'i2', name: 'Recruiter call' }),
  ]);
  gateway.getApplication.mockResolvedValue(applicationFixture());
  return renderProfilePage(
    <Routes>
      <Route path={path} element={element} />
    </Routes>,
    {
      gateway,
      route,
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
      },
      flags,
    },
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('"Your mock interviews" on the interview’s page (Web-A8-Interview-Questions)', () => {
  const renderInterview = (gateway = createMockProfileGateway()) =>
    renderAt(
      '/applications/a1/interviews/i1',
      <InterviewScreen />,
      '/applications/:applicationId/interviews/:interviewId',
      gateway,
    );

  it('the newest 3 held, each opening its page in Sessions, then "See all n in Sessions"', async () => {
    const gateway = createMockProfileGateway();
    gateway.getInterviewMockSessions.mockResolvedValue(
      SESSIONS.filter(({ interviewId }) => interviewId === 'i1'),
    );
    renderInterview(gateway);

    const card = await screen.findByRole('region', {
      name: 'mock.interviewMocksTitle',
    });
    expect(gateway.getInterviewMockSessions).toHaveBeenCalledWith(
      'uid-1',
      'i1',
    );
    const rows = within(card).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // The newest first; the one still going left out
    expect(within(rows[0]!).getByRole('link')).toHaveAttribute(
      'href',
      '/sessions/mock/s2',
    );
    expect(rows[0]).toHaveTextContent(
      'mock.wayTakeTurnsName · sessions.mockMinutes',
    );
    expect(rows[0]).toHaveTextContent('mock.feedbackReadyChip');
    expect(card).not.toHaveTextContent('s5');
    expect(
      within(card).getByRole('link', { name: 'mock.seeAllMocksLink' }),
    ).toHaveAttribute('href', '/applications/a1/sessions');
  });

  it('none held: no card; a failed read leaves it out, and the page goes on', async () => {
    const gateway = createMockProfileGateway();
    gateway.getInterviewMockSessions.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    renderInterview(gateway);

    expect(
      await screen.findByRole('region', { name: 'interviews.detailsTitle' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'mock.interviewMocksTitle' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('the chip on the Interviews tab (Web-A8-Interviews)', () => {
  it('counts the mock interviews held for each interview', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSessions.mockResolvedValue(SESSIONS);
    renderAt(
      '/applications/a1/interviews',
      <ApplicationScreen tab="interviews" />,
      '/applications/:applicationId/interviews',
      gateway,
    );

    const technical = (
      await screen.findByRole('link', { name: 'Technical interview' })
    ).closest('li')!;
    expect(
      await within(technical).findByText('sessions.mockInterviews'),
    ).toBeVisible();
    const recruiter = screen
      .getByRole('link', { name: 'Recruiter call' })
      .closest('li')!;
    expect(
      within(recruiter).getByText('sessions.mockInterviews'),
    ).toBeVisible();
  });

  it('none without mock interviews on', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSessions.mockResolvedValue(SESSIONS);
    renderAt(
      '/applications/a1/interviews',
      <ApplicationScreen tab="interviews" />,
      '/applications/:applicationId/interviews',
      gateway,
      {},
    );
    await screen.findByRole('link', { name: 'Technical interview' });
    expect(gateway.getMockSessions).not.toHaveBeenCalled();
    expect(
      screen.queryByText('sessions.mockInterviews'),
    ).not.toBeInTheDocument();
  });
});

describe('the application’s Sessions tab (Web-R1-Application-Tab)', () => {
  const renderTab = (
    gateway = createMockProfileGateway(),
    flags: Record<string, boolean> = {
      mockInterview: true,
      textPractice: true,
    },
  ) =>
    renderAt(
      '/applications/a1/sessions',
      <ApplicationScreen tab="sessions" />,
      '/applications/:applicationId/sessions',
      gateway,
      flags,
    );

  it('this job’s mock interviews, named by their interview, then its questions practised', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSessions.mockResolvedValue([
      ...SESSIONS,
      mockSessionFixture({ id: 's9', applicationId: 'other' }),
    ]);
    gateway.getPracticeTurns.mockResolvedValue([
      practiceTurnFixture({ id: 't1' }),
      practiceTurnFixture({ id: 't2', applicationId: 'other' }),
    ]);
    renderTab(gateway);

    expect(
      await screen.findByRole('link', { name: 'applications.sessionsTab' }),
    ).toHaveAttribute('aria-current', 'page');
    const mocks = await screen.findByRole('region', {
      name: 'sessions.appMocksTitle',
    });
    const rows = within(mocks).getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toHaveTextContent('Technical interview');
    expect(rows[0]).toHaveTextContent('mock.wayTakeTurnsName');
    const turns = screen.getByRole('region', {
      name: 'sessions.appTurnsTitle',
    });
    expect(within(turns).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('sessions.appKeptNote')).toBeVisible();
  });

  it('none for this job: where to start', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSessions.mockResolvedValue([]);
    gateway.getPracticeTurns.mockResolvedValue([]);
    renderTab(gateway);
    expect(await screen.findByText('sessions.appEmpty')).toBeVisible();
  });

  it('a failed read says so, with "Try again"', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurns
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Network))
      .mockResolvedValue([]);
    gateway.getMockSessions.mockResolvedValue([]);
    renderTab(gateway);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'sessions.appLoadError',
    );
    await user.click(
      screen.getByRole('button', { name: 'sessions.retryButton' }),
    );
    expect(await screen.findByText('sessions.appEmpty')).toBeVisible();
  });

  it('no tab without text practice or mock interviews', async () => {
    renderAt(
      '/applications/a1/interviews',
      <ApplicationScreen tab="interviews" />,
      '/applications/:applicationId/interviews',
      createMockProfileGateway(),
      {},
    );
    await screen.findByRole('link', { name: 'applications.interviewsTab' });
    expect(
      screen.queryByRole('link', { name: 'applications.sessionsTab' }),
    ).not.toBeInTheDocument();
  });
});
