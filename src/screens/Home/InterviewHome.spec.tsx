import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { InterviewHome } from './InterviewHome';

import { selectProfileGateway } from '@/core/profile/selectProfileGateway';
import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { PROFILE_TEST_USER } from '@/testUtil/renderProfilePage';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));
vi.mock('@/core/profile/selectProfileGateway', () => ({
  selectProfileGateway: vi.fn(),
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
} = {}) => {
  const gateway = createMockProfileGateway();
  vi.mocked(selectProfileGateway).mockReturnValue(gateway);
  const utils = renderWithProviders(<InterviewHome />, {
    route: '/home',
    applications,
    interviewProfile,
    session: { status: SessionStatus.Ready, user: PROFILE_TEST_USER },
  });
  return { gateway, ...utils };
};

const loaded = (
  overrides: Partial<ApplicationsState> = {},
): Partial<ApplicationsState> => ({
  uid: 'uid-1',
  status: 'loaded',
  profileRevision: 3,
  ...overrides,
});

beforeEach(() => {
  vi.mocked(selectProfileGateway).mockReset();
});

describe('InterviewHome', () => {
  it('reads the applications when nothing has read them yet', async () => {
    const { gateway } = setUp();

    expect(
      await screen.findByRole('heading', { name: 'home.pathsTitle' }),
    ).toBeInTheDocument();
    expect(gateway.getApplications).toHaveBeenCalledExactlyOnceWith('uid-1');
  });

  describe('with no application yet', () => {
    it('starts with "Add your CV", then the three paths', () => {
      setUp({ applications: loaded() });

      expect(screen.getByText('home.startTitle')).toBeInTheDocument();
      const paths = screen.getByRole('region', { name: 'home.pathsTitle' });
      expect(
        within(paths)
          .getAllByRole('article')
          .map(card => card.textContent),
      ).toEqual([
        'home.prepareTitlehome.prepareDescription',
        'home.practiseTitlehome.practiseDescriptionhome.comingSoonChip',
        'home.improveCvTitlehome.improveCvDescriptionhome.comingSoonChip',
      ]);
    });

    it('opens "New application" from "Prepare for a job"', async () => {
      setUp({ applications: loaded() });

      await userEvent.click(
        screen.getByRole('button', { name: /home\.prepareTitle/ }),
      );

      expect(
        screen.getByRole('dialog', { name: 'applications.newTitle' }),
      ).toBeInTheDocument();
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
        screen.getByRole('heading', { name: 'home.applicationsTitle' }),
      ).toBeInTheDocument();
      const cards = screen.getAllByRole('listitem');
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

      const cards = screen.getAllByRole('listitem');
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

      expect(screen.getByRole('listitem')).toHaveTextContent(
        'home.briefOutOfDateChip',
      );
    });

    it('shows "Your profile" beside them, with how many resources it has', () => {
      setUp({
        applications: loaded({ applications }),
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          resources: [
            resourceFixture({ id: 'r1' }),
            resourceFixture({ id: 'r2' }),
          ],
        },
      });

      const profile = screen.getByRole('region', {
        name: 'home.profileCardTitle',
      });
      expect(profile).toHaveTextContent('home.profileCardResources');
      expect(
        within(profile).getByRole('link', { name: 'home.openProfileButton' }),
      ).toHaveAttribute('href', '/profile');
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

  it('says the applications could not be loaded, and reads them again on "Try again"', async () => {
    const { gateway } = setUp({ applications: loaded({ status: 'error' }) });

    await userEvent.click(
      within(screen.getByRole('alert')).getByRole('button', {
        name: 'applications.retryButton',
      }),
    );

    expect(gateway.getApplications).toHaveBeenCalledWith('uid-1');
  });
});
