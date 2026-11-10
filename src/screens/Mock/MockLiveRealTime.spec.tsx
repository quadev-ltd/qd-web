// A mock interview in real time as it runs (Web-X6-RT-Speaking, -RT-Listening, -RT-States): the
// interviewer's card, the answer's card and the connection's panels in each state, with what they
// ask the controller. The controller itself is its spec's; the whole interview is the browser
// journeys'.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  RealTimeAnswerCard,
  RealTimeConnectionPanel,
  RealTimeInterviewerCard,
  RealTimePausedPanel,
} from './MockLiveRealTime';

import {
  type LiveInterviewController,
  type LiveView,
} from '@/core/mock/LiveInterviewController';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const fakeController = () =>
  ({
    stopAndAnswer: vi.fn(),
    done: vi.fn(),
    sayDifferently: vi.fn(),
    skip: vi.fn(),
    hearAgain: vi.fn(),
    reconnect: vi.fn(() => Promise.resolve()),
    listeningMs: () => 42_000,
    level: () => 0.05,
  }) as unknown as LiveInterviewController & {
    [method: string]: ReturnType<typeof vi.fn>;
  };

const QUESTION = {
  lineId: 'l2',
  turnId: 't1',
  text: 'Tell me about an incident you led.',
  kind: 'question' as const,
};

const view = (change: Partial<LiveView>): LiveView => ({
  phase: 'speaking',
  rephrased: false,
  nothingHeard: false,
  answerTimeWarn: false,
  question: QUESTION,
  speaking: QUESTION,
  ...change,
});

describe('the interviewer, in real time (Web-X6-RT-Speaking, -RT-Listening)', () => {
  it('speaking: the line, "Speaking…", and "Stop and answer now"', async () => {
    const user = userEvent.setup();
    const controller = fakeController();
    renderProfilePage(
      <RealTimeInterviewerCard view={view({})} controller={controller} />,
    );
    expect(screen.getByText(QUESTION.text)).toBeVisible();
    expect(screen.getByText('mock.statusSpeaking')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.stopAndAnswerButton' }),
    );
    expect(controller.stopAndAnswer).toHaveBeenCalledOnce();
    // No Repeat on the real-time ways (doc 24 §16, choice 3)
    expect(
      screen.queryByRole('button', { name: 'mock.repeatButton' }),
    ).not.toBeInTheDocument();
  });

  it('your turn: "Say it differently" (once) and Skip', async () => {
    const user = userEvent.setup();
    const controller = fakeController();
    const { unmount } = renderProfilePage(
      <RealTimeInterviewerCard
        view={view({ phase: 'listening' })}
        controller={controller}
      />,
    );
    expect(screen.getByText('mock.statusYourTurn')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.sayDifferentlyButton' }),
    );
    await user.click(screen.getByRole('button', { name: 'mock.skipButton' }));
    expect(controller.sayDifferently).toHaveBeenCalledOnce();
    expect(controller.skip).toHaveBeenCalledOnce();
    unmount();

    renderProfilePage(
      <RealTimeInterviewerCard
        view={view({ phase: 'listening', rephrased: true })}
        controller={controller}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'mock.sayDifferentlyButton' }),
    ).toBeDisabled();
  });

  it('the closing can’t be interrupted; thinking says so', () => {
    const { unmount } = renderProfilePage(
      <RealTimeInterviewerCard
        view={view({
          speaking: { lineId: 'l9', text: 'That’s all.', kind: 'closing' },
        })}
        controller={fakeController()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: 'mock.stopAndAnswerButton' }),
    ).not.toBeInTheDocument();
    unmount();
    renderProfilePage(
      <RealTimeInterviewerCard
        view={view({ phase: 'thinking' })}
        controller={fakeController()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('mock.thinkingText');
  });
});

describe('the answer, in real time (Web-X6-RT-Listening, -RT-States)', () => {
  it('while the interviewer speaks: the microphone is on, speaking interrupts', () => {
    renderProfilePage(
      <RealTimeAnswerCard view={view({})} controller={fakeController()} />,
    );
    expect(screen.getByText('mock.liveMicOnText')).toBeVisible();
  });

  it('listening: the time, the last words heard, and "I’m done"', async () => {
    const user = userEvent.setup();
    const controller = fakeController();
    renderProfilePage(
      <RealTimeAnswerCard
        view={view({
          phase: 'listening',
          heard: '…and we traced it to a migration that had locked a table',
        })}
        controller={controller}
      />,
    );
    expect(screen.getByText('mock.listening')).toBeVisible();
    expect(screen.getByText('mock.heardLabel')).toBeVisible();
    expect(
      screen.getByText(
        '…and we traced it to a migration that had locked a table',
      ),
    ).toBeVisible();
    expect(screen.getByText('mock.liveDoneNote')).toBeVisible();
    // The words heard aren't read out as they change.
    expect(
      screen
        .getByText('…and we traced it to a migration that had locked a table')
        .closest('[aria-live]'),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'mock.doneButton' }));
    expect(controller.done).toHaveBeenCalledOnce();
  });

  it('nothing heard yet after "I’m done", and 30 seconds left', () => {
    renderProfilePage(
      <RealTimeAnswerCard
        view={view({
          phase: 'listening',
          nothingHeard: true,
          answerTimeWarn: true,
        })}
        controller={fakeController()}
      />,
    );
    const alerts = screen.getAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('mock.liveNothingHeardMessage');
    expect(alerts[1]).toHaveTextContent('mock.liveWarnMessage');
  });

  it('after the answer: how long it was', () => {
    renderProfilePage(
      <RealTimeAnswerCard
        view={view({ phase: 'thinking', answerEndedMs: 108_000 })}
        controller={fakeController()}
      />,
    );
    expect(screen.getByText('mock.liveAnswerEnded')).toBeVisible();
  });
});

describe('the connection, in real time (Web-X6-RT-States)', () => {
  const renderPanel = (phase: LiveView['phase']) => {
    const controller = fakeController();
    const onEnd = vi.fn();
    renderProfilePage(
      <RealTimeConnectionPanel
        view={view({ phase })}
        controller={controller}
        onEnd={onEnd}
      />,
    );
    return { controller, onEnd };
  };

  it('reconnecting: where the interview carries on', () => {
    renderPanel('reconnecting');
    expect(screen.getByText('mock.reconnectingTitle')).toBeVisible();
    expect(screen.getByText('mock.reconnectingText')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('couldn’t reconnect: "Try again", or "End the interview"', async () => {
    const user = userEvent.setup();
    const { controller, onEnd } = renderPanel('disconnected');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'mock.disconnectedText',
    );
    await user.click(
      screen.getByRole('button', { name: 'mock.tryAgainButton' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'mock.endConfirmButton' }),
    );
    expect(controller.reconnect).toHaveBeenCalledOnce();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it('open in another tab: "Continue here" takes it back', async () => {
    const user = userEvent.setup();
    const { controller } = renderPanel('replaced');
    expect(screen.getByRole('alert')).toHaveTextContent('mock.replacedText');
    await user.click(
      screen.getByRole('button', { name: 'mock.continueHereButton' }),
    );
    expect(controller.reconnect).toHaveBeenCalledOnce();
  });

  it('paused: the question again once back', async () => {
    const user = userEvent.setup();
    const controller = fakeController();
    renderProfilePage(
      <RealTimePausedPanel controller={controller} byYou={false} />,
    );
    expect(screen.getByText('mock.pausedTabText')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'mock.hearAgainButton' }),
    );
    expect(controller.hearAgain).toHaveBeenCalledOnce();
  });
});
