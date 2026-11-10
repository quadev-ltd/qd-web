// Feedback on a mock interview (D101; Web-X6-End, Web-R2-Mock, Web-R2-Mock-Feedback-States): "How
// it went" and one answer's feedback in each state, asking for it again, and reading the session
// again while it is written. The pages around them are MockScreens.spec's.
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  MOCK_FEEDBACK_MAX_READS,
  MOCK_FEEDBACK_POLL_MS,
  MockAnswerFeedback,
  type MockFeedbackControls,
  MockOverallCard,
  type MockPractise,
  useMockFeedback,
} from './MockFeedback';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import {
  type MockAnswerFeedbackState,
  type MockOverallState,
  type MockSession,
  MockSessionSchema,
} from '@/core/profile/mockInterviews';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const FEEDBACK = {
  covered: ['You named the method.'],
  missing: ['Your own part.'],
  structure: 'In order.',
  clarity: 'About 30 seconds.',
  suggestions: ['Start with what was at stake.'],
  example: 'I led it.',
};

const turn = (id: string, status: string, question: string) => ({
  id,
  kind: 'planned',
  planId: 'p1',
  question,
  status,
  ...(status === 'answered'
    ? { answer: { transcript: 'I did it.', spokenMs: 31_000, words: 3 } }
    : {}),
  repeats: 0,
  askedAt: 1,
  answeredAt: status === 'answered' ? Date.now() : null,
});

const SESSION: MockSession = MockSessionSchema.parse({
  id: 's1',
  applicationId: 'a1',
  application: { title: 'Senior Backend Engineer' },
  status: 'ended',
  endReason: 'finished',
  plan: { questions: [] },
  turns: [
    turn('t1', 'answered', 'Tell me about yourself.'),
    turn('t2', 'answered', 'An incident you led?'),
    turn('t3', 'skipped', 'Design a pipeline.'),
  ],
  startedAt: 1,
  endedAt: Date.now(),
  pausedAt: null,
  pausedMs: 0,
  createdAt: 1,
  updatedAt: 1,
});

const controls = (
  overrides: Partial<MockFeedbackControls> = {},
): MockFeedbackControls => ({
  reading: { now: Date.now(), retried: new Set() },
  slow: false,
  checkAgain: vi.fn(),
  retryAnswer: vi.fn(),
  retryOverall: vi.fn(),
  asks: {},
  ...overrides,
});

const practising = (overrides: Partial<MockPractise> = {}): MockPractise => ({
  isStarting: () => false,
  disabled: false,
  practise: vi.fn(),
  failureOf: () => null,
  ...overrides,
});

