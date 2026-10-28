// "Practise this question" on the brief's likely questions (X7, D94 slice 2, doc 15 §25.4).
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { BriefTab } from '@/screens/Applications/BriefTab';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { practiceTurnFixture } from '@/testUtil/practiceFixtures';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const QUESTION = 'Why logistics, after five years in payments?';

const application = applicationFixture({
  brief: {
    requirements: [],
    questions: [
      { text: QUESTION, kind: 'motivation', bullets: [] },
      { text: 'Tell me about an incident.', kind: 'behavioural', bullets: [] },
    ],
    applicationRevision: 1,
    profileRevision: 3,
    builtAt: Date.parse('2026-10-10T09:30:00Z'),
  },
});

const PracticePage = () => {
  const { turnId } = useParams();
  return <p>practice page {turnId}</p>;
};

const setUp = ({
  gateway = createMockProfileGateway(),
  textPractice = true,
} = {}) => {
  gateway.getApplication.mockResolvedValue(application);
  renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId"
        element={<BriefTab application={application} />}
      />
      <Route
        path="/applications/:applicationId/practice/:turnId"
        element={<PracticePage />}
      />
    </Routes>,
    {
      gateway,
      route: '/applications/a1',
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [resourceFixture()],
      },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [application],
        profileRevision: 3,
      },
      flags: { textPractice },
    },
  );
  return { gateway };
};

const questions = () =>
  screen.findByRole('region', { name: 'applications.questionsTitle' });

const open = async (user: ReturnType<typeof userEvent.setup>, text: string) =>
  user.click(
    await within(await questions()).findByRole('button', {
      name: new RegExp(text),
    }),
  );

describe('practising the brief’s questions (D94 slice 2)', () => {
  it('without the textPractice flag, offers nothing to practise', async () => {
    const { gateway } = setUp({ textPractice: false });
    const user = userEvent.setup();

    await open(user, 'Why logistics');

    expect(
      screen.queryByRole('button', { name: 'practice.practiseThisButton' }),
    ).not.toBeInTheDocument();
    expect(gateway.getBriefPracticeTurns).not.toHaveBeenCalled();
  });

  it('practises an opened question by its text, then opens the practice under the application', async () => {
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn.mockResolvedValue({ turnId: 'turn-5' });
    setUp({ gateway });
    const user = userEvent.setup();

    expect(
      await within(await questions()).findByText('practice.callsLeft'),
    ).toBeInTheDocument();
    await open(user, 'Why logistics');
    await user.click(
      screen.getByRole('button', { name: 'practice.practiseThisButton' }),
    );

    expect(gateway.startPracticeTurn).toHaveBeenCalledWith({
      applicationId: 'a1',
      question: { source: 'brief', text: QUESTION },
    });
    expect(await screen.findByText('practice page turn-5')).toBeInTheDocument();
  });

  it('marks a practised question, and "Practise again" opens its newest practice', async () => {
    const gateway = createMockProfileGateway();
    gateway.getBriefPracticeTurns.mockResolvedValue([
      practiceTurnFixture({
        id: 'turn-7',
        question: { text: QUESTION, kind: 'motivation', source: 'brief' },
      }),
    ]);
    setUp({ gateway });
    const user = userEvent.setup();

    expect(
      await within(await questions()).findByText('practice.practisedChip'),
    ).toBeInTheDocument();
    expect(gateway.getBriefPracticeTurns).toHaveBeenCalledWith('uid-1', 'a1');
    await open(user, 'Why logistics');

    expect(
      screen.getByRole('link', { name: 'practice.practiseAgainButton' }),
    ).toHaveAttribute('href', '/applications/a1/practice/turn-7');
  });

  it('reads the application again when the brief no longer has the question', async () => {
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.QuestionChanged),
    );
    setUp({ gateway });
    const user = userEvent.setup();

    await open(user, 'Why logistics');
    await user.click(
      screen.getByRole('button', { name: 'practice.practiseThisButton' }),
    );

    expect(
      await screen.findByText('practice.changedMessage'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(gateway.getApplication).toHaveBeenCalledWith('uid-1', 'a1'),
    );
  });
});
