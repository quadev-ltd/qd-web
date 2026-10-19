import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { CvRoutes } from './CvRoutes';
import { CvVersionScreen } from './CvVersionScreen';

import {
  CV_CREATING_STALE_MS,
  type CvVersion,
} from '@/core/profile/cvVersions';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import {
  cvVersionFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const setUp = (
  version: CvVersion | null,
  gateway = createMockProfileGateway(),
) => {
  gateway.getCvVersion.mockImplementation(async (_uid, id) =>
    version && version.id === id ? version : null,
  );
  return renderCvPage(
    <Routes>
      <Route path="/cv/versions/:versionId" element={<CvVersionScreen />} />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route: `/cv/versions/${version?.id ?? 'v1'}`,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [resourceFixture({ textAt: 1_500 })],
      },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
      },
      cvVersions: {
        uid: 'uid-1',
        status: 'loaded',
        versions: version ? [version] : [],
        madeToday: 0,
      },
    },
  );
};

describe('CvVersionScreen', () => {
  it('says it is being made, and that the page can be left', () => {
    setUp(
      cvVersionFixture({
        status: 'creating',
        createdAt: Date.now(),
        changes: [],
        questions: [],
      }),
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Senior Backend Engineer · Northwind Logistics',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('cv.tailoredSub')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('cv.creatingTitle');
  });

  it('offers to remove one that was lost', async () => {
    const gateway = createMockProfileGateway();
    setUp(
      cvVersionFixture({
        status: 'creating',
        createdAt: Date.now() - CV_CREATING_STALE_MS - 1,
      }),
      gateway,
    );

    expect(screen.getByRole('status')).toHaveTextContent('cv.stuckTitle');
    await userEvent.click(
      within(screen.getByRole('status')).getByRole('button', {
        name: 'cv.removeVersionButton',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.removeConfirmButton' }),
    );

    expect(gateway.removeCvVersion).toHaveBeenCalledExactlyOnceWith('v1');
    expect(await screen.findByText('at /cv')).toBeInTheDocument();
  });

  it('says why it could not be made, and tries again: a new one, the failed one removed', async () => {
    const gateway = createMockProfileGateway();
    gateway.createCvVersion.mockResolvedValue({
      versionId: 'v2',
      status: 'creating',
    });
    setUp(
      cvVersionFixture({
        status: 'failed',
        failure: 'model',
        length: 'two-pages',
        changes: [],
        questions: [],
      }),
      gateway,
    );
    // The backend has the new one, being made, and no longer the failed one.
    gateway.getCvVersion.mockImplementation(async (_uid, id) =>
      id === 'v2'
        ? cvVersionFixture({
            id: 'v2',
            status: 'creating',
            createdAt: Date.now(),
            changes: [],
            questions: [],
          })
        : null,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('cv.failedTitle');
    expect(alert).toHaveTextContent('cv.failedModel');
    await userEvent.click(
      within(alert).getByRole('button', { name: 'cv.tryAgainButton' }),
    );

    // No new edit version since D83: the CV is written for the same job instead
    expect(gateway.createCvVersion).toHaveBeenCalledExactlyOnceWith({
      mode: 'write',
      target: { kind: 'job', applicationId: 'a1' },
      pages: 2,
    });
    expect(gateway.removeCvVersion).toHaveBeenCalledExactlyOnceWith('v1');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'cv.creatingTitle',
    );
  });

  it('says today’s limit when trying again is refused', async () => {
    const gateway = createMockProfileGateway();
    gateway.createCvVersion.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    setUp(cvVersionFixture({ status: 'failed', failure: 'model' }), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.tryAgainButton' }),
    );

    expect(await screen.findByText('cv.limitMessage')).toBeInTheDocument();
    expect(gateway.removeCvVersion).not.toHaveBeenCalled();
  });

  it('shows a version made as its review', () => {
    setUp(cvVersionFixture());

    expect(screen.getByText('cv.reviewedProgress')).toBeInTheDocument();
    expect(
      screen.getByRole('article', { name: 'cv.yourCvTitle' }),
    ).toBeInTheDocument();
  });

  describe('a CV written from the profile (D83)', () => {
    it('says it is being written, and how it is checked', () => {
      setUp(
        writtenVersionFixture({
          status: 'creating',
          document: undefined,
          createdAt: Date.now(),
        }),
      );

      expect(
        screen.getByRole('heading', { name: 'cv.writingTitle' }),
      ).toBeInTheDocument();
      expect(screen.getByText('cv.writingChecks')).toBeInTheDocument();
      expect(screen.getByText('cv.writtenJobSub')).toBeInTheDocument();
    });

    it('says it could not be written, and writes it again with the same target and length', async () => {
      const gateway = createMockProfileGateway();
      gateway.createCvVersion.mockResolvedValue({
        versionId: 'w2',
        status: 'creating',
      });
      setUp(
        writtenVersionFixture({
          status: 'failed',
          failure: 'model',
          document: undefined,
          pages: 1,
        }),
        gateway,
      );

      expect(
        screen.getByRole('heading', { name: 'cv.writeFailedTitle' }),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'cv.tryAgainButton' }),
      );

      expect(gateway.createCvVersion).toHaveBeenCalledExactlyOnceWith({
        mode: 'write',
        target: { kind: 'job', applicationId: 'a1' },
        pages: 1,
      });
      expect(gateway.removeCvVersion).toHaveBeenCalledWith('w1');
    });

    it('says which version it was written again from, with how many answers, and links to it', () => {
      const original = writtenVersionFixture({
        id: 'w0',
        createdAt: Date.parse('2026-10-15T09:00:00Z'),
      });
      const again = writtenVersionFixture({ rewrittenFrom: 'w0' });
      const gateway = createMockProfileGateway();
      gateway.getCvVersion.mockImplementation(async (_uid, id) =>
        id === 'w1' ? again : id === 'w0' ? original : null,
      );
      renderCvPage(
        <Routes>
          <Route path="/cv/versions/:versionId" element={<CvVersionScreen />} />
        </Routes>,
        {
          gateway,
          route: '/cv/versions/w1',
          interviewProfile: { uid: 'uid-1', status: 'loaded', resources: [] },
          applications: {
            uid: 'uid-1',
            status: 'loaded',
            applications: [applicationFixture()],
          },
          cvVersions: {
            uid: 'uid-1',
            status: 'loaded',
            versions: [again, original],
            madeToday: 0,
          },
        },
      );

      expect(
        screen.getByText(/cv.writtenAgainFromAnswers/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'cv.openVersionOf' }),
      ).toHaveAttribute('href', '/cv/versions/w0');
    });

    it('shows one that is written as the CV, with what we did and why', () => {
      setUp(writtenVersionFixture());

      expect(
        screen.getByRole('article', { name: 'cv.yourCvTitle' }),
      ).toHaveTextContent('Senior Backend Engineer · Fenwick Pay · London');
      expect(
        screen.getByRole('region', { name: 'cv.notesTitle' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('cv.reviewedProgress')).not.toBeInTheDocument();
    });
  });

  it('is removed, asked first, and goes back to the CV list', async () => {
    const gateway = createMockProfileGateway();
    setUp(cvVersionFixture(), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.removeVersionButton' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'cv.removeDialogTitle' });
    expect(dialog).toHaveTextContent('cv.removeDialogText');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'cv.removeConfirmButton' }),
    );

    expect(gateway.removeCvVersion).toHaveBeenCalledExactlyOnceWith('v1');
    expect(await screen.findByText('at /cv')).toBeInTheDocument();
  });

  it('says when the version is not there', () => {
    setUp(null);

    expect(
      screen.getByRole('heading', { name: 'cv.notFoundTitle' }),
    ).toBeInTheDocument();
  });
});

describe('CvRoutes', () => {
  it('says "not available" to an account without the CV tool', () => {
    renderWithProviders(
      <Routes>
        <Route element={<CvRoutes />}>
          <Route path="/cv" element={<p>the CV page</p>} />
        </Route>
      </Routes>,
      { route: '/cv', flags: { interviewAssistant: true, cvTool: false } },
    );

    expect(screen.getByText('cv.notAvailableDescription')).toBeInTheDocument();
    expect(screen.queryByText('the CV page')).not.toBeInTheDocument();
  });
});