describe('"How it went" (Web-X6-End, Web-R2-Mock)', () => {
  const renderCard = (
    state: MockOverallState,
    {
      page = 'sessions',
      feedback = controls(),
      practise,
    }: {
      page?: 'end' | 'sessions';
      feedback?: MockFeedbackControls;
      practise?: MockPractise;
    } = {},
  ) =>
    renderProfilePage(
      <MockOverallCard
        session={SESSION}
        state={state}
        page={page}
        feedback={feedback}
        practise={practise}
      />,
    );

  const READY: MockOverallState = {
    status: 'ready',
    overall: {
      status: 'ready',
      wentWell: ['Your answers were concrete.'],
      workOn: ['Say your own part at the start.', 'Up to 2 minutes is fine.'],
      practiseAgain: [
        { turnId: 't3', reason: 'Skipped' },
        { turnId: 't9', reason: 'Not a turn of this session' },
      ],
    },
  };

  it('ready: what went well, what to work on, and the questions worth practising again', async () => {
    const user = userEvent.setup();
    const practise = practising();
    renderCard(READY, { practise });

    const card = screen.getByRole('region', { name: 'mock.overallTitle' });
    expect(card).toHaveTextContent('mock.overallFrom');
    expect(card).toHaveTextContent('Your answers were concrete.');
    expect(card).toHaveTextContent('Say your own part at the start.');
    // A turn the session doesn't have is left out
    expect(card).toHaveTextContent('Design a pipeline.');
    expect(card).not.toHaveTextContent('Not a turn of this session');
    expect(card).toHaveTextContent('mock.notToneNote');

    await user.click(
      screen.getByRole('button', { name: 'mock.practiseItButton' }),
    );
    expect(practise.practise).toHaveBeenCalledWith('t3', 'overall');
  });

  it('ready, without text practice: the questions without "Practise it"', () => {
    renderCard(READY);
    expect(screen.getByText('Design a pipeline.')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'mock.practiseItButton' }),
    ).not.toBeInTheDocument();
  });

  it('preparing: how many answers are ready, and what to do meanwhile on each page', () => {
    const { unmount } = renderCard(
      { status: 'writing', ready: 3, of: 5 },
      { page: 'end' },
    );
    expect(screen.getByText('mock.overallPreparing')).toBeVisible();
    expect(screen.getByText('mock.overallPreparingEnd')).toBeVisible();
    unmount();
    renderCard({ status: 'writing', ready: 3, of: 5 });
    expect(screen.getByText('mock.overallPreparingSessions')).toBeVisible();
  });

  it('taking longer than usual: "Check again" reads it again', async () => {
    const user = userEvent.setup();
    const feedback = controls({ slow: true });
    renderCard({ status: 'writing', ready: 4, of: 5 }, { feedback });
    expect(screen.getByText('mock.feedbackSlowMessage')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.checkAgainButton' }),
    );
    expect(feedback.checkAgain).toHaveBeenCalledOnce();
  });

  it('couldn’t write it: "Try again" asks for the overall view', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    renderCard({ status: 'failed' }, { feedback });
    expect(screen.getByRole('alert')).toHaveTextContent('mock.overallFailed');
    await user.click(screen.getByRole('button', { name: 'mock.retryButton' }));
    expect(feedback.retryOverall).toHaveBeenCalledWith([]);
  });

  it('today’s limit: when it can be had, then "Get feedback" once the limit has reset', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    const { unmount } = renderCard({ status: 'quota', reset: false });
    expect(screen.getByText('mock.overallLimit')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();
    renderCard({ status: 'quota', reset: true }, { feedback });
    await user.click(
      screen.getByRole('button', { name: 'mock.getFeedbackButton' }),
    );
    expect(feedback.retryOverall).toHaveBeenCalledWith([]);
  });

  it('one answer: no overall view, and where its feedback is', () => {
    const { unmount } = renderCard({ status: 'none' }, { page: 'end' });
    expect(screen.getByText('mock.overallNoneEnd')).toBeVisible();
    unmount();
    renderCard({ status: 'none' });
    expect(screen.getByText('mock.overallNoneSessions')).toBeVisible();
  });

  it('no feedback yet (before F1): "Get feedback on your answers" asks for those with none', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    renderCard({ status: 'missing', turnIds: ['t1', 't2'] }, { feedback });
    expect(screen.getByText('mock.overallMissingAnswers')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.getAnswersFeedbackButton' }),
    );
    expect(feedback.retryOverall).toHaveBeenCalledWith(['t1', 't2']);
  });

  it('asking again: busy meanwhile, then why it didn’t go through', () => {
    const { unmount } = renderCard(
      { status: 'missing', turnIds: [] },
      { feedback: controls({ asks: { overall: { status: 'asking' } } }) },
    );
    expect(
      screen.getByRole('button', { name: 'mock.getFeedbackButton' }),
    ).toBeDisabled();
    unmount();
    renderCard(
      { status: 'failed' },
      {
        feedback: controls({
          asks: { overall: { status: 'failed', limit: true } },
        }),
      },
    );
    expect(screen.getByText('mock.retryFeedbackLimit')).toBeVisible();
  });
});

describe('one answer’s feedback (Web-R2-Mock, -Feedback-States)', () => {
  const renderAnswer = (
    state: MockAnswerFeedbackState | null,
    {
      feedback = controls(),
      practise,
    }: { feedback?: MockFeedbackControls; practise?: MockPractise } = {},
  ) =>
    renderProfilePage(
      <MockAnswerFeedback
        turnId="t1"
        state={state}
        feedback={feedback}
        practise={practise}
      />,
    );

  it('ready: "Show feedback" opens text practice’s sections, "Hide feedback" closes them', async () => {
    const user = userEvent.setup();
    renderAnswer({ status: 'ready', feedback: FEEDBACK });
    expect(screen.queryByText('You named the method.')).not.toBeInTheDocument();

    const show = screen.getByRole('button', {
      name: 'mock.showFeedbackButton',
    });
    expect(show).toHaveAttribute('aria-expanded', 'false');
    await user.click(show);
    expect(screen.getByText('You named the method.')).toBeVisible();
    expect(screen.getByText('practice.exampleTitle')).toBeVisible();
    const hide = screen.getByRole('button', {
      name: 'mock.hideFeedbackButton',
    });
    expect(hide).toHaveAttribute('aria-expanded', 'true');
    await user.click(hide);
    expect(screen.queryByText('You named the method.')).not.toBeInTheDocument();
  });

  it('"Practise this question", answered or skipped, with text practice', async () => {
    const user = userEvent.setup();
    const practise = practising();
    renderAnswer(null, { practise });
    await user.click(
      screen.getByRole('button', { name: 'mock.practiseQuestionButton' }),
    );
    expect(practise.practise).toHaveBeenCalledWith('t1', 'said');
  });

  it('on its way, or taking longer than usual', () => {
    const { unmount } = renderAnswer({ status: 'writing' });
    expect(screen.getByText('mock.answerPreparing')).toBeVisible();
    unmount();
    renderAnswer({ status: 'writing' }, { feedback: controls({ slow: true }) });
    expect(
      screen.getByRole('button', { name: 'mock.checkAgainButton' }),
    ).toBeVisible();
  });

  it('couldn’t prepare it: "Try again" asks for this answer’s', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    renderAnswer({ status: 'failed' }, { feedback });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'mock.answerFeedbackFailed',
    );
    await user.click(screen.getByRole('button', { name: 'mock.retryButton' }));
    expect(feedback.retryAnswer).toHaveBeenCalledWith('t1');
  });

  it('today’s limit, then "Get feedback" once it has reset', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    const { unmount } = renderAnswer({ status: 'quota', reset: false });
    expect(screen.getByText('mock.answerFeedbackLimit')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();
    renderAnswer({ status: 'quota', reset: true }, { feedback });
    await user.click(
      screen.getByRole('button', { name: 'mock.getFeedbackButton' }),
    );
    expect(feedback.retryAnswer).toHaveBeenCalledWith('t1');
  });

  it('none yet: "Get feedback"', async () => {
    const user = userEvent.setup();
    const feedback = controls();
    renderAnswer({ status: 'missing' }, { feedback });
    expect(screen.getByText('mock.answerFeedbackMissing')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.getFeedbackButton' }),
    );
    expect(feedback.retryAnswer).toHaveBeenCalledWith('t1');
  });
});

