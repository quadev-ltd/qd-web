// One interview of an application (A8, D89): a link back to the application's interviews, its
// name with the application under it, "Details" with when it is and what the candidate knows
// about it, and "Edit". Until text practice exists (D92), "Get ready for it" says what will come.
// With text practice (D94), its likely questions take that card's place. Then "Remove this
// interview".
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import DateTile from './DateTile';
import InterviewPanel from './InterviewPanel';
import InterviewQuestionsCard from './InterviewQuestionsCard';
import {
  dayOf,
  fullDayOf,
  interviewTitle,
  relativeDayOf,
  timesOf,
  useNow,
  zoneCityName,
  zoneName,
} from './interviewText';
import RemoveInterviewDialog from './RemoveInterviewDialog';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useFlag } from '@/core/flags/FlagsProvider';
import { type JobApplication } from '@/core/profile/applications';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import { type ApplicationInterview } from '@/core/profile/interviews';
import {
  browserTimeZone,
  isComingUp,
  zonedParts,
} from '@/core/profile/interviewTime';
import {
  applicationInterviewsPath,
  APPLICATIONS_PATH,
} from '@/core/profile/paths';
import { useInterviews } from '@/core/profile/useInterviews';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <>
    <dt className="text-sm leading-normal text-muted">{label}</dt>
    <dd className="text-base leading-normal wrap-anywhere">{children}</dd>
  </>
);

const NotFound: React.FC<{
  title: string;
  description: string;
  link: string;
  to: string;
}> = ({ title, description, link, to }) => (
  <Card
    elevation="raised"
    className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
    <h1 className="font-display text-[22px] leading-tight font-semibold">
      {title}
    </h1>
    <p className="text-[16px] leading-normal text-muted">{description}</p>
    <ButtonLink to={to} variant="secondary" size="small">
      {link}
    </ButtonLink>
  </Card>
);

const DetailsCard: React.FC<{
  interview: ApplicationInterview;
  now: number;
  timeZone: string;
  onEdit: () => void;
}> = ({ interview, now, timeZone, onEdit }) => {
  const { t } = useTranslation();
  const comingUp = isComingUp(interview, now);
  // Entered in another zone: when that was there, as the candidate typed it.
  const elsewhere = interview.timeZone !== timeZone;
  const shown = zonedParts(interview.startsAt, timeZone);
  const entered = zonedParts(interview.startsAt, interview.timeZone);
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="interview-details"
      className="gap-4 p-5">
      <div className="flex items-center gap-2">
        <h2
          id="interview-details"
          className="flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('interviews.detailsTitle')}
        </h2>
        <Button
          variant="secondary"
          size="small"
          onClick={onEdit}
          className="gap-2 text-[15px]">
          <Icon name="edit" size={18} />
          {t('interviews.editButton')}
        </Button>
      </div>
      <div className="flex items-start gap-3.5">
        <DateTile
          startsAt={interview.startsAt}
          timeZone={timeZone}
          past={!comingUp}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[17px] leading-normal font-bold">
            {fullDayOf(interview.startsAt, timeZone)}
          </p>
          <p className="text-[15px] leading-normal text-muted">
            {t('interviews.timesInZone', {
              times: timesOf(t, interview, timeZone),
              zone: zoneName(t, timeZone, interview.startsAt),
            })}
          </p>
          {elsewhere && (
            <p className="text-[15px] leading-normal text-muted">
              {t('interviews.addedInZone', {
                zone: zoneCityName(t, interview.timeZone, interview.startsAt),
                when:
                  entered.date === shown.date
                    ? entered.time
                    : t('interviews.dayAndTime', {
                        day: dayOf(interview.startsAt, now, interview.timeZone),
                        time: entered.time,
                      }),
              })}
            </p>
          )}
          {comingUp && (
            <span className="mt-1 flex">
              <Chip tone="brand" icon="clock">
                {relativeDayOf(t, interview.startsAt, now, timeZone, true)}
              </Chip>
            </span>
          )}
        </div>
      </div>
      {(interview.type || interview.lengthMinutes) && (
        <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-4 gap-y-3">
          {interview.type && (
            <Row label={t('interviews.typeLabel')}>
              {t(`interviews.type_${interview.type}`)}
            </Row>
          )}
          {interview.lengthMinutes && (
            <Row label={t('interviews.lengthLabel')}>
              {t('interviews.lengthValue', {
                minutes: interview.lengthMinutes,
              })}
            </Row>
          )}
        </dl>
      )}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm leading-normal font-normal text-muted">
          {t('interviews.descriptionLabel')}
        </h3>
        {interview.description ? (
          // The candidate's own words, tinted as "Your words" are elsewhere.
          <blockquote className="rounded-xl bg-tint px-3.5 py-3 text-[15px] leading-normal whitespace-pre-wrap shadow-[inset_3px_0_0_var(--color-primary)] wrap-anywhere">
            {interview.description}
          </blockquote>
        ) : (
          <p className="text-[15px] leading-normal">
            {t('interviews.descriptionEmpty')}
          </p>
        )}
      </div>
    </Card>
  );
};

