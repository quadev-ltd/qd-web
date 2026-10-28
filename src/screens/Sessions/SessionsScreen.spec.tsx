import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { groupsOf, SessionsScreen } from './SessionsScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { practiceTurnFixture } from '@/testUtil/practiceFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const DAY = 86_400_000;
const AT = Date.parse('2026-10-25T10:00:00Z');

/** Two jobs' practice: Northwind's (there) and Lumen Bank's (removed). */
const turns = [
  practiceTurnFixture({ id: 't1', updatedAt: AT }),
  practiceTurnFixture({
    id: 't2',
    updatedAt: AT - DAY,
    question: {
      text: 'Why logistics, after five years in payments?',
      kind: 'motivation',
      source: 'brief',
    },
  }),
  practiceTurnFixture({
    id: 't3',
    applicationId: 'gone',
    application: { title: 'Data Engineer', company: 'Lumen Bank' },
    applicationRemoved: true,
    interviewRemoved: true,
    updatedAt: AT - 7 * DAY,
    attempts: [{}],
    question: {
      text: 'How have you kept a data pipeline correct?',
      kind: 'technical',
      source: 'typed',
    },
  }),
];

const setUp = (gateway = createMockProfileGateway()) => {
  renderProfilePage(<SessionsScreen />, {
    gateway,
    route: '/sessions',
    interviewProfile: { uid: 'uid-1', status: 'loaded' },
    applications: {
      uid: 'uid-1',
      status: 'loaded',
      // Renamed since its practice started.
      applications: [applicationFixture({ title: 'Staff Backend Engineer' })],
      profileRevision: 3,
    },
    flags: { textPractice: true },
  });
  return { gateway };
};

describe('groupsOf', () => {
  it('puts each job’s practice together, the most recently practised job first, named as it is now or as it was', () => {
    const groups = groupsOf(
      [...turns].reverse(),
      [applicationFixture({ title: 'Staff Backend Engineer' })],
      'Untitled',
    );

    expect(
      groups.map(({ title, company, removed, turns: shown }) => [
        title,
        company,
        removed,
        shown.map(({ id }) => id),
      ]),
    ).toEqual([
      ['Staff Backend Engineer', 'Northwind Logistics', false, ['t1', 't2']],
      ['Data Engineer', 'Lumen Bank', true, ['t3']],
    ]);
  });
});

describe('Sessions (R1, D94)', () => {
  it('shows the practice kept, one card per job, each question opening its practice', async () => {
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurns.mockResolvedValue(turns);
    setUp(gateway);

    const northwind = await screen.findByRole('region', {
      name: 'Staff Backend Engineer',
    });
    expect(northwind).toHaveTextContent(
      'Northwind Logistics · sessions.questions',
    );
    const rows = within(northwind).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(
      within(rows[0]).getByRole('link', {
        name: 'Tell me about an incident you led from alert to fix.',
      }),
    ).toHaveAttribute('href', '/sessions/t1');
    expect(rows[0]).toHaveTextContent('Technical interview · 25 Oct 2026');
    expect(rows[1]).toHaveTextContent('sessions.fromBrief · 24 Oct 2026');
    expect(
      within(northwind).queryByRole('button', {
        name: 'sessions.removeAllButton',
      }),
    ).not.toBeInTheDocument();

    const lumen = screen.getByRole('region', { name: 'Data Engineer' });
    expect(lumen).toHaveTextContent('sessions.applicationRemovedChip');
    expect(lumen).toHaveTextContent('sessions.typed · sessions.tries');
    expect(screen.getByText('sessions.removedNote')).toBeVisible();
  });

  it('removes a removed application’s practice after asking, then reads Sessions again (D99)', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurns
      .mockResolvedValueOnce(turns)
      .mockResolvedValue(turns.slice(0, 2));
    gateway.removeApplicationPractice.mockResolvedValue({ removed: 1 });
    setUp(gateway);

    await user.click(
      within(
        await screen.findByRole('region', { name: 'Data Engineer' }),
      ).getByRole('button', { name: 'sessions.removeAllButton' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'sessions.removeAllTitle',
    });
    expect(dialog).toHaveTextContent('sessions.removeAllText');
    await user.click(
      within(dialog).getByRole('button', { name: 'sessions.removeAllConfirm' }),
    );

    expect(gateway.removeApplicationPractice).toHaveBeenCalledWith('gone');
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Data Engineer' }),
      ).not.toBeInTheDocument(),
    );
    expect(gateway.getPracticeTurns).toHaveBeenCalledTimes(2);
  });

  it('keeps the dialog open and says so when the practice could not be removed', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurns.mockResolvedValue(turns);
    gateway.removeApplicationPractice.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    setUp(gateway);

    await user.click(
      await screen.findByRole('button', { name: 'sessions.removeAllButton' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'sessions.removeAllConfirm' }),
    );

    expect(
      await screen.findByText('sessions.removeFailedMessage'),
    ).toBeInTheDocument();
  });

  it('says nothing is practised yet, with the way to the applications', async () => {
    setUp();

    expect(
      await screen.findByRole('heading', { name: 'sessions.emptyTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'sessions.emptyLink' }),
    ).toHaveAttribute('href', '/applications');
  });

  it('offers to read it again when it could not be read', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getPracticeTurns
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Network))
      .mockResolvedValueOnce(turns);
    setUp(gateway);

    await user.click(
      await screen.findByRole('button', { name: 'sessions.retryButton' }),
    );

    expect(
      await screen.findByRole('region', { name: 'Data Engineer' }),
    ).toBeInTheDocument();
  });
});
