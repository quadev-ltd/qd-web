// A mock interview of an interview (X6, D100, research doc 24 §12 to §14), at
// …/interviews/:interviewId/mock with the setup's choices, then at …/mock/:sessionId once it
// started:
// - Ready (Web-X6-Ready): the choices in short with "Change", "Before you start" until the
//   account's first, and "Start the interview", the press that lets the browser play sound. The
//   microphone being asked for, blocked or missing, and a browser that can't record.
// - Continue: a session still going, opened again: "Continue the interview".
// - The interview itself (MockLive), one column until hints come; leaving or ending during an
//   answer asks first; leaving the tab pauses it.
// - The end (MockEnd), with the feedback card.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useBlocker,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router';

import Icon from '@/components/Icon';
import Breadcrumb from '@/components/layout/Breadcrumb';
import SignedInShell from '@/components/layout/SignedInShell';
import NotAvailable from '@/components/NotAvailable';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Dialog from '@/components/ui/Dialog';
import { useFlag } from '@/core/flags/FlagsProvider';
import { canRecord } from '@/core/mock/audio';
import { type MockView } from '@/core/mock/MockInterviewController';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { ProfileErrorCode } from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  isMockIdle,
  MOCK_SESSIONS_MAX,
  mockProgress,
  type MockSession,
} from '@/core/profile/mockInterviews';
import {
  applicationInterviewMockPath,
  applicationInterviewPath,
  applicationInterviewsPath,
  applicationPath,
  APPLICATIONS_PATH,
  sessionMockPath,
} from '@/core/profile/paths';
import { MOCK_INTERVIEW_DAILY_LIMIT } from '@/core/profile/usageLimits';
import { useInterviews } from '@/core/profile/useInterviews';
import {
  useHasMockSessions,
  useMockLeft,
  useMockSession,
} from '@/core/profile/useMockInterviews';
import {
  interviewTitle,
  useNow,
} from '@/screens/Applications/interviews/interviewText';
import { MockEndPanel, MockFeedbackCard } from '@/screens/Mock/MockEnd';
import { MockHintsCard, useMockHints } from '@/screens/Mock/MockHints';
import {
  AnswerCard,
  InterviewerCard,
  MockProgress,
  PausedPanel,
  useTicking,
} from '@/screens/Mock/MockLive';
import {
  MockPanel,
  MockSummaryCard,
  mockTitle,
} from '@/screens/Mock/mockParts';
import {
  type MockChoices,
  mockChoicesOf,
  mockChoicesSearch,
} from '@/screens/Mock/MockSetupPanel';
import { useMockController } from '@/screens/Mock/useMockController';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const LIVE_PHASES: ReadonlySet<MockView['phase']> = new Set([
  'speaking',
  'tap',
  'answering',
  'sending',
  'issue',
  'paused',
]);

/** What a refused start says. */
const StartFailure: React.FC<{ code: ProfileErrorCode; max?: number }> = ({
  code,
  max,
}) => {
  const { t } = useTranslation();
  switch (code) {
    case ProfileErrorCode.DailyLimit:
      return (
        <Banner tone="warning" role="alert">
          {t('mock.limitMessage', {
            max: max ?? MOCK_INTERVIEW_DAILY_LIMIT.maxCallsPerDay,
            time: dailyLimitResetTime(),
          })}
        </Banner>
      );
    case ProfileErrorCode.MaxMockSessions:
      return (
        <Banner tone="warning" role="alert">
          {t('mock.sessionLimitMessage', { max: MOCK_SESSIONS_MAX })}
        </Banner>
      );
    case ProfileErrorCode.Reading:
      return (
        <Banner tone="warning" role="alert">
          {t('mock.jobReadingMessage')}
        </Banner>
      );
    case ProfileErrorCode.NoJobDescription:
      return (
        <Banner tone="warning" role="alert">
          {t('mock.noJobMessage')}
        </Banner>
      );
    case ProfileErrorCode.NotFound:
      return (
        <Banner tone="danger" role="alert">
          {t('mock.goneMessage')}
        </Banner>
      );
    case ProfileErrorCode.FlagOff:
      return (
        <Banner tone="danger" role="alert">
          {t('applications.notAvailableMessage')}
        </Banner>
      );
    default:
      return (
        <Banner tone="danger" role="alert">
          {t('mock.startFailedMessage')}
        </Banner>
      );
  }
};

