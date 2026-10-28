// Practising an interview's likely questions (X7, D94 slice 2, doc 15 §25): "Practise" on each
// question, its newest practice marked, a question of the candidate's own, and what is refused.
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useParams } from 'react-router';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import {
  type ApplicationInterview,
  type InterviewQuestions,
} from '@/core/profile/interviews';
import { type PracticeTurn } from '@/core/profile/practice';
import { InterviewScreen } from '@/screens/Applications/interviews/InterviewScreen';
import {
  applicationFixture,
  interviewFixture,
} from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const questions = (more: Partial<InterviewQuestions> = {}) => ({
  listId: 'list-1',
  items: [1, 2, 3].map(index => ({
    id: `q${index}`,
    text: `Question ${index}?`,
    kind: 'behavioural' as const,
    why: `Why ${index}.`,
  })),
  builtAt: Date.parse('2026-10-25T09:00:00Z'),
  interviewRevision: 1,
  applicationRevision: 1,
  profileRevision: 3,
  ...more,
});

const turn = (
  id: string,
  questionId: string,
  updatedAt: number,
): PracticeTurn => ({
  id,
  applicationId: 'a1',
  application: {},
  interviewId: 'i1',
  question: {
    text: 'Question?',
    kind: 'behavioural',
    source: 'interview',
    listId: 'list-1',
    questionId,
  },
  keyPoints: [],
  attempts: [],
  createdAt: updatedAt,
  updatedAt,
});

const PracticePage = () => {
  const { turnId } = useParams();
  return <p>practice page {turnId}</p>;
};

const setUp = ({
  interview = interviewFixture({ questions: questions() }),
  gateway = createMockProfileGateway(),
}: {
  interview?: ApplicationInterview;
  gateway?: ReturnType<typeof createMockProfileGateway>;
} = {}) => {
  const application = applicationFixture();
  gateway.getInterviews.mockResolvedValue([interview]);
  gateway.getApplication.mockResolvedValue(application);
  gateway.getProfileRevision.mockResolvedValue(3);
  renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId/interviews/:interviewId"
        element={<InterviewScreen />}
      />
      <Route
        path="/applications/:applicationId/interviews/:interviewId/practice/:turnId"
        element={<PracticePage />}
      />
    </Routes>,
    {
      gateway,
      route: '/applications/a1/interviews/i1',
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [application],
        profileRevision: 3,
      },
      flags: { textPractice: true },
    },
  );
  return { gateway };
};

const card = () =>
  screen.findByRole('region', { name: 'interviews.questionsTitle' });

