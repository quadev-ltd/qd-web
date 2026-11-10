// A question practised (X7, D94, research doc 21 §3): the way there (D96), the question with its
// kind and where it came from, and its 3 to 5 key points, each with its profile item and the
// resource it came from, or "Advice". Before the first try, "How you practise": the key points
// shown, or hidden until the feedback ("Try first"). The typed answer, its feedback and the tries
// (slice 3, research doc 13 §30) are in PracticeAnswer. Then "Remove this practice".
//
// The same page opens under an interview (its likely questions, or its own question), under an
// application (its brief's questions) and from Sessions, so the way back leads where the candidate
// came from. Only Sessions opens a practice whose application or interview was removed.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import Icon from '@/components/Icon';
import Breadcrumb, {
  type BreadcrumbStep,
} from '@/components/layout/Breadcrumb';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import SegmentedControl from '@/components/ui/SegmentedControl';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { type ProfileResource } from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import {
  applicationInterviewPath,
  applicationInterviewPracticePath,
  applicationInterviewsPath,
  applicationPath,
  applicationPracticePath,
  APPLICATIONS_PATH,
  sessionPracticePath,
  SESSIONS_PATH,
} from '@/core/profile/paths';
import {
  type PracticeTurn,
  practiceRestartRequest,
} from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import {
  usePractice,
  usePracticeAnswer,
  usePracticeLeft,
} from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectInterviews } from '@/core/state/selectors/interviews';
import { selectPractice } from '@/core/state/selectors/practice';
import { QUESTION_KIND_KEYS } from '@/screens/Applications/BriefCards';
import { interviewTitle } from '@/screens/Applications/interviews/interviewText';
import KeyPointList from '@/screens/Practice/KeyPointList';
import {
  AnswerCard,
  answerFailureOf,
  FeedbackCard,
  TriesPicker,
  YourAnswerCard,
} from '@/screens/Practice/PracticeAnswer';
import {
  type PracticeFailure,
  practiceFailureOf,
} from '@/screens/Practice/practiceFailure';
import RemovePracticeDialog from '@/screens/Practice/RemovePracticeDialog';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const SOURCE_KEYS = {
  interview: 'practice.sourceInterview',
  brief: 'practice.sourceBrief',
  typed: 'practice.sourceTyped',
} as const satisfies Record<PracticeTurn['question']['source'], string>;

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; turn: PracticeTurn | null };

/**
 * The turn, read when the page opens, after "Try again", and after each change to the practice (an
 * answer's feedback stored). Read again, the turn already shown stays until the new read is in.
 */