/** "Before you start": shown until the account's first mock interview. */
const NoticeCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-notice"
      className="gap-3 p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="mic" size={20} />
        </span>
        <h2
          id="mock-notice"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('mock.noticeTitle')}
        </h2>
      </div>
      <p className="text-[15px] leading-normal">{t('mock.noticeMic')}</p>
      <p className="text-[15px] leading-normal">{t('mock.noticeAi')}</p>
      <p className="text-sm leading-normal text-muted">
        {t('mock.noticeFirst')}
      </p>
    </Card>
  );
};

/** The press that starts or continues it, or what stands in its way. */
const StartArea: React.FC<{
  view: MockView;
  label: string;
  note: string;
  onPress: () => void;
  max?: number;
}> = ({ view, label, note, onPress, max }) => {
  const { t } = useTranslation();
  switch (view.phase) {
    case 'mic-asking':
      return (
        <MockPanel
          lead={<Spinner decorative />}
          title={t('mock.micAskingTitle')}>
          <p>{t('mock.micAskingText')}</p>
        </MockPanel>
      );
    case 'mic-refused':
      return (
        <MockPanel
          tone="danger"
          icon="micOff"
          role="alert"
          title={t('mock.micRefusedTitle')}
          actions={
            <Button size="small" onClick={onPress} className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.tryAgainButton')}
            </Button>
          }>
          <p>{t('mock.micRefusedText')}</p>
        </MockPanel>
      );
    case 'mic-missing':
      return (
        <MockPanel
          tone="danger"
          icon="micOff"
          role="alert"
          title={t('mock.micMissingTitle')}
          actions={
            <Button size="small" onClick={onPress} className="gap-2">
              <Icon name="refresh" size={18} />
              {t('mock.tryAgainButton')}
            </Button>
          }>
          <p>{t('mock.micMissingText')}</p>
        </MockPanel>
      );
    case 'starting':
      return (
        <MockPanel
          lead={<Spinner decorative />}
          title={t('mock.startingTitle')}>
          <p>{t('mock.startingText')}</p>
        </MockPanel>
      );
    default:
      return (
        <div className="flex flex-col gap-2">
          {view.startFailure && (
            <StartFailure code={view.startFailure} max={max} />
          )}
          <Button
            onClick={onPress}
            className="h-14 w-full max-w-[360px] gap-2 text-[18px]">
            <Icon name="play" size={20} />
            {label}
          </Button>
          <p className="text-sm leading-normal text-muted">{note}</p>
        </div>
      );
  }
};

/** A browser that can't record (Web-X6-CantRecord): open the page in one that can. */
const CantRecord: React.FC = () => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const address = window.location.href;
  return (
    <MockPanel
      tone="danger"
      icon="micOff"
      role="alert"
      title={t('mock.cantRecordTitle')}
      actions={
        <Button
          size="small"
          onClick={() =>
            void navigator.clipboard?.writeText(address).then(
              () => setCopied(true),
              () => setCopied(false),
            )
          }
          className="gap-2">
          <Icon name={copied ? 'check' : 'copy'} size={18} />
          {copied ? t('mock.copiedButton') : t('mock.copyAddressButton')}
        </Button>
      }>
      <p>{t('mock.cantRecordText')}</p>
      <p className="rounded-control border border-border-strong bg-surface px-3 py-2 text-[15px] wrap-anywhere">
        {address}
      </p>
    </MockPanel>
  );
};

