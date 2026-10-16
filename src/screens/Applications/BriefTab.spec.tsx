import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { QUESTIONS_SHOWN, REQUIREMENTS_SHOWN } from './BriefCards';
import { BriefTab } from './BriefTab';

import {
  type ApplicationBrief,
  type JobApplication,
} from '@/core/profile/applications';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const brief = (
  overrides: Partial<ApplicationBrief> = {},
): ApplicationBrief => ({
  requirements: [
    {
      text: 'Owning backend services in production',
      importance: 'required',
      evidence: 'You will design and run Go services in production.',
      itemIds: ['i1', 'gone'],
    },
    {
      text: 'Experience running Kafka at scale',
      importance: 'required',
      evidence: 'Operate Kafka clusters handling billions of events.',
      itemIds: [],
    },
    { text: 'Mentoring engineers', importance: 'preferred', itemIds: ['i1'] },
  ],
  questions: [
    {
      text: 'Tell me about an incident you led from alert to fix.',
      kind: 'behavioural',
      bullets: [
        { text: 'Payments migration: 40% fewer incidents', itemId: 'i1' },
        { text: 'Keep it to two minutes' },
      ],
    },
  ],
  applicationRevision: 1,
  profileRevision: 3,
  builtAt: Date.parse('2026-10-10T09:30:00Z'),
  ...overrides,
});

