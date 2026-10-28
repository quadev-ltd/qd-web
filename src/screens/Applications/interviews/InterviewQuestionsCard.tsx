// "Likely questions for this interview" (A8, D92, D94, research doc 21 §2), with the `textPractice`
// flag: not written yet, with "Write likely questions" and the lists left today; being written;
// written, each question with its kind and why it is likely; out of date, kept, with a banner
// naming what changed and "Write again". Each question can be practised (X7, doc 15 §25): its
// newest practice is marked "Practised", with "Practise again"; a question of the candidate's own
// is practised from a side panel.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { interviewTitle } from './interviewText';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { isJobPending, type JobApplication } from '@/core/profile/applications';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import {
  type ApplicationInterview,
  type InterviewQuestions,
  interviewQuestionsStateOf,
} from '@/core/profile/interviews';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  applicationDetailsPath,
  applicationInterviewPracticePath,
} from '@/core/profile/paths';
import { type PracticeMark } from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import {
  effectiveLimits,
  INTERVIEW_QUESTIONS_DAILY_LIMIT,
  serviceOverride,
  type StoredUsageLimits,
  USAGE_SERVICES,
} from '@/core/profile/usageLimits';
import { useInterviews } from '@/core/profile/useInterviews';
import {
  usePractice,
  usePracticeLeft,
  usePracticeMarks,
} from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';
import OwnQuestionPanel from '@/screens/Practice/OwnQuestionPanel';
import {
  type PracticeFailure,
  PracticeFailureBanner,
  practiceFailureOf,
} from '@/screens/Practice/practiceFailure';
import {
  PractiseAction,
  PractisedChip,
} from '@/screens/Practice/PractiseAction';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** Questions shown before "Show all". */
const SHOWN = 5;

const KIND_LABELS = {
  behavioural: 'applications.questionBehavioural',
  technical: 'applications.questionTechnical',
  role: 'applications.questionRole',
  motivation: 'applications.questionMotivation',
} as const;

type Failure = 'limit' | 'noJob' | 'reading' | 'gone' | 'flagOff' | 'model';

const failureOf = (error: unknown): Failure => {
  switch (getProfileErrorCode(error)) {
    case ProfileErrorCode.DailyLimit:
      return 'limit';
    case ProfileErrorCode.NoJobDescription:
      return 'noJob';
    case ProfileErrorCode.Reading:
      return 'reading';
    case ProfileErrorCode.NotFound:
      return 'gone';
    case ProfileErrorCode.FlagOff:
      return 'flagOff';
    default:
      // The model, a timeout or the network: worth trying again.
      return 'model';
  }
};

/** Today's count of lists written and this account's limit, for "9 of 10 lists left today". */
const useListsLeft = (builtAt: number | null | undefined) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const [today, setToday] = useState<{
    written: number;
    limits: StoredUsageLimits | null;
  } | null>(null);

  // Read again after each list: the backend counted it.
  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getInterviewQuestionsToday(uid),
      gateway.getUsageLimits(uid).catch(() => null),
    ]).then(
      ([written, limits]) => live && setToday({ written, limits }),
      () => live && setToday(null),
    );
    return () => {
      live = false;
    };
  }, [gateway, uid, builtAt]);

  if (!today) {
    return null;
  }
  const max = effectiveLimits(
    INTERVIEW_QUESTIONS_DAILY_LIMIT,
    serviceOverride(today.limits, USAGE_SERVICES.interviewQuestions),
  ).maxCallsPerDay;
  return { max, left: Math.max(0, max - today.written) };
};

/** What the list needs to offer "Practise" on each question. */
interface ListPractice {
  marks: Map<string, PracticeMark> | null;
  isStarting: (questionId: string) => boolean;
  /** Another practice is being started, none are left today, or the list can't be practised. */
  disabled: boolean;
  onPractise: (questionId: string) => void;
  pathOf: (turnId: string) => string;
}

