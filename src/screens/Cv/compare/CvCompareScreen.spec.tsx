import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { CvCompareScreen } from './CvCompareScreen';

import { applicationFixture } from '@/testUtil/applicationFixtures';
import { cvVersionFixture } from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const OCT_11 = Date.parse('2026-10-11T10:00:00Z');
const OCT_14 = Date.parse('2026-10-14T10:00:00Z');

/** The earlier one sent, the later one with its rewrite accepted. */
const earlier = cvVersionFixture({
  id: 'v1',
  createdAt: OCT_11,
  sentAt: OCT_11,
  changes: [],
  questions: [],
});
const later = cvVersionFixture({
  id: 'v2',
  createdAt: OCT_14,
  questions: [],
  changes: cvVersionFixture().changes.map(change => ({
    ...change,
    decision: 'accepted' as const,
  })),
});
const general = cvVersionFixture({
  id: 'v3',
  target: { kind: 'general' },
  createdAt: OCT_14,
});

const setUp = (route: string, gateway = createMockProfileGateway()) =>
  renderCvPage(
    <Routes>
      <Route path="/cv/compare" element={<CvCompareScreen />} />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route,
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
      },
      cvVersions: {
        uid: 'uid-1',
        status: 'loaded',
        versions: [later, earlier, general],
      },
    },
  );

describe('CvCompareScreen', () => {
  it('compares a version with the earlier one for the same job, and shows only what differs', async () => {
    setUp('/cv/compare?later=v2');

    expect(
      screen.getByRole('combobox', { name: 'cv.earlierLabel' }),
    ).toHaveValue('v1');
    // Only the versions for this job: not the general one
    expect(
      within(
        screen.getByRole('combobox', { name: 'cv.laterLabel' }),
      ).getAllByRole('option'),
    ).toHaveLength(2);
    const differences = screen.getByRole('region', { name: 'cv.differences' });
    expect(within(differences).getAllByRole('listitem')).toHaveLength(1);
    expect(differences).toHaveTextContent('cv.diff_changed');
    expect(differences).toHaveTextContent(
      'Built the reconciliation service that matches two million card transactions a day.',
    );

    await userEvent.click(
      screen.getByRole('switch', { name: 'cv.onlyDiffers' }),
    );
    expect(within(differences).getAllByRole('listitem').length).toBeGreaterThan(
      1,
    );
  });

  it('restores the earlier one as a copy, and opens it', async () => {
    const gateway = createMockProfileGateway();
    gateway.copyCvVersion.mockResolvedValue({ versionId: 'v9' });
    setUp('/cv/compare?later=v2', gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.restoreButton' }),
    );

    expect(gateway.copyCvVersion).toHaveBeenCalledExactlyOnceWith('v1');
    expect(await screen.findByText('at /cv/versions/v9')).toBeInTheDocument();
  });

  it('says when there is nothing to compare with', () => {
    setUp('/cv/compare?later=v3');

    expect(screen.getByText('cv.compareNeedsTwo')).toBeInTheDocument();
  });
});
