// Applications (D58, D85, D91, delivery 2a): "Your applications" with "New application", one
// application per row with where its brief is, in one column at the profile's width. With none
// yet, a line that says what an application gives. "Prepare for a job" on the profile opens
// "New application" here. The profile's and the applications' routes (ProfileRoutes,
// ApplicationRoutes) give it the flag, the gateway and the list.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate } from 'react-router';

import NewApplicationPanel from './NewApplicationPanel';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  APPLICATIONS_MAX,
  briefStateOf,
  type JobApplication,
  jobStatusOf,
} from '@/core/profile/applications';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import { browserTimeZone, nextInterviewOf } from '@/core/profile/interviewTime';
import { applicationPath } from '@/core/profile/paths';
import {
  nextInterviewWhen,
  useNow,
} from '@/screens/Applications/interviews/interviewText';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';
import { asksForNewApplication } from '@/screens/Profile/StartPaths';

/** Where an application's brief is, in chips: none yet, ready (with its gaps), out of date. */
const BriefChips: React.FC<{
  application: JobApplication;
  profileRevision: number | null;
}> = ({ application, profileRevision }) => {
  const { t } = useTranslation();
  // The job is read first; its brief can only follow.
  const job = jobStatusOf(application);
  if (job === 'reading' || job === 'awaitingUpload') {
    return (
      <Chip>
        <Spinner size="tiny" decorative />
        {t('home.readingChip')}
      </Chip>
    );
  }
  if (job === 'failed') {
    return (
      <Chip tone="danger" icon="alert">
        {t('home.unreadableChip')}
      </Chip>
    );
  }
  const state = briefStateOf(application, profileRevision);
  if (state.kind === 'none') {
    return <Chip>{t('home.briefNoneChip')}</Chip>;
  }
  if (state.kind === 'outOfDate') {
    return (
      <Chip tone="warning" icon="alert">
        {t('home.briefOutOfDateChip')}
      </Chip>
    );
  }
  return (
    <>
      <Chip tone="success" icon="check">
        {t('home.briefReadyChip')}
      </Chip>
      {state.gaps > 0 && (
        <Chip tone="warning" icon="alert">
          {t('home.briefGapsChip', { count: state.gaps })}
        </Chip>
      )}
    </>
  );
};

/** One application in the list: the whole row opens it. Its next interview is under the company. */
const ApplicationRow: React.FC<{
  application: JobApplication;
  profileRevision: number | null;
  now: number;
  timeZone: string;
}> = ({ application, profileRevision, now, timeZone }) => {
  const { t } = useTranslation();
  const next = nextInterviewOf(application.interviewTimes, now);
  return (
    <Card as="article" elevation="raised" className="relative p-4">
      <div className="flex items-center gap-3">
        {/* The chips sit on the right while there is room, and under the names when not. */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-[1_1_240px] flex-col">
            <h2 className="text-[17px] leading-normal font-bold wrap-anywhere">
              <Link
                to={applicationPath(application.id)}
                className="text-text no-underline after:absolute after:inset-0 after:rounded-card hover:text-text hover:underline">
                {application.title || t('applications.untitled')}
              </Link>
            </h2>
            {application.company && (
              <p className="text-[15px] leading-normal text-muted wrap-anywhere">
                {application.company}
              </p>
            )}
            {next && (
              <p className="mt-1 flex items-center gap-1.5 text-sm leading-normal font-medium text-primary-dark">
                <Icon name="calendar" size={16} />
                {t('applications.nextInterview', {
                  when: nextInterviewWhen(t, next, now, timeZone),
                })}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <BriefChips
              application={application}
              profileRevision={profileRevision}
            />
          </div>
        </div>
        <span className="flex text-muted">
          <Icon name="right" />
        </span>
      </div>
    </Card>
  );
};

export const ApplicationsScreen: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { status, applications, profileRevision } = useApplications();
  const { reload } = useApplicationsActions();
  const now = useNow();
  const [timeZone] = useState(browserTimeZone);
  // Open at once when "Prepare for a job" led here.
  const [adding, setAdding] = useState(() =>
    asksForNewApplication(location.state),
  );
  const full = applications.length >= APPLICATIONS_MAX;
  const loaded = status === 'loaded';

  let body: React.ReactNode;
  if (status === 'error') {
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
  } else if (loaded && applications.length === 0) {
    // The heading says it, under "Your applications".
    body = null;
  } else if (loaded) {
    body = (
      <>
        {full && (
          <Banner tone="warning">
            {t('applications.maxMessage', { max: APPLICATIONS_MAX })}
          </Banner>
        )}
        <ul className="flex flex-col gap-3">
          {applications.map(application => (
            <li key={application.id} className="flex flex-col">
              <ApplicationRow
                application={application}
                profileRevision={profileRevision}
                now={now}
                timeZone={timeZone}
              />
            </li>
          ))}
        </ul>
      </>
    );
  } else {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  }

  return (
    <SignedInShell
      title={t('applications.listDocumentTitle')}
      mainClassName={PROFILE_MAIN}>
      {/* One column, at the left of the page as the profile is (D91). */}
      <div className="mx-auto max-w-[1120px]">
        <div className="flex max-w-[760px] flex-col gap-6">
          {(loaded || status === 'error') && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                <h1 className="font-display text-[28px] leading-tight font-semibold">
                  {t('home.applicationsTitle')}
                </h1>
                {loaded && applications.length === 0 && (
                  <p className="text-[16px] leading-normal text-muted">
                    {t('applications.emptyDescription')}
                  </p>
                )}
              </div>
              {loaded && (
                <Button
                  onClick={() => setAdding(true)}
                  disabled={full}
                  className="gap-2">
                  <Icon name="plus" size={18} />
                  {t('home.newApplicationButton')}
                </Button>
              )}
            </div>
          )}
          {body}
        </div>
      </div>
      {adding && (
        <NewApplicationPanel
          onClose={() => {
            setAdding(false);
            // Asked for by the link that led here: once is enough, also after a reload.
            if (asksForNewApplication(location.state)) {
              navigate(location.pathname, { replace: true, state: null });
            }
          }}
        />
      )}
    </SignedInShell>
  );
};

export default ApplicationsScreen;