describe('practising an interview’s likely questions (D94 slice 2)', () => {
  it('offers "Practise" on each question with the calls left, says so while the key points are written, then opens the practice', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    let finish: () => void = () => undefined;
    gateway.startPracticeTurn.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ turnId: 'turn-9' });
        }),
    );
    gateway.getPracticeToday.mockResolvedValue(2);
    setUp({ gateway });

    const region = await card();
    expect(
      await within(region).findByText('practice.callsLeft'),
    ).toBeInTheDocument();
    const buttons = within(region).getAllByRole('button', {
      name: 'practice.practiseButton',
    });
    expect(buttons).toHaveLength(3);
    await user.click(buttons[1]);

    expect(gateway.startPracticeTurn).toHaveBeenCalledWith({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'interview', listId: 'list-1', questionId: 'q2' },
    });
    expect(
      await within(region).findByRole('button', {
        name: 'practice.startingButton',
      }),
    ).toHaveAttribute('aria-busy', 'true');
    // One at a time.
    for (const other of within(region).getAllByRole('button', {
      name: 'practice.practiseButton',
    })) {
      expect(other).toBeDisabled();
    }

    finish();

    expect(await screen.findByText('practice page turn-9')).toBeInTheDocument();
  });

  it('marks a practised question with its newest practice, which "Practise again" opens', async () => {
    const gateway = createMockProfileGateway();
    gateway.getListPracticeTurns.mockResolvedValue([
      turn('old', 'q1', 100),
      turn('new', 'q1', 200),
    ]);
    setUp({ gateway });

    const region = await card();
    const again = await within(region).findByRole('link', {
      name: 'practice.practiseAgainButton',
    });
    expect(again).toHaveAttribute(
      'href',
      '/applications/a1/interviews/i1/practice/new',
    );
    expect(within(region).getByText('practice.practisedChip')).toBeVisible();
    expect(
      within(region).getAllByRole('button', {
        name: 'practice.practiseButton',
      }),
    ).toHaveLength(2);
    expect(gateway.getListPracticeTurns).toHaveBeenCalledWith(
      'uid-1',
      'i1',
      'list-1',
    );
  });

  it('practises a list written before it had an id, then reads the interview again', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    // The call gave the list its id.
    gateway.getInterview.mockResolvedValue(
      interviewFixture({ questions: questions({ listId: 'list-9' }) }),
    );
    setUp({
      gateway,
      interview: interviewFixture({
        questions: questions({ listId: undefined }),
      }),
    });

    await user.click(
      within(await card()).getAllByRole('button', {
        name: 'practice.practiseButton',
      })[0],
    );

    expect(gateway.startPracticeTurn).toHaveBeenCalledWith({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'interview', questionId: 'q1' },
    });
    expect(await screen.findByText('practice page turn-1')).toBeInTheDocument();
    expect(gateway.getInterview).toHaveBeenCalledWith('uid-1', 'a1', 'i1');
  });

  it('with no calls left today, cannot practise, and says so when the backend refuses', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getAllByRole('button', {
        name: 'practice.practiseButton',
      })[0],
    );

    const region = await card();
    expect(
      await within(region).findByText('practice.limitMessage'),
    ).toBeInTheDocument();
    for (const button of within(region).getAllByRole('button', {
      name: 'practice.practiseButton',
    })) {
      expect(button).toBeDisabled();
    }
    expect(
      within(region).getByRole('button', { name: 'practice.ownButton' }),
    ).toBeDisabled();
  });

  it('is disabled once today’s calls are used', async () => {
    const gateway = createMockProfileGateway();
    gateway.getPracticeToday.mockResolvedValue(40);
    setUp({ gateway });

    const region = await card();
    await waitFor(() => {
      for (const button of within(region).getAllByRole('button', {
        name: 'practice.practiseButton',
      })) {
        expect(button).toBeDisabled();
      }
    });
  });

  it('reads the list again when its questions changed meanwhile, and says so', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.QuestionChanged),
    );
    gateway.getInterview.mockResolvedValue(
      interviewFixture({ questions: questions({ listId: 'list-2' }) }),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getAllByRole('button', {
        name: 'practice.practiseButton',
      })[0],
    );

    expect(
      await screen.findByText('practice.changedMessage'),
    ).toBeInTheDocument();
    expect(gateway.getInterview).toHaveBeenCalledWith('uid-1', 'a1', 'i1');
    await waitFor(() =>
      expect(gateway.getListPracticeTurns).toHaveBeenCalledWith(
        'uid-1',
        'i1',
        'list-2',
      ),
    );
  });

  it('offers to try again when the key points could not be written', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Unknown))
      .mockResolvedValueOnce({ turnId: 'turn-2' });
    setUp({ gateway });

    await user.click(
      within(await card()).getAllByRole('button', {
        name: 'practice.practiseButton',
      })[2],
    );
    expect(
      await screen.findByText('practice.failedMessage'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'practice.retryButton' }),
    );

    expect(await screen.findByText('practice page turn-2')).toBeInTheDocument();
    expect(gateway.startPracticeTurn).toHaveBeenLastCalledWith({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'interview', listId: 'list-1', questionId: 'q3' },
    });
  });

  it('practises a question of the candidate’s own from a side panel', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    setUp({ gateway });

    await user.click(
      within(await card()).getByRole('button', { name: 'practice.ownButton' }),
    );
    const panel = await screen.findByRole('dialog', {
      name: 'practice.ownTitle',
    });
    await user.click(
      within(panel).getByRole('button', { name: 'practice.ownSubmit' }),
    );
    expect(
      within(panel).getByText('practice.ownRequiredError'),
    ).toBeInTheDocument();
    expect(gateway.startPracticeTurn).not.toHaveBeenCalled();

    await user.type(
      within(panel).getByRole('textbox', { name: 'practice.ownField' }),
      '  Why logistics?  ',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'practice.ownSubmit' }),
    );

    expect(gateway.startPracticeTurn).toHaveBeenCalledWith({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'typed', text: 'Why logistics?' },
    });
    expect(await screen.findByText('practice page turn-1')).toBeInTheDocument();
  });

  it('keeps the panel open with what went wrong when a question of the candidate’s own is refused', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.startPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MaxPracticeTurns),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getByRole('button', { name: 'practice.ownButton' }),
    );
    const panel = await screen.findByRole('dialog', {
      name: 'practice.ownTitle',
    });
    await user.type(
      within(panel).getByRole('textbox', { name: 'practice.ownField' }),
      'Why us?',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'practice.ownSubmit' }),
    );

    expect(
      await within(panel).findByText('practice.turnLimitMessage'),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole('textbox', { name: 'practice.ownField' }),
    ).toHaveValue('Why us?');
  });
});
