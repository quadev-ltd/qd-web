// Feedback on a mock interview (D101, doc 24 §17 and §18; Web-X6-End, Web-R2-Mock,
// Web-R2-Mock-Feedback-States): each answer's, written by the backend in the background as it is
// given, and "How it went", written once the interview has ended and every answer's has settled.
// Never shown during the interview. While some of it is being written the session is read again
// every 5 seconds, for 3 minutes at most, then "This is taking longer than usual" with "Check
// again". Failed, or stopped by the day's limit once that has reset, it can be asked for again; an
// answer with none coming (a session from before feedback, or a write that stopped) has "Get
// feedback". "Practise it" and "Practise this question" start text practice with the question as
// first asked, its hints as the key points, with the `textPractice` flag.
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useFlag } from '@/core/flags/FlagsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  isMockFeedbackWriting,
  type MockAnswerFeedbackState,
  type MockFeedbackReading,
  MOCK_OVERALL_KEY,
  type MockOverallState,
  type MockSession,
  type RetryMockFeedbackRequest,
} from '@/core/profile/mockInterviews';
import { type StartPracticeTurnRequest } from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { usePractice, usePracticeLeft } from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';
import { useNow } from '@/screens/Applications/interviews/interviewText';
import FeedbackSections, {
  FeedbackList,
  FeedbackSection,
} from '@/screens/Practice/FeedbackSections';
import {
  type PracticeFailure,
  PracticeFailureBanner,
  practiceFailureOf,
} from '@/screens/Practice/practiceFailure';

/** How often the session is read again while feedback is being written (§18.7). */
export const MOCK_FEEDBACK_POLL_MS = 5_000;
/** Three minutes of reads, then "This is taking longer than usual". */
export const MOCK_FEEDBACK_MAX_READS = 36;

/** Asking for feedback again: under way, or refused (`limit`: the day's limit still holds). */
type Ask = { status: 'asking' } | { status: 'failed'; limit: boolean };

export interface MockFeedbackControls {
  reading: MockFeedbackReading;
  /** Read for 3 minutes and still being written. */
  slow: boolean;
  checkAgain: () => void;
  /** One answer's feedback again; the overall view follows it. */
  retryAnswer: (turnId: string) => void;
  /**
   * The answers that have none, or the overall view alone. One call starts every answer with
   * none (the trigger claims them all), and the overall view follows them.
   */
  retryOverall: (turnIds: string[]) => void;
  /** By turn id, and MOCK_OVERALL_KEY. */
  asks: Readonly<Record<string, Ask>>;
}

/**
 * The feedback of a session as last read, reading it again while some of it is being written.
 * `shown`: the page shows it (the interview is over); `reload` reads the session again.
 */