const usePracticeTurn = (turnId: string) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { changes } = useAppSelector(selectPractice);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{
    turnId: string;
    key: string;
    state: Loaded;
  } | null>(null);
  const key = `${turnId}/${attempt}/${changes}`;

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.getPracticeTurn(uid, turnId).then(
      turn =>
        live && setLoaded({ turnId, key, state: { status: 'loaded', turn } }),
      error => {
        logProfileError('getPracticeTurn', error, uid);
        if (live) {
          setLoaded({ turnId, key, state: { status: 'error' } });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [gateway, key, turnId, uid]);

  let state: Loaded = { status: 'loading' };
  if (loaded?.key === key) {
    state = loaded.state;
  } else if (loaded?.turnId === turnId && loaded.state.status === 'loaded') {
    state = loaded.state;
  }
  return { state, reload: () => setAttempt(count => count + 1) };
};

const KeyPointsCard: React.FC<{
  turn: PracticeTurn;
  resources: ProfileResource[];
  /** "Try first": hidden until the feedback, with "Show them now". */
  onShow?: () => void;
}> = ({ turn, resources, onShow }) => {
  const { t } = useTranslation();
  if (onShow) {
    return (
      <Card
        as="section"
        elevation="raised"
        aria-labelledby="practice-key-points"
        className="items-start gap-3 p-5">
        <div className="flex items-baseline gap-2 self-stretch">
          <h2
            id="practice-key-points"
            className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
            {t('practice.keyPointsTitle')}
          </h2>
          <p className="text-sm leading-normal text-muted">
            {t('practice.keyPointsFrom')}
          </p>
        </div>
        <p className="text-[15px] leading-normal text-muted">
          {t('practice.keyPointsHidden')}
        </p>
        <Button variant="quiet" size="small" onClick={onShow}>
          {t('practice.showKeyPointsButton')}
        </Button>
      </Card>
    );
  }
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="practice-key-points"
      className="gap-4 p-5">
      <div className="flex items-baseline gap-2">
        <h2
          id="practice-key-points"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('practice.keyPointsTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('practice.keyPointsFrom')}
        </p>
      </div>
      <KeyPointList keyPoints={turn.keyPoints} resources={resources} />
    </Card>
  );
};

type PractiseMode = 'show' | 'tryFirst';

/** Where a new turn opens: under the same page as this one. */
const turnPath = (
  from: PracticeFrom,
  turn: Pick<PracticeTurn, 'applicationId' | 'interviewId'>,
  turnId: string,
) => {
  if (from === 'sessions') {
    return sessionPracticePath(turnId);
  }
  return from === 'interview' && turn.interviewId
    ? applicationInterviewPracticePath(
        turn.applicationId,
        turn.interviewId,
        turnId,
      )
    : applicationPracticePath(turn.applicationId, turnId);
};

/**
 * The answer and its feedback, beside the key points: the first answer, then each try's answer
 * and feedback, "Answer again" up to 5 tries, then "Start again with new key points".
 */
const PractiseTurn: React.FC<{
  turn: PracticeTurn;
  from: PracticeFrom;
  resources: ProfileResource[];
  /** The interview's list now, when the store has it: a list written again can't restart. */
  listId?: string;
  reload: () => void;
}> = ({ turn, from, resources, listId, reload }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { answering, draft, answer } = usePracticeAnswer(turn.id);
  const { start, isStarting, anyStarting } = usePractice();
  const { left, counted } = usePracticeLeft();
  const [mode, setMode] = useState<PractiseMode>('show');
  const [revealed, setRevealed] = useState(false);
  const [again, setAgain] = useState(false);
  // The try shown (0-based); the newest when none was picked.
  const [picked, setPicked] = useState<number | null>(null);
  // The tries the turn has once the feedback just given is read back.
  const [expected, setExpected] = useState<number | null>(null);
  const [failure, setFailure] = useState<PracticeFailure | null>(null);
  const [restartFailure, setRestartFailure] = useState<PracticeFailure | null>(
    null,
  );

  const tries = turn.attempts.length;
  const busy =
    answering !== undefined || (expected !== null && tries < expected);
  const answeringNow = tries === 0 || again || busy;
  const shown = Math.min(picked ?? tries - 1, tries - 1);
  const attempt = tries > 0 ? turn.attempts[shown] : undefined;

  const submit = async (text: string) => {
    setFailure(null);
    try {
      const { attempts } = await answer(text);
      setExpected(attempts);
      setAgain(false);
      setPicked(null);
    } catch (error) {
      logProfileError('answerPracticeTurn', error, uid);
      const reason = answerFailureOf(error);
      counted();
      if (reason === 'gone' || reason === 'tries') {
        // Removed, or answered in another tab: the page shows the turn as it is now.
        setAgain(false);
        reload();
        return;
      }
      setFailure(reason);
    }
  };

  const request = practiceRestartRequest(turn);
  const canRestart =
    request !== null &&
    !turn.applicationRemoved &&
    !turn.interviewRemoved &&
    (turn.question.source !== 'interview' ||
      listId === undefined ||
      listId === turn.question.listId) &&
    restartFailure !== 'changed';
  const restart = async () => {
    if (!request) {
      return;
    }
    setRestartFailure(null);
    try {
      const turnId = await start(request);
      navigate(turnPath(from, turn, turnId));
    } catch (error) {
      logProfileError('startPracticeTurn', error, uid);
      counted();
      setRestartFailure(practiceFailureOf(error));
    }
  };

  const keyPointsHidden = tries === 0 && mode === 'tryFirst' && !revealed;

  return (
    <>
      {tries === 0 && (
        <div className="max-w-[360px]">
          <SegmentedControl
            label={t('practice.modeLabel')}
            options={[
              { value: 'show', label: t('practice.modeShow') },
              { value: 'tryFirst', label: t('practice.modeTryFirst') },
            ]}
            value={mode}
            onChange={setMode}
            disabled={busy}
          />
        </div>
      )}
      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
          {answeringNow && (
            <AnswerCard
              initial={answering ?? draft ?? ''}
              busy={busy}
              left={left}
              failure={failure}
              onSubmit={submit}
              onCancel={
                tries > 0
                  ? () => {
                      setAgain(false);
                      setFailure(null);
                    }
                  : undefined
              }
            />
          )}
          {attempt && (
            <>
              {tries > 1 && (
                <TriesPicker count={tries} shown={shown} onShow={setPicked} />
              )}
              <YourAnswerCard attempt={attempt} number={shown + 1} />
              <FeedbackCard
                attempt={attempt}
                number={shown + 1}
                tries={tries}
                left={left}
                onAnswerAgain={
                  answeringNow
                    ? undefined
                    : () => {
                        setAgain(true);
                        setFailure(null);
                      }
                }
                restart={
                  canRestart && request
                    ? {
                        starting: isStarting(request),
                        disabled: anyStarting || left?.left === 0,
                        failure: restartFailure,
                        onRestart: restart,
                      }
                    : undefined
                }
              />
            </>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
          <KeyPointsCard
            turn={turn}
            resources={resources}
            onShow={keyPointsHidden ? () => setRevealed(true) : undefined}
          />
        </div>
      </div>
    </>
  );
};

/** Where the page was opened from, which decides the way back. */
export type PracticeFrom = 'interview' | 'brief' | 'sessions';

export const PracticeTurnScreen: React.FC<{ from: PracticeFrom }> = ({
  from,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicationId = '', interviewId = '', turnId = '' } = useParams();
  const { applications } = useApplications();
  // The interview as the store has it, when its page was opened first; otherwise as it was when
  // the practice started. Nothing more is read for the way back.
  const { byApplication } = useAppSelector(selectInterviews);
  const { resources } = useInterviewProfile();
  const { state, reload } = usePracticeTurn(turnId);
  const [removing, setRemoving] = useState(false);

  const turn = state.status === 'loaded' ? state.turn : null;
  // From Sessions the address has no application: the practice says which it was for.
  const application = applications.find(
    ({ id }) =>
      id === (from === 'sessions' ? turn?.applicationId : applicationId),
  );
  const interview =
    from === 'interview'
      ? byApplication[applicationId]?.interviews.find(
          ({ id }) => id === interviewId,
        )
      : undefined;
  const jobTitle =
    application?.title || turn?.application.title || t('applications.untitled');
  const interviewName = interview
    ? interviewTitle(t, interview)
    : turn?.interview
      ? interviewTitle(t, turn.interview)
      : t('interviews.untitled');

  // From Sessions, one step in: the single link back (D96).
  const steps: BreadcrumbStep[] =
    from === 'sessions'
      ? [{ label: t('sessions.title'), to: SESSIONS_PATH }]
      : [
          { label: t('applications.title'), to: APPLICATIONS_PATH },
          { label: jobTitle, to: applicationPath(applicationId) },
          ...(from === 'interview'
            ? [
                {
                  label: t('applications.interviewsTab'),
                  to: applicationInterviewsPath(applicationId),
                },
                {
                  label: interviewName,
                  to: applicationInterviewPath(applicationId, interviewId),
                },
              ]
            : [
                {
                  label: t('applications.briefTab'),
                  to: applicationPath(applicationId),
                },
              ]),
        ];
  const back = steps[steps.length - 1];
  // At phone width: "‹ Technical interview", or "‹ Senior Backend Engineer · Brief" (D96).
  const backLabel =
    from === 'brief' ? `${jobTitle} · ${back.label}` : back.label;

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  } else if (state.status === 'error') {
    body = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('practice.retryButton')}
          </Button>
        }>
        {t('practice.loadErrorMessage')}
      </Banner>
    );
  } else if (!turn) {
    body = (
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('practice.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('practice.notFoundDescription')}
        </p>
        <ButtonLink to={back.to} variant="secondary" size="small">
          {t('practice.notFoundLink', { page: back.label })}
        </ButtonLink>
      </Card>
    );
  } else {
    const job = [
      turn.application.title ?? application?.title,
      turn.application.company ?? application?.company,
    ]
      .filter(Boolean)
      .join(', ');
    const subtitle = [turn.interviewId ? interviewName : null, job]
      .filter(Boolean)
      .join(' · ');
    body = (
      <>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip tone="info">{t(QUESTION_KIND_KEYS[turn.question.kind])}</Chip>
            <Chip tone="neutral">{t(SOURCE_KEYS[turn.question.source])}</Chip>
          </div>
          <h1 className="font-display text-[clamp(24px,4vw,26px)] leading-tight font-semibold wrap-anywhere">
            {turn.question.text}
          </h1>
          {subtitle && (
            <p className="text-[15px] leading-normal text-muted wrap-anywhere">
              {subtitle}
            </p>
          )}
        </div>
        <PractiseTurn
          key={turn.id}
          turn={turn}
          from={from}
          resources={resources}
          listId={interview?.questions?.listId}
          reload={reload}
        />
        <Button
          variant="quietDanger"
          size="small"
          onClick={() => setRemoving(true)}
          className="gap-2 self-start text-[15px]">
          <Icon name="trash" size={18} />
          {t('practice.removeLink')}
        </Button>
        {removing && (
          <RemovePracticeDialog
            turnId={turn.id}
            onCancel={() => setRemoving(false)}
            onRemoved={() => navigate(back.to, { replace: true })}
          />
        )}
      </>
    );
  }

  return (
    <SignedInShell
      title={t('practice.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-5">
        {from === 'sessions' ? (
          <Link
            to={back.to}
            className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
            <Icon name="left" size={18} />
            {back.label}
          </Link>
        ) : (
          <Breadcrumb steps={steps} backLabel={backLabel} />
        )}
        {body}
      </div>
    </SignedInShell>
  );
};

/** A question of an interview practised: under the interview. */
export const InterviewPracticeScreen: React.FC = () => (
  <PracticeTurnScreen from="interview" />
);

/** A question of the brief practised: under the application. */
export const BriefPracticeScreen: React.FC = () => (
  <PracticeTurnScreen from="brief" />
);

/** Any question practised, opened from Sessions: back to Sessions. */
export const SessionPracticeScreen: React.FC = () => (
  <PracticeTurnScreen from="sessions" />
);

export default PracticeTurnScreen;
