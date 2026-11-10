// The hints column of a mock interview (Web-X6-Hints, slice H2): what it shows for the question on
// screen with each of the setup's choices, and the card in each state. The page reading the
// session again while hints are on their way is the browser journeys'.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type MockHintsShownNow,
  MockHintsCard,
  mockHintsShownOf,
} from './MockHints';

import { type MockView } from '@/core/mock/MockInterviewController';
import { type MockSession } from '@/core/profile/mockInterviews';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const POINTS = [
  { text: 'Say what you changed afterwards.' },
  { text: 'Name your own part.' },
  { text: 'Start with what was at stake.' },
];

const SESSION: Pick<MockSession, 'turns' | 'hints'> = {
  turns: [
    {
      id: 't1',
      kind: 'planned',
      planId: 'p1',
      question: 'Tell me about yourself.',
      status: 'answered',
      repeats: 0,
      askedAt: 1,
      answeredAt: 2,
    },
    {
      id: 't2',
      kind: 'follow-up',
      planId: 'p1',
      question: 'What was your part?',
      status: 'open',
      repeats: 0,
      askedAt: 3,
      answeredAt: null,
    },
  ],
  hints: {
    p1: { status: 'ready', keyPoints: POINTS },
    t2: { status: 'writing', keyPoints: [] },
  },
};

const on = (
  turnId: string,
  answered?: string,
): Pick<MockView, 'question' | 'answered'> => ({
  question: {
    lineId: 'l9',
    turnId,
    text: '…',
    kind: turnId === 't1' ? 'question' : 'follow-up',
  },
  ...(answered ? { answered } : {}),
});

const shownOf = (
  view: Pick<MockView, 'question' | 'answered'>,
  shown: 'with-question' | 'on-request' | 'after-answer',
  {
    revealed = [],
    gaveUp = [],
    session = SESSION,
  }: {
    revealed?: string[];
    gaveUp?: string[];
    session?: Pick<MockSession, 'turns' | 'hints'>;
  } = {},
) =>
  mockHintsShownOf({
    session,
    view,
    shown,
    revealed: new Set(revealed),
    gaveUp: new Set(gaveUp),
  });

describe('what the hints column shows (Web-X6-Hints)', () => {
  it('shows nothing before the first question', () => {
    expect(shownOf({}, 'with-question')).toBeNull();
  });

  it('with each question: the points, or on their way, or none', () => {
    expect(shownOf(on('t1'), 'with-question')).toEqual({
      turnId: 't1',
      state: { kind: 'points', keyPoints: POINTS, justAnswered: false },
    });
    expect(shownOf(on('t2'), 'with-question')).toEqual({
      turnId: 't2',
      state: { kind: 'coming', of: 'follow-up' },
    });
    // A planned question asked before its hints are ready, or one the read doesn't have yet
    expect(
      shownOf(on('t1'), 'with-question', {
        session: { ...SESSION, hints: {} },
      })?.state,
    ).toEqual({ kind: 'coming', of: 'question' });
    expect(
      shownOf(on('t3'), 'with-question', { session: SESSION })?.state,
    ).toEqual({ kind: 'coming', of: 'follow-up' });
    // Failed, or never in after a minute of reads
    expect(
      shownOf(on('t1'), 'with-question', {
        session: {
          ...SESSION,
          hints: { p1: { status: 'failed', reason: 'model', keyPoints: [] } },
        },
      })?.state,
    ).toEqual({ kind: 'none' });
    expect(
      shownOf(on('t2'), 'with-question', { gaveUp: ['t2'] })?.state,
    ).toEqual({ kind: 'none' });
  });

  it('when I ask: hidden until "Show hints" for this question, hidden again for the next', () => {
    expect(shownOf(on('t1'), 'on-request')?.state).toEqual({ kind: 'hidden' });
    expect(
      shownOf(on('t1'), 'on-request', { revealed: ['t1'] })?.state,
    ).toMatchObject({ kind: 'points' });
    expect(
      shownOf(on('t2'), 'on-request', { revealed: ['t1'] })?.state,
    ).toEqual({ kind: 'hidden' });
  });

  it('after I answer: hidden while answering, then the answered question’s until the next answer starts', () => {
    expect(shownOf(on('t1'), 'after-answer')?.state).toEqual({
      kind: 'after',
    });
    // "Show them now"
    expect(
      shownOf(on('t1'), 'after-answer', { revealed: ['t1'] })?.state,
    ).toEqual({ kind: 'points', keyPoints: POINTS, justAnswered: false });
    // Answered: while the interviewer thinks, and while the follow-up plays
    expect(shownOf(on('t1', 't1'), 'after-answer')).toEqual({
      turnId: 't1',
      state: { kind: 'points', keyPoints: POINTS, justAnswered: true },
    });
    expect(shownOf(on('t2', 't1'), 'after-answer')).toEqual({
      turnId: 't1',
      state: { kind: 'points', keyPoints: POINTS, justAnswered: true },
    });
    // Recording the follow-up's answer: its own hints, hidden
    expect(shownOf(on('t2'), 'after-answer')?.state).toEqual({
      kind: 'after',
    });
  });
});

describe('the hints card', () => {
  const renderCard = (state: MockHintsShownNow['state'], onReveal = vi.fn()) =>
    renderProfilePage(
      <MockHintsCard state={state} resources={[]} onReveal={onReveal} />,
    );

  it('hidden: "Show hints" asks for them', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    renderCard({ kind: 'hidden' }, onReveal);
    const card = screen.getByRole('region', { name: 'mock.hintsTitle' });
    expect(card).toHaveTextContent('mock.hintsHidden');
    await user.click(
      screen.getByRole('button', { name: 'mock.showHintsButton' }),
    );
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('after I answer: "Show them now"', async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    renderCard({ kind: 'after' }, onReveal);
    expect(screen.getByText('mock.hintsAfter')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.showHintsNowButton' }),
    );
    expect(onReveal).toHaveBeenCalledOnce();
  });

  it('on their way, for a follow-up or a question', () => {
    const { unmount } = renderCard({ kind: 'coming', of: 'follow-up' });
    expect(screen.getByText('mock.hintsComingFollowUp')).toBeVisible();
    unmount();
    renderCard({ kind: 'coming', of: 'question' });
    expect(screen.getByText('mock.hintsComingQuestion')).toBeVisible();
  });

  it('none this time', () => {
    renderCard({ kind: 'none' });
    expect(screen.getByText('mock.hintsNone')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('the points, under "For the question you just answered" once answered', () => {
    const { unmount } = renderCard({
      kind: 'points',
      keyPoints: POINTS,
      justAnswered: false,
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getAllByText('applications.adviceChip')).toHaveLength(3);
    expect(
      screen.queryByText('mock.hintsJustAnsweredChip'),
    ).not.toBeInTheDocument();
    unmount();
    renderCard({ kind: 'points', keyPoints: POINTS, justAnswered: true });
    expect(screen.getByText('mock.hintsJustAnsweredChip')).toBeVisible();
  });
});