export const useMockFeedback = ({
  session,
  shown,
  reload,
}: {
  session: MockSession | null;
  shown: boolean;
  reload: () => void;
}): MockFeedbackControls => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const now = useNow();
  const [retried, setRetried] = useState<ReadonlySet<string>>(new Set());
  const [round, setRound] = useState(0);
  const [slow, setSlow] = useState(false);
  const [asks, setAsks] = useState<Record<string, Ask>>({});
  const reading = { now, retried };
  const writing =
    shown && session !== null && isMockFeedbackWriting(session, reading);

  useEffect(() => {
    if (!writing) {
      return undefined;
    }
    let reads = 0;
    const timer = setInterval(() => {
      reads += 1;
      if (reads > MOCK_FEEDBACK_MAX_READS) {
        clearInterval(timer);
        setSlow(true);
        return;
      }
      reload();
    }, MOCK_FEEDBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [writing, round, reload]);

  const readAgain = () => {
    setSlow(false);
    setRound(count => count + 1);
    reload();
  };

  const ask = async (
    key: string,
    requests: RetryMockFeedbackRequest[],
    asked: string[],
  ) => {
    setAsks(known => ({ ...known, [key]: { status: 'asking' } }));
    try {
      await Promise.all(
        requests.map(request =>
          gateway.retryMockFeedback(request).catch((error: unknown) => {
            // Being written already, or there: the read shows which.
            if (
              getProfileErrorCode(error) !==
              ProfileErrorCode.MockFeedbackNotFailed
            ) {
              throw error;
            }
          }),
        ),
      );
      setRetried(known => new Set([...known, ...asked]));
      setAsks(({ [key]: _done, ...others }) => others);
    } catch (error) {
      logProfileError('retryMockFeedback', error, uid);
      setAsks(known => ({
        ...known,
        [key]: {
          status: 'failed',
          limit: getProfileErrorCode(error) === ProfileErrorCode.DailyLimit,
        },
      }));
    }
    readAgain();
  };

  const sessionId = session?.id ?? '';
  return {
    reading,
    slow,
    checkAgain: readAgain,
    retryAnswer: turnId =>
      void ask(turnId, [{ sessionId, turnId }], [turnId, MOCK_OVERALL_KEY]),
    retryOverall: turnIds =>
      void ask(
        MOCK_OVERALL_KEY,
        [
          turnIds.length > 0
            ? { sessionId, turnId: turnIds[0] }
            : { sessionId, overall: true },
        ],
        [...turnIds, MOCK_OVERALL_KEY],
      ),
    asks,
  };
};

export interface MockPractise {
  isStarting: (turnId: string) => boolean;
  disabled: boolean;
  /** `where`: the overall view's list or what was said, so a refusal shows where it was asked. */
  practise: (turnId: string, where: 'overall' | 'said') => void;
  failureOf: (
    turnId: string,
    where: 'overall' | 'said',
  ) => PracticeFailure | null;
  max?: number;
}

/**
 * Text practice of a session's questions; undefined without `textPractice`, or once the
 * application is removed. `pathOf` is where the practice opens.
 */
export const useMockPractise = (
  session: MockSession | null,
  pathOf: (practiceTurnId: string) => string,
): MockPractise | undefined => {
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const textPractice = useFlag('textPractice');
  const practice = usePractice();
  const { left, counted } = usePracticeLeft();
  const [failure, setFailure] = useState<{
    turnId: string;
    where: 'overall' | 'said';
    failure: PracticeFailure;
  } | null>(null);
  // A practice started here opens when it is stored, unless the candidate has left the page.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  if (!textPractice || !session || session.applicationRemoved) {
    return undefined;
  }
  const request = (turnId: string): StartPracticeTurnRequest => ({
    applicationId: session.applicationId,
    question: { source: 'mock', sessionId: session.id, turnId },
  });
  const practise = async (turnId: string, where: 'overall' | 'said') => {
    setFailure(null);
    try {
      const practiceTurnId = await practice.start(request(turnId));
      if (mounted.current) {
        navigate(pathOf(practiceTurnId));
      }
    } catch (error) {
      logProfileError('startPracticeTurn', error, uid);
      if (mounted.current) {
        setFailure({ turnId, where, failure: practiceFailureOf(error) });
      }
      counted();
    }
  };
  return {
    isStarting: turnId => practice.isStarting(request(turnId)),
    disabled:
      practice.anyStarting ||
      left?.left === 0 ||
      failure?.failure === 'limit' ||
      failure?.failure === 'turnLimit',
    practise: (turnId, where) => void practise(turnId, where),
    failureOf: (turnId, where) =>
      failure?.turnId === turnId && failure.where === where
        ? failure.failure
        : null,
    max: left?.max,
  };
};

const PractiseButton: React.FC<{
  practise: MockPractise;
  turnId: string;
  where: 'overall' | 'said';
}> = ({ practise, turnId, where }) => {
  const { t } = useTranslation();
  const starting = practise.isStarting(turnId);
  return (
    <Button
      variant={where === 'overall' ? 'secondary' : 'quiet'}
      size="small"
      onClick={() => practise.practise(turnId, where)}
      disabled={starting || practise.disabled}
      aria-busy={starting}
      className="gap-2">
      {starting ? (
        <Spinner size="small" decorative />
      ) : (
        <Icon name="refresh" size={18} />
      )}
      {starting
        ? t('mock.practiseStartingButton')
        : where === 'overall'
          ? t('mock.practiseItButton')
          : t('mock.practiseQuestionButton')}
    </Button>
  );
};

/** "Try again" or "Get feedback", busy while it is asked. */
const AskButton: React.FC<{
  ask?: Ask;
  label: string;
  onClick: () => void;
}> = ({ ask, label, onClick }) => {
  const asking = ask?.status === 'asking';
  return (
    <Button
      variant="quiet"
      size="small"
      onClick={onClick}
      disabled={asking}
      aria-busy={asking}
      className="gap-2">
      {asking ? (
        <Spinner size="small" decorative />
      ) : (
        <Icon name="refresh" size={18} />
      )}
      {label}
    </Button>
  );
};

/** Why asking again didn't go through. */
const AskFailed: React.FC<{ ask?: Ask }> = ({ ask }) => {
  const { t } = useTranslation();
  if (ask?.status !== 'failed') {
    return null;
  }
  return (
    <Banner tone={ask.limit ? 'warning' : 'danger'} role="alert">
      {ask.limit
        ? t('mock.retryFeedbackLimit', { time: dailyLimitResetTime() })
        : t('mock.retryFeedbackFailed')}
    </Banner>
  );
};

