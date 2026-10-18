import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { CvRoutes } from './CvRoutes';
import { CvVersionScreen } from './CvVersionScreen';

import { CV_CREATING_STALE_MS } from '@/core/profile/cvVersions';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { CV_TEXT, cvVersionFixture } from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const setUp = (
  version: ReturnType<typeof cvVersionFixture> | null,
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
      route: '/cv/versions/v1',
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

    expect(gateway.createCvVersion).toHaveBeenCalledExactlyOnceWith({
      resourceId: 'r1',
      target: { kind: 'job', applicationId: 'a1' },
      length: 'two-pages',
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

  it('shows a version made with its CV and what is left to review', () => {
    setUp(cvVersionFixture());

    const text = screen.getByRole('region', { name: 'cv.yourCvTitle' });
    expect(text).toHaveTextContent('cv.toReviewMessage');
    // Nothing is accepted yet: the CV as it was.
    expect(text).toHaveTextContent(CV_TEXT.split('\n')[2].slice(2));
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
