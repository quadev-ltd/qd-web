// Feedback on a typed answer (X7, D94 slice 3, research doc 13 §30): how to practise before the
// first try, "Get feedback" and its wait, the feedback in its sections, "Answer again" and the
// tries to pick from, the 5 tries used with "Start again with new key points", and failures that
// keep what was typed.
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { InterviewPracticeScreen } from './PracticeTurnScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type PracticeTurn } from '@/core/profile/practice';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import {
  PRACTICE_ANSWER,
  practiceAttemptFixture,
  practiceTurnFixture,
} from '@/testUtil/practiceFixtures';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

/** Where the page is, shown outside its routes. */
const Location = () => <p>now at {useLocation().pathname}</p>;

const setUp = (turn: PracticeTurn, gateway = createMockProfileGateway()) => {
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'item-1', kind: 'achievement', resourceId: 'r1' }),
  ]);
  gateway.getPracticeTurn.mockResolvedValue(turn);
  renderProfilePage(
    <>
      <Routes>
        <Route
          path="/applications/:applicationId/interviews/:interviewId/practice/:turnId"
          element={<InterviewPracticeScreen />}
        />
      </Routes>
      <Location />
    </>,
    {
      gateway,
      route: '/applications/a1/interviews/i1/practice/turn-1',
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

const answerField = () =>
  screen.findByRole('textbox', { name: 'practice.answerField' });

const feedback = () =>
  screen.getByRole('region', { name: 'practice.feedbackTitle' });

describe('feedback on a typed answer (X7, D94 slice 3)', () => {
  it('“Try first” hides the key points until the feedback, unless shown now', async () => {
    const user = userEvent.setup();
    setUp(practiceTurnFixture());

    await user.click(
      await screen.findByRole('radio', { name: 'practice.modeTryFirst' }),
    );
    const points = screen.getByRole('region', {
      name: 'practice.keyPointsTitle',
    });
    expect(points).toHaveTextContent('practice.keyPointsHidden');
    expect(within(points).queryByRole('listitem')).not.toBeInTheDocument();

    await user.click(
      within(points).getByRole('button', {
        name: 'practice.showKeyPointsButton',
      }),
    );
    expect(
      within(
        screen.getByRole('region', { name: 'practice.keyPointsTitle' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(3);
  });

  it('sends the answer trimmed, says it is getting feedback, then shows it', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(practiceTurnFixture());
    let resolve: (value: { attempts: number }) => void = () => {};
    gateway.answerPracticeTurn.mockReturnValue(
      new Promise(done => {
        resolve = done;
      }),
    );

    const field = await answerField();
    const send = screen.getByRole('button', {
      name: 'practice.feedbackButton',
    });
    expect(send).toBeDisabled();
    await user.type(field, `  ${PRACTICE_ANSWER}  `);
    await user.click(send);

    expect(gateway.answerPracticeTurn).toHaveBeenCalledWith({
      turnId: 'turn-1',
      answer: PRACTICE_ANSWER,
    });
    expect(field).toHaveAttribute('readonly');
    expect(
      screen.getByRole('button', { name: 'practice.gettingFeedbackButton' }),
    ).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'practice.gettingFeedbackNote',
    );

    gateway.getPracticeTurn.mockResolvedValue(
      practiceTurnFixture({ attempts: [practiceAttemptFixture()] }),
    );
    await act(async () => resolve({ attempts: 1 }));

    expect(
      await screen.findByRole('region', { name: 'practice.feedbackTitle' }),
    ).toHaveTextContent('practice.tryOfChip');
    expect(
      screen.queryByRole('textbox', { name: 'practice.answerField' }),
    ).not.toBeInTheDocument();
    // Answered: no more choice of how to practise
    expect(
      screen.queryByRole('radio', { name: 'practice.modeShow' }),
    ).not.toBeInTheDocument();
  });

  it('shows the answer of the try and its feedback, leaving out the sections that are empty', async () => {
    setUp(
      practiceTurnFixture({
        attempts: [
          practiceAttemptFixture({
            feedback: {
              covered: [],
              missing: ['Who you kept informed.'],
              structure: 'In order.',
              clarity: 'Short.',
              suggestions: ['Say what was at stake.'],
            },
          }),
        ],
      }),
    );

    const answer = await screen.findByRole('region', {
      name: 'practice.yourAnswerTitle',
    });
    expect(answer).toHaveTextContent(PRACTICE_ANSWER);
    expect(answer).toHaveTextContent('practice.tryMeta');
    const sections = within(feedback())
      .getAllByRole('heading', { level: 3 })
      .map(heading => heading.textContent);
    expect(sections).toEqual([
      'practice.missingTitle',
      'practice.structureTitle',
      'practice.clarityTitle',
      'practice.suggestionsTitle',
    ]);
    expect(feedback()).toHaveTextContent('Who you kept informed.');
    expect(feedback()).toHaveTextContent('practice.notToneNote');
  });

  it('answers again in a new field, which Cancel closes; picks between the tries', async () => {
    const user = userEvent.setup();
    setUp(
      practiceTurnFixture({
        attempts: [
          practiceAttemptFixture({ answer: 'My first answer.' }),
          practiceAttemptFixture({ answer: 'My second answer.' }),
        ],
      }),
    );

    // The newest try first
    const tries = await screen.findByRole('group', {
      name: 'practice.triesLabel',
    });
    const buttons = within(tries).getAllByRole('button');
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
    ]);
    expect(
      screen.getByRole('region', { name: 'practice.yourAnswerTitle' }),
    ).toHaveTextContent('My second answer.');
    await user.click(buttons[0]);
    expect(
      screen.getByRole('region', { name: 'practice.yourAnswerTitle' }),
    ).toHaveTextContent('My first answer.');

    await user.click(
      screen.getByRole('button', { name: 'practice.answerAgainButton' }),
    );
    const field = await answerField();
    expect(field).toHaveFocus();
    expect(field).toHaveValue('');
    expect(
      screen.queryByRole('button', { name: 'practice.answerAgainButton' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'practice.cancelButton' }),
    );
    expect(
      screen.queryByRole('textbox', { name: 'practice.answerField' }),
    ).not.toBeInTheDocument();
  });

  it('after 5 tries, starts again with new key points: the same question, a new practice', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(
      practiceTurnFixture({
        attempts: Array.from({ length: 5 }, () => practiceAttemptFixture()),
      }),
    );
    gateway.startPracticeTurn.mockResolvedValue({ turnId: 'turn-2' });

    expect(await screen.findByText('practice.triesUsedMessage')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'practice.answerAgainButton' }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'practice.restartButton' }),
    );

    expect(gateway.startPracticeTurn).toHaveBeenCalledWith({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'interview', listId: 'list-1', questionId: 'q1' },
    });
    expect(
      await screen.findByText(
        'now at /applications/a1/interviews/i1/practice/turn-2',
      ),
    ).toBeVisible();
  });

  it('can’t start again once its interview was removed', async () => {
    setUp(
      practiceTurnFixture({
        interviewRemoved: true,
        attempts: Array.from({ length: 5 }, () => practiceAttemptFixture()),
      }),
    );

    expect(await screen.findByText('practice.triesUsedMessage')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'practice.restartButton' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the answer when the feedback fails, to send again', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(practiceTurnFixture());
    gateway.answerPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Unknown),
    );

    await user.type(await answerField(), 'I opened the incident.');
    await user.click(
      screen.getByRole('button', { name: 'practice.feedbackButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.answerFailedMessage',
    );
    expect(await answerField()).toHaveValue('I opened the incident.');
    expect(
      screen.getByRole('button', { name: 'practice.feedbackButton' }),
    ).toBeEnabled();
  });

  it('says when today’s practice calls are used, and keeps the answer', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(practiceTurnFixture());
    gateway.answerPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );

    await user.type(await answerField(), 'I opened the incident.');
    await user.click(
      screen.getByRole('button', { name: 'practice.feedbackButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.limitMessage',
    );
    expect(await answerField()).toHaveValue('I opened the incident.');
  });

  it('shows the turn as it is now when its 5 tries were used in another tab', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(practiceTurnFixture());
    gateway.answerPracticeTurn.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MaxPracticeAttempts),
    );

    await user.type(await answerField(), 'I opened the incident.');
    gateway.getPracticeTurn.mockResolvedValue(
      practiceTurnFixture({
        attempts: Array.from({ length: 5 }, () => practiceAttemptFixture()),
      }),
    );
    await user.click(
      screen.getByRole('button', { name: 'practice.feedbackButton' }),
    );

    expect(await screen.findByText('practice.triesUsedMessage')).toBeVisible();
  });
});