describe('reading the session again while feedback is written (§18.7)', () => {
  const Harness: React.FC<{
    session: MockSession;
    reload: () => void;
  }> = ({ session, reload }) => {
    const feedback = useMockFeedback({ session, shown: true, reload });
    return (
      <>
        <p>{feedback.slow ? 'slow' : 'reading'}</p>
        <p>
          {(feedback.reading.retried.has('t1') ? 'asked t1 ' : '') +
            (feedback.asks.t1?.status ?? 'none')}
        </p>
        <button type="button" onClick={() => feedback.retryAnswer('t1')}>
          retry
        </button>
        <button
          type="button"
          onClick={() => feedback.retryOverall(['t1', 't2'])}>
          retry all
        </button>
      </>
    );
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  it('every 5 seconds while it is written, for 3 minutes, then "taking longer than usual"', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    renderProfilePage(<Harness session={SESSION} reload={reload} />);

    act(() => {
      vi.advanceTimersByTime(MOCK_FEEDBACK_POLL_MS);
    });
    expect(reload).toHaveBeenCalledOnce();
    act(() => {
      vi.advanceTimersByTime(MOCK_FEEDBACK_POLL_MS * MOCK_FEEDBACK_MAX_READS);
    });
    expect(reload).toHaveBeenCalledTimes(MOCK_FEEDBACK_MAX_READS);
    expect(screen.getByText('slow')).toBeInTheDocument();
  });

  it('not once it has all settled', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    const settled = {
      ...SESSION,
      answerFeedback: {
        t1: { status: 'failed' as const },
        t2: { status: 'ready' as const, feedback: FEEDBACK },
      },
      overall: {
        status: 'ready' as const,
        wentWell: ['x'],
        workOn: ['y'],
        practiseAgain: [],
      },
    };
    renderProfilePage(<Harness session={settled} reload={reload} />);
    act(() => {
      vi.advanceTimersByTime(MOCK_FEEDBACK_POLL_MS * 3);
    });
    expect(reload).not.toHaveBeenCalled();
  });

  it('asks for an answer’s again, and reads it as on its way', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    const reload = vi.fn();
    renderProfilePage(<Harness session={SESSION} reload={reload} />, {
      gateway,
    });
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(gateway.retryMockFeedback).toHaveBeenCalledWith({
      sessionId: 's1',
      turnId: 't1',
    });
    expect(await screen.findByText('asked t1 none')).toBeInTheDocument();
    expect(reload).toHaveBeenCalled();
  });

  it('one call for every answer with none: the backend starts them all', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    renderProfilePage(<Harness session={SESSION} reload={vi.fn()} />, {
      gateway,
    });
    await user.click(screen.getByRole('button', { name: 'retry all' }));
    expect(gateway.retryMockFeedback).toHaveBeenCalledExactlyOnceWith({
      sessionId: 's1',
      turnId: 't1',
    });
  });

  it('being written already is not a failure; the day’s limit is', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.retryMockFeedback.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.MockFeedbackNotFailed),
    );
    renderProfilePage(<Harness session={SESSION} reload={vi.fn()} />, {
      gateway,
    });
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByText('asked t1 none')).toBeInTheDocument();

    gateway.retryMockFeedback.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    await user.click(screen.getByRole('button', { name: 'retry' }));
    expect(await screen.findByText('asked t1 failed')).toBeInTheDocument();
  });
});