const QuestionList: React.FC<{
  items: InterviewQuestions['items'];
  practice: ListPractice;
}> = ({ items, practice }) => {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, SHOWN);
  return (
    <>
      <ol className="flex flex-col">
        {shown.map(({ id, text, kind, why }) => {
          const mark = practice.marks?.get(id);
          return (
            <li
              key={id}
              className="flex flex-col gap-2 border-t border-border-faint py-4 first:border-t-0">
              <span className="flex flex-wrap gap-2">
                <Chip>{t(KIND_LABELS[kind])}</Chip>
                {mark && <PractisedChip mark={mark} />}
              </span>
              <p className="text-base leading-normal font-bold wrap-anywhere">
                {text}
              </p>
              {why && (
                <p className="flex items-start gap-1.5 text-sm leading-normal text-muted">
                  <span aria-hidden="true" className="flex pt-0.5">
                    <Icon name="bulb" size={16} />
                  </span>
                  <span className="min-w-0 flex-1 wrap-anywhere">{why}</span>
                </p>
              )}
              <PractiseAction
                practised={mark && { mark, to: practice.pathOf(mark.turnId) }}
                starting={practice.isStarting(id)}
                disabled={practice.disabled}
                onPractise={() => practice.onPractise(id)}
              />
            </li>
          );
        })}
      </ol>
      {!all && items.length > SHOWN && (
        <div className="border-t border-border-faint pt-2">
          <Button
            variant="quiet"
            size="small"
            onClick={() => setAll(true)}
            className="text-[15px]">
            {t('applications.showAllCountButton', { count: items.length })}
          </Button>
        </div>
      )}
    </>
  );
};