const Slow: React.FC<{ onCheckAgain: () => void }> = ({ onCheckAgain }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-[15px] leading-normal text-muted">
        {t('mock.feedbackSlowMessage')}
      </p>
      <Button variant="quiet" size="small" onClick={onCheckAgain}>
        {t('mock.checkAgainButton')}
      </Button>
    </div>
  );
};

/**
 * Under a question in what was said: "Show feedback" and "Practise this question", or where its
 * feedback stands. `state` is null for one skipped or left unanswered, which has only "Practise
 * this question".
 */
export const MockAnswerFeedback: React.FC<{
  turnId: string;
  state: MockAnswerFeedbackState | null;
  feedback: MockFeedbackControls;
  practise?: MockPractise;
}> = ({ turnId, state, feedback, practise }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const boxId = useId();
  const ask = feedback.asks[turnId];
  const retry = () => feedback.retryAnswer(turnId);
  const failure = practise?.failureOf(turnId, 'said');

  return (
    <div className="flex flex-col gap-1.5">
      {state?.status === 'writing' &&
        (feedback.slow ? (
          <Slow onCheckAgain={feedback.checkAgain} />
        ) : (
          <p className="flex items-center gap-2.5 py-1.5 text-[15px] leading-normal text-muted">
            <span className="flex text-primary">
              <Spinner size="small" decorative />
            </span>
            {t('mock.answerPreparing')}
          </p>
        ))}
      {state?.status === 'failed' && (
        <Banner
          tone="danger"
          role="alert"
          action={
            <AskButton
              ask={ask}
              label={t('mock.retryButton')}
              onClick={retry}
            />
          }>
          {t('mock.answerFeedbackFailed')}
        </Banner>
      )}
      {state?.status === 'quota' &&
        (state.reset ? (
          <Banner
            tone="info"
            action={
              <AskButton
                ask={ask}
                label={t('mock.getFeedbackButton')}
                onClick={retry}
              />
            }>
            {t('mock.answerFeedbackLimitReset')}
          </Banner>
        ) : (
          <Banner tone="warning">
            {t('mock.answerFeedbackLimit', { time: dailyLimitResetTime() })}
          </Banner>
        ))}
      {state?.status === 'missing' && (
        <Banner
          tone="info"
          action={
            <AskButton
              ask={ask}
              label={t('mock.getFeedbackButton')}
              onClick={retry}
            />
          }>
          {t('mock.answerFeedbackMissing')}
        </Banner>
      )}
      <AskFailed ask={ask} />
      {(state?.status === 'ready' || practise) && (
        <div className="-ml-1.5 flex flex-wrap items-center gap-1">
          {state?.status === 'ready' && (
            <Button
              variant="quiet"
              size="small"
              onClick={() => setOpen(shown => !shown)}
              aria-expanded={open}
              aria-controls={boxId}
              className="gap-2">
              <Icon name={open ? 'up' : 'down'} size={18} />
              {open
                ? t('mock.hideFeedbackButton')
                : t('mock.showFeedbackButton')}
            </Button>
          )}
          {practise && (
            <PractiseButton practise={practise} turnId={turnId} where="said" />
          )}
        </div>
      )}
      {failure && (
        <PracticeFailureBanner
          failure={failure}
          max={practise?.max}
          retryDisabled={practise?.disabled}
          onRetry={() => practise?.practise(turnId, 'said')}
        />
      )}
      {state?.status === 'ready' && open && (
        <div
          id={boxId}
          className="flex flex-col gap-3.5 rounded-[14px] border border-border-faint px-4 pt-1 pb-4 [&>section:first-child]:border-t-0">
          <FeedbackSections feedback={state.feedback} />
        </div>
      )}
    </div>
  );
};

