import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { CvScreen } from './CvScreen';

import { type CvVersion } from '@/core/profile/cvVersions';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import {
  cvDetailsFixture,
  cvVersionFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => {
  const { pathname, state } = useLocation();
  return <p>{`at ${pathname} ${JSON.stringify(state)}`}</p>;
};

const cv = resourceFixture({ textAt: 1_500 });
const note = resourceFixture({
  id: 'r2',
  type: 'note',
  title: 'Stories',
  source: 'text',
});
const job = applicationFixture({
  job: { source: 'text', status: 'ready', edited: false },
});

const setUp = ({
  resources = [cv, note],
  versions = [],
  applications = [job],
  madeToday = 1,
  gateway = createMockProfileGateway(),
}: {
  resources?: ReturnType<typeof resourceFixture>[];
  versions?: CvVersion[];
  applications?: ReturnType<typeof applicationFixture>[];
  madeToday?: number | null;
  gateway?: ReturnType<typeof createMockProfileGateway>;
} = {}) =>
  renderCvPage(
    <Routes>
      <Route path="/cv" element={<CvScreen />} />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      interviewProfile: { uid: 'uid-1', status: 'loaded', resources },
      applications: { uid: 'uid-1', status: 'loaded', applications },
      cvVersions: { uid: 'uid-1', status: 'loaded', versions, madeToday },
    },
  );

