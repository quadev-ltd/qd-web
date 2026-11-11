// A mock interview in Sessions (Web-R2-Mock, D100): the way, the length used, the voice and the
// tester's rating, "How it went" once it has ended (D101), then what was said, each question
// (follow-ups and skips marked) with the answer as text, how long it was spoken, its feedback
// behind "Show feedback", and "Practise this question" (MockFeedback). The audio was never kept.
// "Remove this mock interview", asked first. A session still going says so, with the way back into
// it, and shows no feedback.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import Dialog from '@/components/ui/Dialog';
import { clockTime } from '@/core/audio/clock';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import {
  isMockIdle,
  mockAnswerFeedbackOf,
  mockOverallOf,
  type MockSession,
  type MockTurn,
} from '@/core/profile/mockInterviews';
import {
  applicationInterviewMockPath,
  SESSIONS_PATH,
  sessionPracticePath,
} from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useMockSession } from '@/core/profile/useMockInterviews';
import { useSessionUser } from '@/core/session/hooks';
import {
  interviewTitle,
  useNow,
} from '@/screens/Applications/interviews/interviewText';
import {
  MockAnswerFeedback,
  type MockFeedbackControls,
  MockOverallCard,
  type MockPractise,
  useMockFeedback,
  useMockPractise,
} from '@/screens/Mock/MockFeedback';
import {
  mockMinutes,
  mockTitle,
  VOICE_KEYS,
  WAY_KEYS,
} from '@/screens/Mock/mockParts';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

/** "9 Nov, 18:20", in the browser's time zone. */
const WHEN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const WAIT_KEYS = {
  ok: 'mock.ratingWaitOk',
  'a-bit-long': 'mock.ratingWaitBitLong',
  'too-long': 'mock.ratingWaitTooLong',
} as const;

/** Each turn with its question's number: a follow-up keeps its question's. */
const numbered = (session: MockSession) =>
  session.turns.map(turn => ({
    turn,
    number:
      session.plan.questions.findIndex(({ id }) => id === turn.planId) + 1 ||
      null,
  }));

const TurnItem: React.FC<{
  turn: MockTurn;
  number: number | null;
  /** The interview is over: a question left open was never answered, and feedback shows. */
  ended: boolean;
  session: MockSession;
  feedback: MockFeedbackControls;
  practise?: MockPractise;
}> = ({ turn, number, ended, session, feedback, practise }) => {
  const { t } = useTranslation();
  const state = mockAnswerFeedbackOf(session, turn, feedback.reading);
  return (
    <li className="flex flex-col gap-2 border-t border-border-faint py-4 first:border-t-0">
      <div className="flex flex-wrap gap-2">
        {number !== null && (
          <Chip tone="neutral">{t('mock.questionChip', { number })}</Chip>
        )}
        {turn.rephrased && (
          <Chip tone="neutral">{t('mock.saidDifferentlyChip')}</Chip>
        )}
        {turn.kind === 'follow-up' && (
          <Chip tone="info">{t('mock.followUpChip')}</Chip>
        )}
        {turn.status === 'skipped' && (
          <Chip tone="neutral">{t('mock.skippedChip')}</Chip>
        )}
      </div>
      {/* The wording heard last, which the answer replies to; the first one under it. */}
      <p className="text-[17px] leading-normal font-bold wrap-anywhere">
        {turn.rephrased ?? turn.question}
      </p>
      {turn.rephrased && (
        <p className="text-sm leading-normal text-muted wrap-anywhere">
          {t('mock.firstAsked', { question: turn.question })}
        </p>
      )}
      {!turn.answer && turn.status === 'open' && ended && (
        <p className="text-sm leading-normal text-muted">
          {t('mock.notAnswered')}
        </p>
      )}
      {turn.answer && (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm leading-normal text-muted">
            {turn.answer.spokenMs > 0
              ? t('mock.yourAnswerSpoken', {
                  time: clockTime(turn.answer.spokenMs),
                })
              : t('mock.yourAnswer')}
          </p>
          {/* The candidate's own words, tinted as "Your words" are elsewhere. */}
          <blockquote className="rounded-xl bg-tint px-3.5 py-3 text-[15px] leading-normal whitespace-pre-line shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
            {turn.answer.transcript}
          </blockquote>
        </div>
      )}
      {/* Any question can be practised: answered, skipped, or left open when it ended. */}
      {ended && (state || (practise && turn.status !== 'answered')) && (
        <MockAnswerFeedback
          turnId={turn.id}
          state={state}
          feedback={feedback}
          practise={practise}
        />
      )}
    </li>
  );
};