/** "How it went": on the end page above the testers' card, and at the top of Sessions' page. */
export const MockOverallCard: React.FC<{
  session: MockSession;
  state: MockOverallState;
  page: 'end' | 'sessions';
  feedback: MockFeedbackControls;
  practise?: MockPractise;
}> = ({ session, state, page, feedback, practise }) => {
  const { t } = useTranslation();
  const ask = feedback.asks[MOCK_OVERALL_KEY];
  const answered = session.turns.filter(
    ({ status }) => status === 'answered',
  ).length;

  let body: React.ReactNode;
  switch (state.status) {
    case 'writing':
      body = (
        <>
          <p className="flex items-center gap-2.5 text-[16px] leading-normal font-bold">
            <span className="flex text-primary">
              <Spinner size="small" decorative />
            </span>
            {t('mock.overallPreparing', { ready: state.ready, of: state.of })}
          </p>
          {feedback.slow ? (
            <Slow onCheckAgain={feedback.checkAgain} />
          ) : (
            <p className="text-sm leading-normal text-muted">
              {page === 'end'
                ? t('mock.overallPreparingEnd')
                : t('mock.overallPreparingSessions')}
            </p>
          )}
        </>
      );
      break;
    case 'failed':
      body = (
        <Banner
          tone="danger"
          role="alert"
          action={
            <AskButton
              ask={ask}
              label={t('mock.retryButton')}
              onClick={() => feedback.retryOverall([])}
            />
          }>
          {t('mock.overallFailed')}
        </Banner>
      );
      break;
    case 'quota':
      body = state.reset ? (
        <Banner
          tone="info"
          action={
            <AskButton
              ask={ask}
              label={t('mock.getFeedbackButton')}
              onClick={() => feedback.retryOverall([])}
            />
          }>
          {t('mock.overallLimitReset')}
        </Banner>
      ) : (
        <Banner tone="warning">
          {t('mock.overallLimit', { time: dailyLimitResetTime() })}
        </Banner>
      );
      break;
    case 'none':
      body = (
        <p className="text-[15px] leading-normal text-muted">
          {page === 'end'
            ? t('mock.overallNoneEnd')
            : t('mock.overallNoneSessions')}
        </p>
      );
      break;
    case 'missing': {
      // No feedback at all yet (Web-R2-Mock-Feedback-States, third row), or only the overall view.
      const asking = ask?.status === 'asking';
      body =
        state.turnIds.length > 0 ? (
          <>
            <p className="text-[15px] leading-normal text-muted">
              {t('mock.overallMissingAnswers')}
            </p>
            <Button
              size="small"
              onClick={() => feedback.retryOverall(state.turnIds)}
              disabled={asking}
              aria-busy={asking}
              className="gap-2 self-start">
              {asking && <Spinner size="small" decorative />}
              {t('mock.getAnswersFeedbackButton')}
            </Button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[15px] leading-normal text-muted">
              {t('mock.overallMissing')}
            </p>
            <AskButton
              ask={ask}
              label={t('mock.getFeedbackButton')}
              onClick={() => feedback.retryOverall([])}
            />
          </div>
        );
      break;
    }
    case 'ready': {
      const again = state.overall.practiseAgain.flatMap(
        ({ turnId, reason }) => {
          const turn = session.turns.find(({ id }) => id === turnId);
          return turn ? [{ turn, reason }] : [];
        },
      );
      body = (
        <>
          {state.overall.wentWell.length > 0 && (
            <FeedbackSection title={t('mock.wentWellTitle')}>
              <FeedbackList items={state.overall.wentWell} tone="covered" />
            </FeedbackSection>
          )}
          {state.overall.workOn.length > 0 && (
            <FeedbackSection title={t('mock.workOnTitle')}>
              <FeedbackList items={state.overall.workOn} tone="missing" />
            </FeedbackSection>
          )}
          {again.length > 0 && (
            <FeedbackSection title={t('mock.practiseAgainTitle')}>
              <ul className="flex flex-col">
                {again.map(({ turn, reason }) => {
                  const failure = practise?.failureOf(turn.id, 'overall');
                  return (
                    <li
                      key={turn.id}
                      className="flex flex-wrap items-center gap-3 border-t border-border-faint py-2.5 first:border-t-0">
                      <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-0.5">
                        <p className="text-[15px] leading-normal font-bold wrap-anywhere">
                          {turn.question}
                        </p>
                        {reason && (
                          <p className="text-sm leading-normal text-muted wrap-anywhere">
                            {reason}
                          </p>
                        )}
                      </div>
                      {practise && (
                        <PractiseButton
                          practise={practise}
                          turnId={turn.id}
                          where="overall"
                        />
                      )}
                      {failure && (
                        <div className="basis-full">
                          <PracticeFailureBanner
                            failure={failure}
                            max={practise?.max}
                            retryDisabled={practise?.disabled}
                            onRetry={() =>
                              practise?.practise(turn.id, 'overall')
                            }
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </FeedbackSection>
          )}
          <p className="text-sm leading-normal text-muted">
            {t('mock.notToneNote')}
          </p>
        </>
      );
      break;
    }
  }

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-overall"
      className="gap-3.5 p-5">
      <div className="flex flex-col gap-1">
        <h2
          id="mock-overall"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('mock.overallTitle')}
        </h2>
        {state.status === 'ready' && (
          <p className="text-sm leading-normal text-muted">
            {t('mock.overallFrom', { count: answered })}
          </p>
        )}
      </div>
      {body}
      <AskFailed ask={ask} />
    </Card>
  );
};