/** Without text practice (the `textPractice` flag off): what this page will offer. */
const ComingSoonCard: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="interview-ready"
      className="gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2
          id="interview-ready"
          className="min-w-0 flex-[1_1_160px] font-display text-[18px] leading-tight font-semibold">
          {t('interviews.readyTitle')}
        </h2>
        <Chip tone="neutral">{t('home.comingSoonChip')}</Chip>
      </div>
      <p className="text-[15px] leading-normal text-muted">
        {t('interviews.readyDescription')}
      </p>
    </Card>
  );
};

const InterviewPage: React.FC<{
  application: JobApplication;
  interviewId: string;
}> = ({ application, interviewId }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { status, interviews, reload } = useInterviews(application.id);
  const now = useNow();
  const [timeZone] = useState(browserTimeZone);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  // D94: the likely questions, with text practice; until then, what will come.
  const textPractice = useFlag('textPractice');
  const interview = interviews.find(({ id }) => id === interviewId);
  const tabPath = applicationInterviewsPath(application.id);

  if (!interview) {
    if (status === 'error') {
      return (
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button variant="quiet" size="small" onClick={reload}>
              {t('interviews.retryButton')}
            </Button>
          }>
          {t('interviews.loadErrorMessage')}
        </Banner>
      );
    }
    if (status === 'loading') {
      return (
        <div className="flex justify-center py-16 text-primary">
          <Spinner />
        </div>
      );
    }
    return (
      <NotFound
        title={t('interviews.notFoundTitle')}
        description={t('interviews.notFoundDescription')}
        link={t('interviews.notFoundLink')}
        to={tabPath}
      />
    );
  }

  const title = interviewTitle(t, interview);
  const subtitle = [application.title, application.company]
    .filter(Boolean)
    .join(' · ');
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[clamp(26px,4vw,28px)] leading-tight font-semibold wrap-anywhere">
          {title}
        </h1>
        {subtitle && (
          <p className="text-[16px] leading-normal text-muted wrap-anywhere">
            {subtitle}
          </p>
        )}
      </div>
      <DetailsCard
        interview={interview}
        now={now}
        timeZone={timeZone}
        onEdit={() => setEditing(true)}
      />
      {textPractice ? (
        <InterviewQuestionsCard
          application={application}
          interview={interview}
        />
      ) : (
        <ComingSoonCard />
      )}
      <Button
        variant="quietDanger"
        size="small"
        onClick={() => setRemoving(true)}
        className="gap-2 self-start text-[15px]">
        <Icon name="trash" size={18} />
        {t('interviews.removeLink')}
      </Button>

      {editing && (
        <InterviewPanel
          application={application}
          interview={interview}
          onClose={() => setEditing(false)}
        />
      )}
      {removing && (
        <RemoveInterviewDialog
          applicationId={application.id}
          interviewId={interview.id}
          description={t('interviews.removeDialogText', {
            title,
            when: t('interviews.dayAtTime', {
              day: dayOf(interview.startsAt, now, timeZone),
              time: zonedParts(interview.startsAt, timeZone).time,
            }),
          })}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(tabPath, { replace: true })}
        />
      )}
    </>
  );
};

/** The page of one interview, under its application. */
export const InterviewScreen: React.FC = () => {
  const { t } = useTranslation();
  const { applicationId = '', interviewId = '' } = useParams();
  const { status, applications } = useApplications();
  const { reload } = useApplicationsActions();
  const application = applications.find(({ id }) => id === applicationId);

  let body: React.ReactNode;
  if (status === 'idle' || status === 'loading') {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  } else if (status === 'error') {
    body = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('applications.retryButton')}
          </Button>
        }>
        {t('applications.loadErrorMessage')}
      </Banner>
    );
  } else if (!application) {
    body = (
      <NotFound
        title={t('applications.notFoundTitle')}
        description={t('applications.notFoundDescription')}
        link={t('applications.notFoundLink')}
        to={APPLICATIONS_PATH}
      />
    );
  } else {
    body = (
      <InterviewPage application={application} interviewId={interviewId} />
    );
  }

  return (
    <SignedInShell
      title={t('interviews.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto max-w-[1120px]">
        <div className="flex max-w-[760px] flex-col gap-5">
          <Link
            to={
              application
                ? applicationInterviewsPath(application.id)
                : APPLICATIONS_PATH
            }
            className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
            <Icon name="left" size={18} />
            {application
              ? application.title || t('applications.untitled')
              : t('applications.backLink')}
          </Link>
          {body}
        </div>
      </div>
    </SignedInShell>
  );
};

export default InterviewScreen;
