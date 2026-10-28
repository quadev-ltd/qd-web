import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import {
  BriefPracticeScreen,
  InterviewPracticeScreen,
} from './PracticeTurnScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { practiceTurnFixture } from '@/testUtil/practiceFixtures';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const setUp = ({
  route = '/applications/a1/interviews/i1/practice/turn-1',
  gateway = createMockProfileGateway(),
}: {
  route?: string;
  gateway?: ReturnType<typeof createMockProfileGateway>;
} = {}) => {
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'item-1', kind: 'achievement', resourceId: 'r1' }),
  ]);
  renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId/interviews/:interviewId/practice/:turnId"
        element={<InterviewPracticeScreen />}
      />
      <Route
        path="/applications/:applicationId/practice/:turnId"
        element={<BriefPracticeScreen />}
      />
      <Route
        path="/applications/:applicationId/interviews/:interviewId"
        element={<p>the interview</p>}
      />
      <Route path="/applications/:applicationId" element={<p>the brief</p>} />
    </Routes>,
    {
      gateway,
      route,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [resourceFixture()],
      },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
        profileRevision: 3,
      },
      flags: { textPractice: true },
    },
  );
  return { gateway };
};

const breadcrumb = () =>
  within(screen.getByRole('navigation', { name: 'breadcrumb.label' }));

describe('a question practised (X7, D94 slice 2)', () => {
  it('shows the question with its kind and where it came from, the way back to its interview, and its key points', async () => {
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurn.mockResolvedValue(practiceTurnFixture());
    setUp({ gateway });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Tell me about an incident you led from alert to fix.',
      }),
    ).toBeInTheDocument();
    expect(gateway.getPracticeTurn).toHaveBeenCalledWith('uid-1', 'turn-1');
    expect(screen.getByText('applications.questionBehavioural')).toBeVisible();
    expect(screen.getByText('practice.sourceInterview')).toBeVisible();
    expect(
      screen.getByText(
        'Technical interview · Senior Backend Engineer, Northwind Logistics',
      ),
    ).toBeVisible();
    expect(
      breadcrumb()
        .getAllByRole('link')
        .map(link => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['applications.title', '/applications'],
      ['Senior Backend Engineer', '/applications/a1'],
      ['applications.interviewsTab', '/applications/a1/interviews'],
      ['Technical interview', '/applications/a1/interviews/i1'],
    ]);

    const points = within(
      screen.getByRole('region', { name: 'practice.keyPointsTitle' }),
    ).getAllByRole('listitem');
    expect(points).toHaveLength(3);
    // The item's kind and its resource.
    expect(
      await within(points[0]).findByText('applications.itemSource'),
    ).toBeInTheDocument();
    // An item removed since: its text, with no source.
    expect(within(points[1]).getByText('The on-call redesign')).toBeVisible();
    expect(
      within(points[1]).queryByText('applications.itemSource'),
    ).not.toBeInTheDocument();
    expect(
      within(points[2]).getByText('applications.adviceChip'),
    ).toBeVisible();
    // Answering comes with the backend's slice 3.
    expect(
      screen.getByRole('region', { name: 'practice.answerTitle' }),
    ).toHaveTextContent('home.comingSoonChip');
  });

  it('opened from the brief, leads back to the brief', async () => {
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurn.mockResolvedValue(
      practiceTurnFixture({
        interviewId: undefined,
        interview: undefined,
        question: {
          text: 'Why logistics, after five years in payments?',
          kind: 'motivation',
          source: 'brief',
        },
      }),
    );
    setUp({ gateway, route: '/applications/a1/practice/turn-1' });

    expect(await screen.findByText('practice.sourceBrief')).toBeInTheDocument();
    expect(
      screen.getByText('Senior Backend Engineer, Northwind Logistics'),
    ).toBeVisible();
    expect(
      breadcrumb()
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual([
      'applications.title',
      'Senior Backend Engineer',
      'applications.briefTab',
    ]);
    // At phone width, one link back.
    expect(
      screen.getByRole('link', {
        name: 'Senior Backend Engineer · applications.briefTab',
      }),
    ).toHaveAttribute('href', '/applications/a1');
  });

  it('says a practice that is gone isn’t here any more, with the way back', async () => {
    setUp();

    expect(
      await screen.findByRole('heading', { name: 'practice.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'practice.notFoundLink' }),
    ).toHaveAttribute('href', '/applications/a1/interviews/i1');
  });

  it('offers to read it again when it could not be read', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurn
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Network))
      .mockResolvedValueOnce(practiceTurnFixture());
    setUp({ gateway });

    await user.click(
      await screen.findByRole('button', { name: 'practice.retryButton' }),
    );

    expect(
      await screen.findByRole('region', { name: 'practice.keyPointsTitle' }),
    ).toBeInTheDocument();
  });

  it('removes it after asking, and goes back where it was opened from', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurn.mockResolvedValue(practiceTurnFixture());
    setUp({ gateway });

    await user.click(
      await screen.findByRole('button', { name: 'practice.removeLink' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'practice.removeDialogTitle',
    });
    await user.click(
      within(dialog).getByRole('button', {
        name: 'practice.removeConfirmButton',
      }),
    );

    expect(gateway.removePracticeTurn).toHaveBeenCalledWith('turn-1');
    expect(await screen.findByText('the interview')).toBeInTheDocument();
  });

  it('keeps the dialog open and says so when it could not be removed', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurn.mockResolvedValue(practiceTurnFixture());
    gateway.removePracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    setUp({ gateway });

    await user.click(
      await screen.findByRole('button', { name: 'practice.removeLink' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'practice.removeConfirmButton' }),
    );

    expect(
      await screen.findByText('practice.removeFailedMessage'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: 'practice.removeDialogTitle' }),
    ).toBeInTheDocument();
  });
});
