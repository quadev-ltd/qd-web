import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApplicationCvTab } from './ApplicationCvTab';

import { applicationFixture } from '@/testUtil/applicationFixtures';
import { cvVersionFixture } from '@/testUtil/cvVersionFixtures';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const job = applicationFixture({
  job: { source: 'text', status: 'ready', edited: false },
});

const setUp = (versions: ReturnType<typeof cvVersionFixture>[]) =>
  renderCvPage(<ApplicationCvTab application={job} />, {
    interviewProfile: {
      uid: 'uid-1',
      status: 'loaded',
      resources: [resourceFixture({ textAt: 1_500 })],
    },
    applications: { uid: 'uid-1', status: 'loaded', applications: [job] },
    cvVersions: { uid: 'uid-1', status: 'loaded', versions },
  });

describe('ApplicationCvTab', () => {
  it('shows the version sent with the job’s words it doesn’t show, and the others', () => {
    setUp([
      cvVersionFixture({
        id: 'v1',
        sentAt: 1,
        changes: [],
        questions: [],
        unsupportedJobTerms: ['running Kafka at scale', 'logistics'],
      }),
      cvVersionFixture({ id: 'v2' }),
      cvVersionFixture({
        id: 'v3',
        target: { kind: 'job', applicationId: 'other' },
      }),
    ]);

    const sent = screen.getByRole('region', { name: 'cv.versionOf' });
    expect(sent).toHaveTextContent('cv.sentChip');
    expect(sent).toHaveTextContent('cv.notShownIn');
    expect(
      within(sent).getByRole('link', { name: 'cv.openButton' }),
    ).toHaveAttribute('href', '/applications/a1/cv/versions/v1');
    expect(
      within(sent).getByRole('button', { name: 'cv.downloadPdfButton' }),
    ).toBeInTheDocument();
    // Only this job's other versions
    const others = screen.getByRole('region', {
      name: 'cv.otherVersionsTitle',
    });
    expect(within(others).getAllByRole('link')).toHaveLength(1);
  });

  it('opens "New CV version" on this job', async () => {
    setUp([]);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.newForJobButton' }),
    );

    const panel = screen.getByRole('dialog', { name: 'cv.newTitle' });
    expect(within(panel).queryByText('cv.forLabel')).not.toBeInTheDocument();
    expect(
      within(panel).getByRole('radio', { name: /Senior Backend Engineer/ }),
    ).toBeChecked();
  });
});
