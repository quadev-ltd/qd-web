import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationsScreen } from './ApplicationsScreen';

import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const brief = (gaps: number, applicationRevision = 1, profileRevision = 3) => ({
  requirements: Array.from({ length: 4 }, (_, index) => ({
    text: `Requirement ${index}`,
    importance: 'required' as const,
    itemIds: index < gaps ? [] : ['i1'],
  })),
  questions: [],
  applicationRevision,
  profileRevision,
  builtAt: 1,
});

const setUp = ({
  applications,
  interviewProfile = { uid: 'uid-1', status: 'loaded' },
}: {
  applications?: Partial<ApplicationsState>;
  interviewProfile?: Partial<InterviewProfileState>;
} = {}) =>
  renderProfilePage(<ApplicationsScreen />, {
    route: '/applications',
    applications,
    interviewProfile,
  });

/** The cards of the page, not the footer's links. */
const items = () => within(screen.getByRole('main')).getAllByRole('listitem');

const loaded = (
  overrides: Partial<ApplicationsState> = {},
): Partial<ApplicationsState> => ({
  uid: 'uid-1',
  status: 'loaded',
  profileRevision: 3,
  ...overrides,
});

describe('ApplicationsScreen', () => {
  it('reads the applications when nothing has read them yet, and waits for them', async () => {
    const { gateway } = setUp();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'home.applicationsTitle',
      }),
    ).toBeInTheDocument();
    expect(gateway.getApplications).toHaveBeenCalledExactlyOnceWith('uid-1');
  });

  it('is Applications in the bar and in the tab', () => {
    setUp({ applications: loaded() });

    expect(document.title).toBe('applications.listDocumentTitle');
    expect(
      screen.getByRole('link', { name: 'applications.title' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  describe('with no application yet', () => {
    it('has its heading and "New application", with the line that says what one gives, and no welcome or paths (D91)', () => {
      setUp({ applications: loaded() });

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'home.applicationsTitle',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'home.newApplicationButton' }),
      ).toBeEnabled();
      expect(
        screen.getByText('applications.emptyDescription'),
      ).toBeInTheDocument();
      expect(screen.queryByText('home.pathsTitle')).not.toBeInTheDocument();
      expect(screen.queryByText(/welcome/i)).not.toBeInTheDocument();
    });

    it('opens "New application" at once when "Prepare for a job" led here, and only once', async () => {
      renderProfilePage(<ApplicationsScreen />, {
        route: '/applications',
        routeState: { add: 'application' },
        applications: loaded(),
      });

      const panel = screen.getByRole('dialog', {
        name: 'applications.newTitle',
      });
      await userEvent.click(
        within(panel).getByRole('button', {
          name: 'sidePanel.closeAccessibilityLabel',
        }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('with applications', () => {
    const applications = [
      applicationFixture({
        id: 'ready',
        title: 'Senior Backend Engineer',
        brief: brief(2),
      }),
      applicationFixture({
        id: 'changed',
        title: 'Engineering Manager',
        company: 'Harbour Health',
        revision: 2,
        brief: brief(0, 1),
      }),
      applicationFixture({
        id: 'none',
        title: 'Platform Engineer',
        company: undefined,
      }),
    ];

    it('lists them, each leading to its page, with where its brief is', () => {
      setUp({ applications: loaded({ applications }) });

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'home.applicationsTitle',
        }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'applications.welcomeTitle' }),
      ).not.toBeInTheDocument();
      const cards = items();
      expect(cards).toHaveLength(3);
      expect(cards[0]).toHaveTextContent('home.briefReadyChip');
      expect(cards[0]).toHaveTextContent('home.briefGapsChip');
      expect(cards[1]).toHaveTextContent('Harbour Health');
      expect(cards[1]).toHaveTextContent('home.briefOutOfDateChip');
      expect(cards[2]).toHaveTextContent('home.briefNoneChip');
      expect(
        within(cards[0] as HTMLElement).getByRole('link', {
          name: 'Senior Backend Engineer',
        }),
      ).toHaveAttribute('href', '/applications/ready');
      expect(screen.queryByText('home.pathsTitle')).not.toBeInTheDocument();
      // One column, with nothing beside it: the profile is in the bar (D91)
      expect(
        screen.queryByRole('link', { name: 'home.openProfileButton' }),
      ).not.toBeInTheDocument();
    });

    it('says a job is being read or could not be read, and names one that has no name yet', () => {
      setUp({
        applications: loaded({
          applications: [
            applicationFixture({
              id: 'reading',
              title: '',
              company: undefined,
              updatedAt: 3,
              job: { source: 'link', status: 'reading', edited: false },
            }),
            applicationFixture({
              id: 'failed',
              updatedAt: 2,
              job: {
                source: 'file',
                status: 'failed',
                failure: 'empty',
                edited: false,
              },
            }),
          ],
        }),
      });

      const cards = items();
      expect(cards[0]).toHaveTextContent('applications.untitled');
      expect(cards[0]).toHaveTextContent('home.readingChip');
      expect(cards[1]).toHaveTextContent('home.unreadableChip');
    });

    it('says a brief is out of date when the profile changed since', () => {
      setUp({
        applications: loaded({
          applications: [applicationFixture({ brief: brief(0, 1, 2) })],
          profileRevision: 3,
        }),
      });

      expect(items()[0]).toHaveTextContent('home.briefOutOfDateChip');
    });

    it('opens "New application"', async () => {
      setUp({ applications: loaded({ applications }) });

      await userEvent.click(
        screen.getByRole('button', { name: 'home.newApplicationButton' }),
      );

      expect(
        screen.getByRole('dialog', { name: 'applications.newTitle' }),
      ).toBeInTheDocument();
    });

    it('offers no new one when the account holds 50', () => {
      setUp({
        applications: loaded({
          applications: Array.from({ length: 50 }, (_, index) =>
            applicationFixture({ id: `a${index}` }),
          ),
        }),
      });

      expect(
        screen.getByRole('button', { name: 'home.newApplicationButton' }),
      ).toBeDisabled();
      expect(screen.getByText('applications.maxMessage')).toBeInTheDocument();
    });
  });

  describe('the next interview (D89)', () => {
    const NOW = Date.parse('2026-10-25T12:00:00Z');
    const time = (
      interviewId: string,
      startsAt: string,
      lengthMinutes?: number,
    ) => ({
      interviewId,
      startsAt: Date.parse(startsAt),
      date: startsAt.slice(0, 10),
      startTime: startsAt.slice(11, 16),
      timeZone: 'Europe/London',
      lengthMinutes,
    });

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(NOW);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('is under the company when one is coming up, and not otherwise', () => {
      setUp({
        applications: loaded({
          applications: [
            applicationFixture({
              id: 'a1',
              interviewTimes: [
                time('past', '2026-10-08T10:00:00Z'),
                time('next', '2026-10-28T14:00:00Z'),
                time('later', '2026-11-05T10:00:00Z'),
              ],
            }),
            applicationFixture({
              id: 'a2',
              title: 'Platform Engineer',
              interviewTimes: [time('past', '2026-10-08T10:00:00Z')],
            }),
            applicationFixture({ id: 'a3', title: 'Engineering Manager' }),
          ],
        }),
      });

      const [first, second, third] = items();
      expect(
        within(first).getByText('applications.nextInterview'),
      ).toBeInTheDocument();
      expect(
        within(second).queryByText('applications.nextInterview'),
      ).not.toBeInTheDocument();
      expect(
        within(third).queryByText('applications.nextInterview'),
      ).not.toBeInTheDocument();
    });

    it('stays while one is going on, until it ends', () => {
      setUp({
        applications: loaded({
          applications: [
            applicationFixture({
              interviewTimes: [time('now', '2026-10-25T11:00:00Z', 90)],
            }),
          ],
        }),
      });

      expect(
        within(items()[0]).getByText('applications.nextInterview'),
      ).toBeInTheDocument();
    });
  });

  it('says the applications could not be loaded, and reads them again on "Try again"', async () => {
    const { gateway } = setUp({ applications: loaded({ status: 'error' }) });

    expect(
      screen.getByRole('heading', { level: 1, name: 'home.applicationsTitle' }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'applications.retryButton',
      }),
    );

    expect(gateway.getApplications).toHaveBeenCalledWith('uid-1');
  });
});