const RemoveMockSessionDialog: React.FC<{
  sessionId: string;
  onCancel: () => void;
  onRemoved: () => void;
}> = ({ sessionId, onCancel, onRemoved }) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [removing, setRemoving] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    setRemoving(true);
    setFailed(false);
    try {
      await gateway.removeMockSession(sessionId);
    } catch (reason) {
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeMockSession', reason, uid);
        setFailed(true);
        setRemoving(false);
        return;
      }
    }
    onRemoved();
  };

  return (
    <Dialog
      title={t('mock.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!removing) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {t('mock.removeDialogText')}
      </p>
      {failed && (
        <Banner tone="danger" role="alert">
          {t('mock.removeFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          disabled={removing}
          aria-busy={removing}
          onClick={() => void confirm()}
          className="flex-[1_1_200px] gap-2">
          {removing ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="trash" size={18} />
          )}
          {removing ? t('mock.removingButton') : t('mock.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={removing}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('mock.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export const MockSessionScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessionId = '' } = useParams();
  const { applications } = useApplications();
  const { state, reload } = useMockSession(sessionId);
  const now = useNow();
  const [removing, setRemoving] = useState(false);
  const read = state.status === 'loaded' ? state.session : null;
  const feedback = useMockFeedback({
    session: read,
    shown: read?.status === 'ended',
    reload,
  });
  const practise = useMockPractise(read, sessionPracticePath);

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
            {t('mock.retryButton')}
          </Button>
        }>
        {t('mock.loadErrorMessage')}
      </Banner>
    );
  } else if (!state.session) {
    body = (
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('mock.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('mock.notFoundText')}
        </p>
        <ButtonLink to={SESSIONS_PATH} variant="secondary" size="small">
          {t('mock.backToSessions')}
        </ButtonLink>
      </Card>
    );
  } else {
    const session = state.session;
    const application = session.applicationRemoved
      ? undefined
      : applications.find(({ id }) => id === session.applicationId);
    const job = [
      application?.title || session.application.title,
      application?.company || session.application.company,
    ]
      .filter(Boolean)
      .join(', ');
    const sub = [
      job,
      session.startedAt === null ? null : WHEN.format(session.startedAt),
    ]
      .filter(Boolean)
      .join(' · ');
    const going = session.status === 'active' && !isMockIdle(session, now);
    const overall = mockOverallOf(session, feedback.reading);
    const rows = [
      [t('mock.summaryWay'), t(WAY_KEYS[session.way])],
      [
        t('mock.summaryLength'),
        t('mock.lengthUsed', {
          count: mockMinutes(session),
          length: session.lengthMinutes,
        }),
      ],
      [t('mock.summaryVoice'), t(VOICE_KEYS[session.voice])],
      [
        t('mock.ratingLabel'),
        session.feedback
          ? t('mock.rating', {
              feel: session.feedback.feel,
              wait: t(WAIT_KEYS[session.feedback.wait]),
            })
          : t('mock.ratingNone'),
      ],
    ];
    body = (
      <>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[clamp(24px,4vw,26px)] leading-tight font-semibold wrap-anywhere">
            {mockTitle(
              t,
              session.interview
                ? interviewTitle(t, session.interview)
                : undefined,
            )}
          </h1>
          {sub && (
            <p className="text-[16px] leading-normal text-muted wrap-anywhere">
              {sub}
            </p>
          )}
        </div>
        {going && session.interviewId && !session.interviewRemoved && (
          <Banner
            tone="info"
            action={
              <ButtonLink
                to={applicationInterviewMockPath(
                  session.applicationId,
                  session.interviewId,
                  session.id,
                )}
                size="small">
                {t('mock.continueItLink')}
              </ButtonLink>
            }>
            {t('mock.stillGoingMessage')}
          </Banner>
        )}
        <Card elevation="raised" className="p-5">
          <dl className="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-4 gap-y-2 text-[15px] leading-normal">
            {rows.map(([term, detail]) => (
              <div key={term} className="contents">
                <dt className="text-muted">{term}</dt>
                <dd className="wrap-anywhere">{detail}</dd>
              </div>
            ))}
          </dl>
        </Card>
        {overall && (
          <MockOverallCard
            session={session}
            state={overall}
            page="sessions"
            feedback={feedback}
            practise={practise}
          />
        )}
        <Card
          as="section"
          elevation="raised"
          aria-labelledby="mock-said"
          className="gap-0 p-5">
          <div className="flex flex-col gap-1 pb-1">
            <h2
              id="mock-said"
              className="font-display text-[18px] leading-tight font-semibold">
              {t('mock.saidTitle')}
            </h2>
            <p className="text-sm leading-normal text-muted">
              {t('mock.saidText')}
            </p>
          </div>
          <ol className="flex flex-col">
            {numbered(session).map(({ turn, number }) => (
              <TurnItem
                key={turn.id}
                turn={turn}
                number={number}
                ended={!going}
                session={session}
                feedback={feedback}
                practise={practise}
              />
            ))}
          </ol>
        </Card>
        <Button
          variant="quietDanger"
          size="small"
          onClick={() => setRemoving(true)}
          className="gap-2 self-start text-[15px]">
          <Icon name="trash" size={18} />
          {t('mock.removeLink')}
        </Button>
        {removing && (
          <RemoveMockSessionDialog
            sessionId={session.id}
            onCancel={() => setRemoving(false)}
            onRemoved={() => navigate(SESSIONS_PATH, { replace: true })}
          />
        )}
      </>
    );
  }

  return (
    <SignedInShell title={t('mock.documentTitle')} mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[760px] flex-col gap-5">
        <Link
          to={SESSIONS_PATH}
          className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
          <Icon name="left" size={18} />
          {t('sessions.title')}
        </Link>
        {body}
      </div>
    </SignedInShell>
  );
};

export default MockSessionScreen;