export const MockInterviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    applicationId = '',
    interviewId = '',
    sessionId: routeSessionId,
  } = useParams();
  const [search] = useSearchParams();
  const mockFlag = useFlag('mockInterview');
  const assistantFlag = useFlag('interviewAssistant');
  const enabled = mockFlag && assistantFlag;
  const { applications } = useApplications();
  const { interviews } = useInterviews(applicationId);
  const { left, reread } = useMockLeft();
  const hasSessions = useHasMockSessions();
  const choices: MockChoices = mockChoicesOf(search);
  const now = useNow();
  const [pausedByYou, setPausedByYou] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);

  const { controller, view } = useMockController(id =>
    navigate(applicationInterviewMockPath(applicationId, interviewId, id), {
      replace: true,
    }),
  );
  const sessionId = view.sessionId ?? routeSessionId;
  const { state: read, reload } = useMockSession(sessionId);
  const session: MockSession | null =
    read.status === 'loaded' ? read.session : null;
  const { resources } = useInterviewProfile();
  const hints = useMockHints({
    session,
    view,
    shown: session?.hintsShown ?? choices.hints,
    reload,
  });

  // The progress comes from the session: read again with each new question, and at the end.
  const turnId = view.question?.turnId;
  useEffect(() => {
    if (turnId || view.phase === 'ended') {
      reload();
    }
  }, [turnId, view.phase, reload]);
  useEffect(() => {
    if (view.phase === 'ended') {
      reread();
    }
  }, [view.phase, reread]);

  // Leaving the tab pauses the interview, and its clock (§12).
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        setPausedByYou(false);
        controller.pause();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [controller]);

  // An answer held only in the page: leaving asks first.
  const holds = LIVE_PHASES.has(view.phase) && controller.holdsAnswer();
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      holds && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!holds) {
      return undefined;
    }
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [holds]);

  useTicking(LIVE_PHASES.has(view.phase));

  const application = applications.find(({ id }) => id === applicationId);
  const interview = interviews.find(({ id }) => id === interviewId);
  const interviewName = interview
    ? interviewTitle(t, interview)
    : session?.interview
      ? interviewTitle(t, session.interview)
      : undefined;
  const title = mockTitle(t, interviewName);
  const job = [
    application?.title || session?.application.title,
    application?.company || session?.application.company,
  ]
    .filter(Boolean)
    .join(', ');
  const setupAgain = (again: MockChoices) =>
    navigate(
      `${applicationInterviewPath(applicationId, interviewId)}${mockChoicesSearch(again)}&mock=setup`,
    );

  /** One column at reading width; `wide` has room for the hints column beside the interview. */
  const shell = (children: React.ReactNode, wide = false) => (
    <SignedInShell title={t('mock.documentTitle')} mainClassName={PROFILE_MAIN}>
      <div
        className={`mx-auto flex ${wide ? 'max-w-[1120px]' : 'max-w-[760px]'} flex-col gap-5`}>
        {children}
      </div>
      {blocker.state === 'blocked' && (
        <Dialog
          title={t('mock.leaveDialogTitle')}
          icon="alert"
          onClose={() => blocker.reset()}>
          <p className="text-[16px] leading-normal text-muted">
            {t('mock.unsentAnswerText')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => blocker.reset()}
              className="flex-[1_1_140px]">
              {t('mock.stayButton')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => blocker.proceed()}
              className="flex-[1_1_140px]">
              {t('mock.leaveButton')}
            </Button>
          </div>
        </Dialog>
      )}
    </SignedInShell>
  );

  const head = (
    <div className="flex flex-col gap-1">
      <h1 className="font-display text-[clamp(24px,4vw,26px)] leading-tight font-semibold wrap-anywhere">
        {title}
      </h1>
      {job && (
        <p className="text-[16px] leading-normal text-muted wrap-anywhere">
          {job}
        </p>
      )}
    </div>
  );
  const breadcrumb = (
    <Breadcrumb
      steps={[
        { label: t('applications.title'), to: APPLICATIONS_PATH },
        {
          label:
            application?.title ||
            session?.application.title ||
            t('applications.untitled'),
          to: applicationPath(applicationId),
        },
        {
          label: t('applications.interviewsTab'),
          to: applicationInterviewsPath(applicationId),
        },
        {
          label: interviewName ?? t('interviews.untitled'),
          to: applicationInterviewPath(applicationId, interviewId),
        },
      ]}
      backLabel={interviewName ?? t('interviews.untitled')}
    />
  );

  if (!enabled) {
    return shell(
      <NotAvailable
        icon="wave"
        title={t('mock.setupTitle')}
        description={t('mock.notAvailableDescription')}
      />,
    );
  }

  // The end: just now, or opened again.
  const ended =
    view.phase === 'ended' ||
    (view.phase === 'idle' &&
      session !== null &&
      (session.status === 'ended' || isMockIdle(session, now)));
  if (ended && sessionId) {
    const ending =
      view.endReason ??
      session?.endReason ??
      (session && isMockIdle(session, now) ? 'idle' : 'ended');
    return shell(
      <>
        {head}
        <MockEndPanel
          ending={ending}
          session={session}
          transcriptTo={sessionMockPath(sessionId)}
          onNew={
            interview
              ? () =>
                  setupAgain({
                    lengthMinutes:
                      session?.lengthMinutes ?? choices.lengthMinutes,
                    voice: session?.voice ?? choices.voice,
                    hints: session?.hintsShown ?? choices.hints,
                  })
              : undefined
          }
        />
        <MockFeedbackCard sessionId={sessionId} sent={session?.feedback} />
      </>,
    );
  }

  if (LIVE_PHASES.has(view.phase)) {
    const pause = () => {
      setPausedByYou(true);
      controller.pause();
    };
    const end = () => {
      if (controller.holdsAnswer()) {
        setConfirmEnd(true);
      } else {
        void controller.end();
      }
    };
    return shell(
      <>
        <h1 className="font-display text-[clamp(22px,4vw,24px)] leading-tight font-semibold wrap-anywhere">
          {title}
        </h1>
        <MockProgress
          view={view}
          progress={session ? mockProgress(session, turnId) : null}
          onPause={pause}
          onEnd={end}
        />
        {view.phase === 'paused' && (
          <PausedPanel
            view={view}
            controller={controller}
            byYou={pausedByYou}
          />
        )}
        {/* The hints beside the interview at 1280, under it on a phone (Web-X6-Hints) */}
        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
            <InterviewerCard view={view} controller={controller} />
            <AnswerCard view={view} controller={controller} />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            {hints.now && (
              <MockHintsCard
                state={hints.now.state}
                resources={resources}
                onReveal={() => hints.now && hints.reveal(hints.now.turnId)}
              />
            )}
          </div>
        </div>
        {confirmEnd && (
          <Dialog
            title={t('mock.endDialogTitle')}
            icon="alert"
            tone="danger"
            onClose={() => setConfirmEnd(false)}>
            <p className="text-[16px] leading-normal text-muted">
              {t('mock.unsentAnswerText')}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmEnd(false);
                  void controller.end();
                }}
                className="flex-[1_1_200px]">
                {t('mock.endConfirmButton')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmEnd(false)}
                className="flex-[1_1_140px]">
                {t('mock.keepAnsweringButton')}
              </Button>
            </div>
          </Dialog>
        )}
      </>,
      true,
    );
  }

  if (!canRecord() || view.phase === 'unsupported') {
    return shell(
      <>
        {head}
        <CantRecord />
      </>,
    );
  }

  // A session opened again: still going, or not there.
  if (routeSessionId && !view.sessionId) {
    if (read.status === 'loading') {
      return shell(
        <div className="flex justify-center py-16 text-primary">
          <Spinner />
        </div>,
      );
    }
    if (read.status === 'error') {
      return shell(
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button variant="quiet" size="small" onClick={reload}>
              {t('mock.retryButton')}
            </Button>
          }>
          {t('mock.loadErrorMessage')}
        </Banner>,
      );
    }
    if (!session) {
      return shell(
        <Card
          elevation="raised"
          className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
          <h1 className="font-display text-[22px] leading-tight font-semibold">
            {t('mock.notFoundTitle')}
          </h1>
          <p className="text-[16px] leading-normal text-muted">
            {t('mock.notFoundText')}
          </p>
          <ButtonLink
            to={applicationInterviewPath(applicationId, interviewId)}
            variant="secondary"
            size="small">
            {t('mock.backToInterview')}
          </ButtonLink>
        </Card>,
      );
    }
  }

  // Ready, or Continue: the press that lets the browser play the interviewer.
  const continuing = Boolean(routeSessionId && session);
  return shell(
    <>
      {breadcrumb}
      {head}
      <MockSummaryCard
        lengthMinutes={session?.lengthMinutes ?? choices.lengthMinutes}
        voice={session?.voice ?? choices.voice}
        hints={session?.hintsShown ?? choices.hints}
        onChange={continuing ? undefined : () => setupAgain(choices)}
      />
      {!continuing && hasSessions === false && <NoticeCard />}
      <StartArea
        view={view}
        max={left?.max}
        label={
          continuing ? t('mock.continueInterviewButton') : t('mock.startButton')
        }
        note={continuing ? t('mock.continueNote') : t('mock.startNote')}
        onPress={() =>
          void (continuing && routeSessionId
            ? controller.resume(routeSessionId)
            : controller.start({
                applicationId,
                interviewId,
                way: 'take-turns',
                ...choices,
              }))
        }
      />
    </>,
  );
};

export default MockInterviewScreen;