const setUp = (
  application: JobApplication,
  {
    gateway = createMockProfileGateway(),
    profileRevision = 3,
    resources = [resourceFixture({ id: 'r1', title: 'Maya Okafor CV 2026' })],
  } = {},
) => {
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'i1', kind: 'achievement', resourceId: 'r1' }),
  ]);
  return renderProfilePage(<BriefTab application={application} />, {
    gateway,
    interviewProfile: { uid: 'uid-1', status: 'loaded', resources },
    applications: {
      uid: 'uid-1',
      status: 'loaded',
      applications: [application],
      profileRevision,
    },
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BriefTab', () => {
  describe('while the job is not ready', () => {
    it('says it is being read, and offers no brief yet', () => {
      setUp(
        applicationFixture({
          job: { source: 'text', status: 'reading', edited: false },
        }),
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'applications.readingJobTitle',
      );
      expect(
        screen.queryByRole('button', { name: 'applications.prepareButton' }),
      ).not.toBeInTheDocument();
    });

    it('opens "Edit the application" on the job when it could not be read', async () => {
      setUp(
        applicationFixture({
          jobDescription: undefined,
          job: {
            source: 'link',
            status: 'failed',
            failure: 'link-unreadable',
            edited: false,
          },
        }),
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'applications.pasteInsteadButton' }),
      );

      expect(
        screen.getByRole('textbox', { name: 'applications.jobLabel' }),
      ).toHaveValue('');
    });
  });

  describe('before the first brief', () => {
    it('offers to prepare it, and says what it is', () => {
      setUp(applicationFixture());

      expect(
        screen.getByRole('heading', { name: 'applications.prepareTitle' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('applications.prepareDescription'),
      ).toBeInTheDocument();
    });

    it('prepares it: says it is working while the backend is at it, then reads the application again', async () => {
      const gateway = createMockProfileGateway();
      let finish = () => {};
      gateway.prepareBrief.mockReturnValue(
        new Promise<void>(resolve => {
          finish = resolve;
        }),
      );
      gateway.getApplication.mockResolvedValue(
        applicationFixture({ brief: brief() }),
      );
      setUp(applicationFixture(), { gateway });

      await userEvent.click(
        screen.getByRole('button', { name: 'applications.prepareButton' }),
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'applications.preparingTitle',
      );
      finish();
      await waitFor(() =>
        expect(gateway.getApplication).toHaveBeenCalledWith('uid-1', 'a1'),
      );
      expect(gateway.prepareBrief).toHaveBeenCalledExactlyOnceWith('a1');
    });

    it('says when the profile is empty, and opens "Add your CV"', async () => {
      setUp(applicationFixture(), { resources: [] });

      expect(
        screen.getByText('applications.emptyProfileBeforeMessage'),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'applications.addCvButton' }),
      );
      expect(
        screen.getByRole('dialog', { name: 'addResource.cvChoiceTitle' }),
      ).toBeInTheDocument();
    });

    it('says it could not be prepared, and logs the code only', async () => {
      const gateway = createMockProfileGateway();
      gateway.prepareBrief.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Unknown),
      );
      setUp(applicationFixture(), { gateway });

      await userEvent.click(
        screen.getByRole('button', { name: 'applications.prepareButton' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'applications.briefFailedMessage',
      );
      expect(mockLogger.logError).toHaveBeenCalledWith(
        new Error('prepareBrief failed: code=profile/unknown uid=uid-1'),
      );
    });

    it('says today’s limit was reached, and offers nothing more today', async () => {
      const gateway = createMockProfileGateway();
      gateway.prepareBrief.mockRejectedValue(
        new ProfileError(ProfileErrorCode.DailyLimit),
      );
      setUp(applicationFixture(), { gateway });

      await userEvent.click(
        screen.getByRole('button', { name: 'applications.prepareButton' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'applications.briefLimitMessage',
      );
      expect(
        screen.getByRole('button', { name: 'applications.prepareButton' }),
      ).toBeDisabled();
    });

    it('offers nothing when today’s 10 briefs were already prepared', async () => {
      const gateway = createMockProfileGateway();
      gateway.getBriefsToday.mockResolvedValue(10);
      setUp(applicationFixture(), { gateway });

      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'applications.prepareButton' }),
        ).toBeDisabled(),
      );
    });
  });

  describe('a brief', () => {
    it('says when it was prepared and how many are left today', async () => {
      const gateway = createMockProfileGateway();
      gateway.getBriefsToday.mockResolvedValue(7);
      setUp(applicationFixture({ brief: brief() }), { gateway });

      expect(
        await screen.findByText(
          'applications.preparedOn · applications.briefsLeft',
        ),
      ).toBeInTheDocument();
    });

    it('lists what the job asks for, the gaps first, with their count', () => {
      setUp(applicationFixture({ brief: brief() }));

      const card = screen.getByRole('region', {
        name: 'applications.requirementsTitle',
      });
      expect(card).toHaveTextContent('3 · applications.gapsCount');
      const rows = within(card).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent('Experience running Kafka at scale');
      expect(rows[0]).toHaveTextContent('applications.gapChip');
      expect(rows[0]).toHaveTextContent('applications.gapLine');
      expect(rows[1]).toHaveTextContent('applications.shownLine');
    });

    it('opens a requirement on the job’s words and the items that show it, leaving out one that is gone', async () => {
      setUp(applicationFixture({ brief: brief() }));
      const toggle = screen.getByRole('button', {
        name: /Owning backend services in production/,
      });

      await userEvent.click(toggle);

      const opened = toggle.closest('li') as HTMLElement;
      expect(
        within(opened).getByText(
          'You will design and run Go services in production.',
        ),
      ).toBeVisible();
      expect(
        await within(opened).findByText(
          'Cut payment incidents by 40% in two quarters.',
        ),
      ).toBeVisible();
      // "gone" names an item that was removed since: only one item is listed.
      expect(
        within(opened).getAllByText('applications.itemSource'),
      ).toHaveLength(1);
    });

    it('opens "Add a story" on a gap as a note', async () => {
      setUp(applicationFixture({ brief: brief() }));

      await userEvent.click(
        screen.getByRole('button', { name: /Experience running Kafka/ }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'applications.addStoryButton' }),
      );

      expect(
        screen.getByRole('dialog', { name: 'addResource.textTitle' }),
      ).toBeInTheDocument();
    });

    it(`shows ${REQUIREMENTS_SHOWN} requirements and ${QUESTIONS_SHOWN} questions, and the rest on "Show all"`, async () => {
      const many = brief({
        requirements: Array.from({ length: 8 }, (_, index) => ({
          text: `Requirement ${index}`,
          importance: 'required' as const,
          itemIds: [],
        })),
        questions: Array.from({ length: 6 }, (_, index) => ({
          text: `Question ${index}`,
          kind: 'technical' as const,
          bullets: [],
        })),
      });
      setUp(applicationFixture({ brief: many }));

      expect(screen.getAllByText(/^Requirement \d$/)).toHaveLength(
        REQUIREMENTS_SHOWN,
      );
      expect(screen.getAllByText(/^Question \d$/)).toHaveLength(
        QUESTIONS_SHOWN,
      );
      for (const button of screen.getAllByRole('button', {
        name: 'applications.showAllCountButton',
      })) {
        await userEvent.click(button);
      }
      expect(screen.getAllByText(/^Requirement \d$/)).toHaveLength(8);
      expect(screen.getAllByText(/^Question \d$/)).toHaveLength(6);
    });

    it('opens a likely question on notes from the profile and advice', async () => {
      setUp(applicationFixture({ brief: brief() }));
      const card = screen.getByRole('region', {
        name: 'applications.questionsTitle',
      });
      expect(card).toHaveTextContent('applications.questionBehavioural');

      await userEvent.click(
        within(card).getByRole('button', { name: /an incident you led/ }),
      );

      expect(
        within(card).getByText('Payments migration: 40% fewer incidents'),
      ).toBeVisible();
      expect(within(card).getByText('applications.adviceChip')).toBeVisible();
      expect(
        await within(card).findByText('applications.itemSource'),
      ).toBeVisible();
    });

    it('says the job changed since, with "Refresh" in the message', async () => {
      const gateway = createMockProfileGateway();
      setUp(applicationFixture({ revision: 2, brief: brief() }), { gateway });

      const banner = screen
        .getByText('applications.jobChanged')
        .closest('div') as HTMLElement;
      await userEvent.click(
        within(banner.parentElement as HTMLElement).getByRole('button', {
          name: 'applications.refreshButton',
        }),
      );

      expect(gateway.prepareBrief).toHaveBeenCalledExactlyOnceWith('a1');
    });

    it('says the profile changed since', () => {
      setUp(applicationFixture({ brief: brief({ profileRevision: 2 }) }), {
        profileRevision: 3,
      });

      expect(
        screen.getByText(/applications\.profileChanged/),
      ).toBeInTheDocument();
    });

    it('keeps the brief when it could not be refreshed, and says so', async () => {
      const gateway = createMockProfileGateway();
      gateway.prepareBrief.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Unknown),
      );
      setUp(applicationFixture({ brief: brief() }), { gateway });

      await userEvent.click(
        screen.getByRole('button', { name: 'applications.refreshButton' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'applications.briefFailedKeptMessage',
      );
      expect(
        screen.getByText('Owning backend services in production'),
      ).toBeInTheDocument();
    });
  });
});
