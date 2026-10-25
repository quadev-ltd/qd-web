// The Interviews tab of an application (A8, D89): "Coming up", the next one first, with "Add an
// interview", then "Past", the latest first. Each row opens the interview. With none yet, what
// to add and why.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import DateTile from './DateTile';
import InterviewPanel from './InterviewPanel';
import {
  dayOf,
  interviewTitle,
  relativeDayOf,
  timesOf,
  useNow,
  zoneCityName,
  zoneName,
} from './interviewText';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type JobApplication } from '@/core/profile/applications';
import {
  type ApplicationInterview,
  INTERVIEWS_MAX,
} from '@/core/profile/interviews';
import {
  browserTimeZone,
  splitInterviews,
  zoneShortName,
} from '@/core/profile/interviewTime';
import { applicationInterviewPath } from '@/core/profile/paths';
import { useInterviews } from '@/core/profile/useInterviews';

/** The type and length of an interview, as chips. */
export const InterviewChips: React.FC<{
  interview: Pick<ApplicationInterview, 'type' | 'lengthMinutes'>;
}> = ({ interview: { type, lengthMinutes } }) => {
  const { t } = useTranslation();
  if (!type && !lengthMinutes) {
    return null;
  }
  return (
    <span className="flex flex-wrap gap-2">
      {type && <Chip>{t(`interviews.type_${type}`)}</Chip>}
      {lengthMinutes && (
        <Chip tone="neutral">
          {t('interviews.lengthChip', { minutes: lengthMinutes })}
        </Chip>
      )}
    </span>
  );
};

const InterviewRow: React.FC<{
  applicationId: string;
  interview: ApplicationInterview;
  past: boolean;
  now: number;
  timeZone: string;
}> = ({ applicationId, interview, past, now, timeZone }) => {
  const { t } = useTranslation();
  const when = [
    dayOf(interview.startsAt, now, timeZone),
    timesOf(t, interview, timeZone),
    ...(past ? [] : [relativeDayOf(t, interview.startsAt, now, timeZone)]),
  ].join(' · ');
  return (
    <li className="relative flex items-start gap-3 border-t border-border-faint py-4 first:border-t-0">
      <DateTile startsAt={interview.startsAt} timeZone={timeZone} past={past} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="text-[17px] leading-normal font-bold wrap-anywhere">
          {/* The whole row opens the interview. */}
          <Link
            to={applicationInterviewPath(applicationId, interview.id)}
            className="text-text no-underline after:absolute after:inset-0 hover:text-text hover:underline">
            {interviewTitle(t, interview)}
          </Link>
        </h3>
        <p className="text-[15px] leading-normal text-muted">{when}</p>
        {interview.description && (
          <p className="line-clamp-1 text-[15px] leading-normal wrap-anywhere">
            {interview.description}
          </p>
        )}
        <InterviewChips interview={interview} />
      </div>
      <span aria-hidden="true" className="flex self-center text-muted">
        <Icon name="right" />
      </span>
    </li>
  );
};

const InterviewList: React.FC<{
  applicationId: string;
  interviews: ApplicationInterview[];
  past?: boolean;
  now: number;
  timeZone: string;
}> = ({ applicationId, interviews, past = false, now, timeZone }) => (
  <Card elevation="raised" className="px-5 py-1">
    <ul className="flex flex-col">
      {interviews.map(interview => (
        <InterviewRow
          key={interview.id}
          applicationId={applicationId}
          interview={interview}
          past={past}
          now={now}
          timeZone={timeZone}
        />
      ))}
    </ul>
  </Card>
);

const HEADING = 'font-display text-[18px] leading-tight font-semibold';

export const InterviewsTab: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const { status, interviews, reload } = useInterviews(application.id);
  const [adding, setAdding] = useState(false);
  const now = useNow();
  const [timeZone] = useState(browserTimeZone);
  const full = interviews.length >= INTERVIEWS_MAX;

  let body: React.ReactNode;
  if (status === 'error') {
    body = (
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
  } else if (status === 'loading' && interviews.length === 0) {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  } else if (interviews.length === 0) {
    body = (
      <Card
        elevation="raised"
        className="items-center gap-3 px-2 py-8 text-center sm:px-6">
        <span
          aria-hidden="true"
          className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="calendar" size={28} />
        </span>
        <h2 className="font-display text-[20px] leading-tight font-semibold">
          {t('interviews.emptyTitle')}
        </h2>
        <p className="max-w-[420px] text-[15px] leading-normal text-muted">
          {t('interviews.emptyDescription')}
        </p>
        <Button
          onClick={() => setAdding(true)}
          className="mt-1 w-full max-w-[320px] gap-2">
          <Icon name="plus" size={18} />
          {t('interviews.addButton')}
        </Button>
      </Card>
    );
  } else {
    const { comingUp, past } = splitInterviews(interviews, now);
    // The zone's short name when every interview shown has the same ("London time (GMT)");
    // across a change of the clocks, the city alone ("London time").
    const shortNames = new Set(
      interviews.map(({ startsAt }) => zoneShortName(timeZone, startsAt)),
    );
    const zoneNote =
      shortNames.size === 1
        ? zoneName(t, timeZone, interviews[0].startsAt)
        : zoneCityName(t, timeZone, now);
    body = (
      <>
        <section
          aria-labelledby="interviews-coming-up"
          className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2
              id="interviews-coming-up"
              className={`${HEADING} min-w-0 flex-[1_1_200px]`}>
              {t('interviews.comingUpTitle', { count: comingUp.length })}
            </h2>
            <Button
              variant="secondary"
              size="small"
              onClick={() => setAdding(true)}
              disabled={full}
              className="gap-2 text-[15px]">
              <Icon name="plus" size={18} />
              {t('interviews.addButton')}
            </Button>
          </div>
          {full && (
            <p className="text-sm leading-normal text-muted">
              {t('interviews.limitMessage', { max: INTERVIEWS_MAX })}
            </p>
          )}
          {comingUp.length > 0 ? (
            <InterviewList
              applicationId={application.id}
              interviews={comingUp}
              now={now}
              timeZone={timeZone}
            />
          ) : (
            <p className="text-[15px] leading-normal text-muted">
              {t('interviews.noneComingUp')}
            </p>
          )}
        </section>
        {past.length > 0 && (
          <section
            aria-labelledby="interviews-past"
            className="flex flex-col gap-4">
            <h2 id="interviews-past" className={HEADING}>
              {t('interviews.pastTitle', { count: past.length })}
            </h2>
            <InterviewList
              applicationId={application.id}
              interviews={past}
              past
              now={now}
              timeZone={timeZone}
            />
          </section>
        )}
        <p className="text-sm leading-normal text-muted">
          {t('interviews.zoneNote', { zone: zoneNote })}
        </p>
      </>
    );
  }

  return (
    <div className="flex max-w-[760px] flex-col gap-4">
      {body}
      {adding && (
        <InterviewPanel
          application={application}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
};

export default InterviewsTab;