export const InterviewQuestionsCard: React.FC<{
  application: JobApplication;
  interview: ApplicationInterview;
}> = ({ application, interview }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { profileRevision } = useApplications();
  const { refreshProfileRevision } = useApplicationsActions();
  const { writeQuestions, writingQuestions, refresh } = useInterviews(
    application.id,
  );
  const [failure, setFailure] = useState<Failure | null>(null);
  const { questions } = interview;
  const lists = useListsLeft(questions?.builtAt);
  const writing = Boolean(writingQuestions[interview.id]);
  const practice = usePractice();
  const { left: practiceLeft, counted } = usePracticeLeft();
  const [practiceFailure, setPracticeFailure] = useState<{
    failure: PracticeFailure;
    questionId?: string;
  } | null>(null);
  const [own, setOwn] = useState(false);
  const listId = questions?.listId;
  const marks = usePracticeMarks(
    listId
      ? reader => gateway.getListPracticeTurns(reader, interview.id, listId)
      : null,
    turn => turn.question.questionId,
    `${interview.id}/${listId ?? ''}`,
  );
  // A practice started here opens when it is stored, unless the candidate has left the page.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The profile may have changed on its own page since it was read: one read says so.
  useEffect(() => {
    refreshProfileRevision();
    // Once per interview opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.id]);

  const state = interviewQuestionsStateOf(
    interview,
    application.revision,
    profileRevision,
  );
  const limitReached = failure === 'limit' || lists?.left === 0;
  const noJob = failure === 'noJob' || !application.jobDescription;
  const jobReading = failure === 'reading' || isJobPending(application);

  const practicePath = (turnId: string) =>
    applicationInterviewPracticePath(application.id, interview.id, turnId);

  const practise = async (questionId: string) => {
    setPracticeFailure(null);
    try {
      const turnId = await practice.start({
        applicationId: application.id,
        interviewId: interview.id,
        question: {
          source: 'interview',
          ...(listId ? { listId } : {}),
          questionId,
        },
      });
      // A list written before it had an id was given one: read it again.
      if (!listId) {
        await refresh(interview.id);
      }
      if (mounted.current) {
        navigate(practicePath(turnId));
      }
    } catch (error) {
      logProfileError('startPracticeTurn', error, uid);
      const reason = practiceFailureOf(error);
      // The list was written again elsewhere: show it as it is now.
      if (reason === 'changed') {
        await refresh(interview.id);
      }
      if (mounted.current) {
        setPracticeFailure({ failure: reason, questionId });
      }
      counted();
    }
  };
  const practiceBlocked =
    practice.anyStarting ||
    writing ||
    jobReading ||
    practiceLeft?.left === 0 ||
    practiceFailure?.failure === 'limit' ||
    practiceFailure?.failure === 'turnLimit';

  const write = async () => {
    setFailure(null);
    try {
      await writeQuestions(interview.id);
    } catch (error) {
      logProfileError('writeInterviewQuestions', error, uid);
      setFailure(failureOf(error));
    }
  };

  const left = lists && (
    <p className="text-sm leading-normal text-muted">
      {t('interviews.questionsLeft', lists)}
    </p>
  );

  /** What stands where "Write likely questions" or "Write again" would be, when it can't be used. */
  const blocked = jobReading ? (
    <p className="text-[15px] leading-normal">
      {t('interviews.questionsJobReadingMessage')}
    </p>
  ) : noJob ? (
    <p className="text-[15px] leading-normal">
      {t('interviews.questionsNoJobMessage')}{' '}
      <Link
        to={applicationDetailsPath(application.id)}
        className="font-medium whitespace-nowrap">
        {t('interviews.openDetailsLink')}
      </Link>
    </p>
  ) : null;

  const messages = (
    <>
      {failure === 'limit' && (
        <Banner tone="warning" role="alert">
          {t('interviews.questionsLimitMessage', {
            max: lists?.max ?? INTERVIEW_QUESTIONS_DAILY_LIMIT.maxCallsPerDay,
            time: dailyLimitResetTime(),
          })}
        </Banner>
      )}
      {failure === 'model' && (
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button
              variant="quiet"
              size="small"
              onClick={write}
              disabled={writing || limitReached}>
              {t('interviews.retryButton')}
            </Button>
          }>
          {t(
            questions
              ? 'interviews.questionsFailedKeptMessage'
              : 'interviews.questionsFailedMessage',
          )}
        </Banner>
      )}
      {failure === 'gone' && (
        <Banner tone="danger" role="alert">
          {t('interviews.goneMessage')}
        </Banner>
      )}
      {failure === 'flagOff' && (
        <Banner tone="danger" role="alert">
          {t('applications.notAvailableMessage')}
        </Banner>
      )}
      {practiceFailure && (
        <PracticeFailureBanner
          failure={practiceFailure.failure}
          max={practiceLeft?.max}
          retryDisabled={practiceBlocked}
          onRetry={() => {
            const { questionId } = practiceFailure;
            if (questionId) {
              practise(questionId);
            }
          }}
        />
      )}
    </>
  );

  const writingStatus = (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-[20px] border border-border-faint p-4">
      <div className="flex items-center gap-3">
        <span className="flex text-primary">
          <Spinner size="small" decorative />
        </span>
        <h3 className="text-[17px] leading-tight font-semibold">
          {t('interviews.writingTitle')}
        </h3>
      </div>
      <p className="text-[15px] leading-normal text-muted">
        {t('interviews.writingDescription')}
      </p>
    </div>
  );

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="interview-questions"
      className="gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2
          id="interview-questions"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('interviews.questionsTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {questions && questions.builtAt !== null
            ? t('interviews.questionsWrittenOn', {
                date: formatDay(questions.builtAt),
              })
            : t('interviews.questionsDescription')}
        </p>
      </div>
      {messages}
      {writing && writingStatus}
      {!questions &&
        !writing &&
        (blocked ?? (
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={write} disabled={limitReached} className="gap-2">
              <Icon name="bulb" size={18} />
              {t('interviews.writeQuestionsButton')}
            </Button>
            {failure !== 'limit' && left}
          </div>
        ))}
      {questions && state.kind === 'outOfDate' && !writing && (
        <Banner
          tone="warning"
          action={
            blocked ? undefined : (
              <Button
                variant="quiet"
                size="small"
                onClick={write}
                disabled={limitReached}
                className="gap-2">
                <Icon name="refresh" size={18} />
                {t('interviews.writeAgainButton')}
              </Button>
            )
          }>
          <span className="flex flex-col gap-1">
            <span>{t(`interviews.questionsChanged_${state.because}`)}</span>
            {blocked
              ? null
              : failure !== 'limit' &&
                lists && (
                  <span className="text-sm text-muted">
                    {t('interviews.questionsLeft', lists)}
                  </span>
                )}
          </span>
        </Banner>
      )}
      {questions && state.kind === 'outOfDate' && blocked}
      {questions && (
        <>
          <QuestionList
            items={questions.items}
            practice={{
              marks,
              isStarting: questionId =>
                practice.isStarting({
                  applicationId: application.id,
                  interviewId: interview.id,
                  question: { source: 'interview', questionId },
                }),
              disabled: practiceBlocked,
              onPractise: practise,
              pathOf: practicePath,
            }}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border-faint pt-2">
            <Button
              variant="quiet"
              size="small"
              onClick={() => setOwn(true)}
              disabled={practiceBlocked}
              className="gap-2 text-[15px]">
              <Icon name="plus" size={18} />
              {t('practice.ownButton')}
            </Button>
            {practiceLeft && practiceFailure?.failure !== 'limit' && (
              <p className="text-sm leading-normal text-muted">
                {t('practice.callsLeft', practiceLeft)}
              </p>
            )}
          </div>
        </>
      )}
      {own && (
        <OwnQuestionPanel
          applicationId={application.id}
          interviewId={interview.id}
          description={[interviewTitle(t, interview), application.title]
            .filter(Boolean)
            .join(' · ')}
          left={practiceLeft}
          onClose={() => setOwn(false)}
          onStarted={turnId => navigate(practicePath(turnId))}
          onCounted={counted}
        />
      )}
    </Card>
  );
};

export default InterviewQuestionsCard;
