// A question practised (X7, D94, research doc 21 §3): the way there (D96), the question with its
// kind and where it came from, and its 3 to 5 key points, each with its profile item and the
// resource it came from, or "Advice". Answering it and the feedback come with the backend's slice
// 3: until then, a card says so (doc 15 §25.4 choice 1). Then "Remove this practice".
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
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { type ProfileResource } from '@/core/profile/contract';
import { logProfileError } from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import {
  applicationInterviewPath,
  applicationInterviewsPath,
  applicationPath,
  APPLICATIONS_PATH,
  SESSIONS_PATH,
} from '@/core/profile/paths';
import { type PracticeTurn } from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectInterviews } from '@/core/state/selectors/interviews';
import {
  ITEM_KIND_KEYS,
  QUESTION_KIND_KEYS,
} from '@/screens/Applications/BriefCards';
import { interviewTitle } from '@/screens/Applications/interviews/interviewText';
import useItems from '@/screens/Cv/review/useItems';
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

/** The turn, read when the page opens and again after "Try again". */
const usePracticeTurn = (turnId: string) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(
    null,
  );
  const key = `${turnId}/${attempt}`;

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.getPracticeTurn(uid, turnId).then(
      turn => live && setLoaded({ key, state: { status: 'loaded', turn } }),
      error => {
        logProfileError('getPracticeTurn', error, uid);
        if (live) {
          setLoaded({ key, state: { status: 'error' } });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [gateway, key, turnId, uid]);

  return {
    state: loaded?.key === key ? loaded.state : { status: 'loading' as const },
    reload: () => setAttempt(count => count + 1),
  };
};

const KeyPointsCard: React.FC<{
  turn: PracticeTurn;
  resources: ProfileResource[];
}> = ({ turn, resources }) => {
  const { t } = useTranslation();
  const items = useItems(turn.keyPoints.some(({ itemId }) => itemId));
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
      <ul className="flex flex-col gap-3">
        {turn.keyPoints.map((point, index) => {
          const item = point.itemId ? items?.get(point.itemId) : undefined;
          const source = item
            ? resources.find(({ id }) => id === item.resourceId)
            : undefined;
          return (
            <li
              key={`${index}-${point.text}`}
              className="flex flex-col gap-1 border-t border-border-faint pt-3 first:border-t-0 first:pt-0">
              <p className="text-[15px] leading-normal wrap-anywhere">
                {point.text}
              </p>
              {item ? (
                <p className="flex items-center gap-1.5 text-[13px] leading-normal text-muted">
                  <Icon name="file" size={14} />
                  {source
                    ? t('applications.itemSource', {
                        kind: t(ITEM_KIND_KEYS[item.kind]),
                        title: source.title,
                      })
                    : t(ITEM_KIND_KEYS[item.kind])}
                </p>
              ) : (
                // An item removed since keeps its text without a source (choice 7).
                !point.itemId && (
                  <span className="flex">
                    <Chip tone="neutral">{t('applications.adviceChip')}</Chip>
                  </span>
                )
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

/** Until the backend's slice 3: what answering will be. */
const AnswerSoonCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="practice-answer"
      className="gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="practice-answer"
          className="min-w-0 flex-[1_1_160px] font-display text-[18px] leading-tight font-semibold">
          {t('practice.answerTitle')}
        </h2>
        <Chip tone="neutral">{t('home.comingSoonChip')}</Chip>
      </div>
      <p className="text-[15px] leading-normal text-muted">
        {t('practice.answerSoon')}
      </p>
    </Card>
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
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-5">
            <AnswerSoonCard />
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-5">
            <KeyPointsCard turn={turn} resources={resources} />
          </div>
        </div>
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