describe('CvScreen', () => {
  it('asks to add to the profile first when it holds nothing, and opens "Add your CV" there', async () => {
    setUp({ resources: [] });

    expect(
      screen.getByRole('heading', { name: 'cv.emptyTitle' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.addCvButton' }),
    );

    expect(screen.getByText('at /profile {"add":"cv"}')).toBeInTheDocument();
  });

  it('offers the two ways in before any version, each opening the panel with its choice made', async () => {
    setUp();

    expect(
      screen.queryByRole('button', { name: 'cv.newVersionButton' }),
    ).not.toBeInTheDocument();
    // Written from the whole profile, not from one CV
    expect(screen.getByText('cv.writtenFromResources')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.generalButton' }),
    );

    const panel = screen.getByRole('dialog', { name: 'cv.newGeneralTitle' });
    expect(within(panel).queryByText('cv.forLabel')).not.toBeInTheDocument();
    expect(
      within(panel).getByRole('textbox', { name: /cv.roleLabel/ }),
    ).toBeInTheDocument();
  });

  it('lists the versions by job and "General", with where each one is', () => {
    setUp({
      versions: [
        cvVersionFixture(),
        cvVersionFixture({
          id: 'v2',
          status: 'creating',
          createdAt: Date.now(),
          changes: [],
          questions: [],
        }),
        cvVersionFixture({
          id: 'v3',
          target: { kind: 'general', role: 'Data engineer' },
          changes: [],
          questions: [],
        }),
      ],
    });

    const forJob = screen.getByRole('region', { name: 'cv.forJobTitle' });
    expect(
      within(forJob).getByRole('heading', { name: 'Senior Backend Engineer' }),
    ).toBeInTheDocument();
    expect(within(forJob).getByText('cv.changesToReview')).toBeInTheDocument();
    expect(within(forJob).getByText('cv.questionsChip')).toBeInTheDocument();
    expect(within(forJob).getByText('cv.creatingChip')).toBeInTheDocument();
    expect(
      within(forJob).getByRole('link', { name: 'cv.openApplicationLink' }),
    ).toHaveAttribute('href', '/applications/a1');
    const general = screen.getByRole('region', {
      name: 'cv.generalSectionTitle',
    });
    expect(
      within(general).getByText('cv.generalVersionTitle'),
    ).toBeInTheDocument();
    expect(within(general).getByText('cv.readyChip')).toBeInTheDocument();
    expect(within(general).getByRole('link')).toHaveAttribute(
      'href',
      '/cv/versions/v3',
    );
  });

  it('says a written version is written for the job, how long it is and its open questions; an old one, which CV it edits', () => {
    setUp({
      versions: [
        writtenVersionFixture(),
        writtenVersionFixture({
          id: 'w2',
          status: 'creating',
          document: undefined,
          createdAt: Date.now(),
        }),
        cvVersionFixture({ changes: [], questions: [] }),
      ],
    });

    const forJob = screen.getByRole('region', { name: 'cv.forJobTitle' });
    expect(
      // The specs' translations give keys: "Written for this job · about half a page"
      within(forJob).getByText('cv.writtenJobMeta · cv.abouthalfpage'),
    ).toBeInTheDocument();
    expect(within(forJob).getByText('cv.writingChip')).toBeInTheDocument();
    expect(within(forJob).getByText('cv.questionsChip')).toBeInTheDocument();
    expect(within(forJob).getByText('cv.editsTo')).toBeInTheDocument();
  });

  describe('"New CV version"', () => {
    const openPanel = async () => {
      await userEvent.click(
        screen.getByRole('button', { name: 'cv.newVersionButton' }),
      );
      return screen.getByRole('dialog', { name: 'cv.newTitle' });
    };

    it('asks what it is for, makes one for a job, and opens its page', async () => {
      const gateway = createMockProfileGateway();
      gateway.createCvVersion.mockResolvedValue({
        versionId: 'v9',
        status: 'creating',
      });
      setUp({ versions: [cvVersionFixture()], gateway });
      const panel = await openPanel();

      expect(within(panel).getByText('cv.forLabel')).toBeInTheDocument();
      expect(
        within(panel).getByRole('radio', { name: /Senior Backend Engineer/ }),
      ).toBeChecked();
      // Written from the whole profile: no CV to choose, 2 pages unless asked
      expect(
        within(panel).getAllByRole('radio', { name: 'cv.pagesOption' })[1],
      ).toBeChecked();
      expect(within(panel).getByText('cv.ukLine')).toBeInTheDocument();
      expect(
        within(panel).getByText('cv.writtenFromProfile'),
      ).toBeInTheDocument();
      expect(within(panel).getByText('cv.takesMinute')).toBeInTheDocument();
      await userEvent.click(
        within(panel).getByRole('button', { name: 'cv.createButton' }),
      );

      expect(gateway.createCvVersion).toHaveBeenCalledExactlyOnceWith({
        mode: 'write',
        target: { kind: 'job', applicationId: 'a1' },
        pages: 2,
      });
      expect(gateway.getCvVersion).toHaveBeenCalledWith('uid-1', 'v9');
      expect(
        await screen.findByText('at /cv/versions/v9 null'),
      ).toBeInTheDocument();
    });

    it('writes a general one for a role, on one page', async () => {
      const gateway = createMockProfileGateway();
      setUp({ versions: [cvVersionFixture()], gateway });
      const panel = await openPanel();

      await userEvent.click(
        within(panel).getByRole('radio', { name: /cv.forGeneral/ }),
      );
      await userEvent.type(
        within(panel).getByRole('textbox', { name: /cv.roleLabel/ }),
        ' Data engineer ',
      );
      const [onePage] = within(panel).getAllByRole('radio', {
        name: 'cv.pagesOption',
      });
      await userEvent.click(onePage!);
      await userEvent.click(
        within(panel).getByRole('button', { name: 'cv.createButton' }),
      );

      expect(gateway.createCvVersion).toHaveBeenCalledExactlyOnceWith({
        mode: 'write',
        target: { kind: 'general', role: 'Data engineer' },
        pages: 1,
      });
    });

    it('shows the CV details that go at the top, and opens them over the panel', async () => {
      const gateway = createMockProfileGateway();
      gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
      setUp({ versions: [cvVersionFixture()], gateway });
      await screen.findByRole('region', { name: 'cv.detailsCardTitle' });
      const panel = await openPanel();

      expect(panel).toHaveTextContent('Maya Okafor · Senior Backend Engineer');
      await userEvent.click(
        within(panel).getByRole('button', { name: 'cv.atTheTopEditLabel' }),
      );

      expect(
        screen.getByRole('dialog', { name: 'cv.detailsTitle' }),
      ).toBeInTheDocument();
    });

    it('says today’s limit, and creates nothing', async () => {
      const gateway = createMockProfileGateway();
      setUp({ versions: [cvVersionFixture()], madeToday: 5, gateway });
      const panel = await openPanel();

      expect(within(panel).getByText('cv.limitMessage')).toBeInTheDocument();
      expect(within(panel).getByText('cv.takesMinuteNone')).toBeInTheDocument();
      expect(
        within(panel).getByRole('button', { name: 'cv.createButton' }),
      ).toBeDisabled();
    });

    it('says why the backend refused it', async () => {
      const gateway = createMockProfileGateway();
      gateway.createCvVersion.mockRejectedValue(
        new ProfileError(ProfileErrorCode.NoItems),
      );
      setUp({ versions: [cvVersionFixture()], gateway });
      const panel = await openPanel();

      await userEvent.click(
        within(panel).getByRole('button', { name: 'cv.createButton' }),
      );

      expect(await within(panel).findByRole('alert')).toHaveTextContent(
        'cv.noItemsMessage',
      );
    });

    it('offers no job without its text, and says so', async () => {
      setUp({
        versions: [cvVersionFixture()],
        applications: [
          applicationFixture({
            jobDescription: undefined,
            job: { source: 'link', status: 'failed', edited: false },
          }),
        ],
      });
      const panel = await openPanel();

      expect(within(panel).getByText('cv.noJobsMessage')).toBeInTheDocument();
      expect(
        within(panel).getByRole('button', { name: 'cv.createButton' }),
      ).toBeDisabled();
    });
  });
  describe('the CV details, at the top of every CV', () => {
    it('shows them in two lines and opens them to edit, before any version and in the list', async () => {
      const gateway = createMockProfileGateway();
      gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
      setUp({ gateway });

      const card = await screen.findByRole('region', {
        name: 'cv.detailsCardTitle',
      });
      expect(card).toHaveTextContent('Maya Okafor · Senior Backend Engineer');
      expect(card).toHaveTextContent(
        'London, UK · maya.okafor@example.com · 07700 900123 · cv.detailsLinksCount',
      );
      await userEvent.click(
        within(card).getByRole('button', { name: 'cv.detailsEditButton' }),
      );
      expect(
        screen.getByRole('dialog', { name: 'cv.detailsTitle' }),
      ).toBeInTheDocument();
    });

    it('is in the list of versions too', async () => {
      const gateway = createMockProfileGateway();
      gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
      setUp({ gateway, versions: [cvVersionFixture()] });

      expect(
        await screen.findByRole('region', { name: 'cv.detailsCardTitle' }),
      ).toBeInTheDocument();
    });

    it('says when there are none yet, and offers to add them', async () => {
      setUp();

      const card = await screen.findByRole('region', {
        name: 'cv.detailsCardTitle',
      });
      expect(card).toHaveTextContent('cv.detailsNoneYet');
      expect(
        within(card).getByRole('button', { name: 'cv.detailsAddButton' }),
      ).toBeInTheDocument();
    });

    it('offers to read them again when they could not be read, and still lists the rest', async () => {
      const gateway = createMockProfileGateway();
      gateway.getCvDetails.mockRejectedValueOnce(
        new ProfileError(ProfileErrorCode.Unknown),
      );
      setUp({ gateway });

      const card = await screen.findByRole('region', {
        name: 'cv.detailsCardTitle',
      });
      expect(card).toHaveTextContent('cv.detailsLoadErrorMessage');
      expect(
        screen.getByRole('button', { name: 'cv.generalButton' }),
      ).toBeInTheDocument();
      await userEvent.click(
        within(card).getByRole('button', { name: 'cv.retryButton' }),
      );
      expect(
        await screen.findByRole('region', { name: 'cv.detailsCardTitle' }),
      ).toHaveTextContent('cv.detailsNoneYet');
      expect(gateway.getCvDetails).toHaveBeenCalledTimes(2);
    });
  });
});
