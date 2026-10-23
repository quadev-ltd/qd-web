// Applications (D58, D85, delivery 2a): where an account with the interview tools lands after
// signing in. While it has no application, "Welcome", "Add your CV" and the three paths; then
// "Your applications", with each one's brief and "Your profile" beside them. Practice is not
// built yet; the CV tool has its own flag. The profile's and the applications' routes
// (ProfileRoutes, ApplicationRoutes) give it the flag, the gateway, the profile and the list.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import NewApplicationPanel from './NewApplicationPanel';
import { StartCardContent } from './StartCard';

import Icon, { type IconName } from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useFlag } from '@/core/flags/FlagsProvider';
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
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { applicationPath, CV_PATH, PROFILE_PATH } from '@/core/profile/paths';
import { useProfile } from '@/core/session/hooks';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const TITLE = 'font-display text-[28px] leading-tight font-semibold';

interface PathCardProps {
  icon: IconName;
  title: string;
  description: string;
  /** Opens the path; without it the path is not built yet and says "Coming soon". */
  onOpen?: () => void;
}

/** One of the three paths of a new account: no order and no numbers (D58). */
const PathCard: React.FC<PathCardProps> = ({
  icon,
  title,
  description,
  onOpen,
}) => {
  const { t } = useTranslation();
  const body = (
    <>
      <span
        aria-hidden="true"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
        <Icon name={icon} size={20} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-base leading-normal font-bold">{title}</span>
        <span className="text-sm leading-normal text-muted">{description}</span>
        {/* Under the words, so a narrow card keeps its width for them. */}
        {!onOpen && (
          <span className="mt-1.5 flex">
            <Chip>{t('home.comingSoonChip')}</Chip>
          </span>
        )}
      </span>
    </>
  );
  return (
    <Card as="article" elevation="raised" className="p-4">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full cursor-pointer items-center gap-3 rounded-control text-text">
          {body}
          <span className="flex text-muted">
            <Icon name="right" />
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3">{body}</div>
      )}
    </Card>
  );
};

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

const ApplicationCard: React.FC<{
  application: JobApplication;
  profileRevision: number | null;
}> = ({ application, profileRevision }) => {
  const { t } = useTranslation();
  return (
    <Card as="article" elevation="raised" className="relative gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-[17px] leading-normal font-bold wrap-anywhere">
            {/* The whole card opens the application. */}
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
        </div>
        <span className="flex pt-1 text-muted">
          <Icon name="right" />
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <BriefChips
          application={application}
          profileRevision={profileRevision}
        />
      </div>
    </Card>
  );
};

const ProfileCard: React.FC = () => {
  const { t } = useTranslation();
  const { status, resources } = useInterviewProfile();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="home-profile"
      className="gap-3 p-4">
      <h2
        id="home-profile"
        className="font-display text-[18px] leading-tight font-semibold">
        {t('home.profileCardTitle')}
      </h2>
      {status === 'loaded' && (
        <p className="text-[15px] leading-normal text-muted">
          {t('home.profileCardResources', { count: resources.length })}
        </p>
      )}
      <ButtonLink to={PROFILE_PATH} variant="secondary" size="small">
        {t('home.openProfileButton')}
      </ButtonLink>
    </Card>
  );
};

export const ApplicationsScreen: React.FC = () => {
  const { t } = useTranslation();
  const firstName = useProfile()?.firstName ?? '';
  const { status, applications, profileRevision } = useApplications();
  const { reload } = useApplicationsActions();
  const [adding, setAdding] = useState(false);
  const full = applications.length >= APPLICATIONS_MAX;
  const navigate = useNavigate();
  // The CV tool has its own flag (delivery 2b): without it, its path is "Coming soon".
  const cvTool = useFlag('cvTool');

  const listTitle = (
    <h1 className={`flex-1 ${TITLE}`}>{t('home.applicationsTitle')}</h1>
  );

  let body: React.ReactNode;
  if (status === 'error') {
    body = (
      <>
        {listTitle}
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
      </>
    );
  } else if (status === 'loaded' && applications.length === 0) {
    body = (
      <>
        <div className="flex flex-col gap-1">
          <h1 className={TITLE}>
            {t('applications.welcomeTitle', { firstName })}
          </h1>
          <p className="text-[16px] leading-normal text-muted">
            {t('applications.welcomeDescription')}
          </p>
        </div>
        <StartCardContent />
        <section aria-labelledby="home-paths" className="flex flex-col gap-4">
          <h2
            id="home-paths"
            className="font-display text-[22px] leading-natural font-semibold">
            {t('home.pathsTitle')}
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
            <PathCard
              icon="case"
              title={t('home.prepareTitle')}
              description={t('home.prepareDescription')}
              onOpen={() => setAdding(true)}
            />
            <PathCard
              icon="mic"
              title={t('home.practiseTitle')}
              description={t('home.practiseDescription')}
            />
            <PathCard
              icon="file"
              title={t('home.improveCvTitle')}
              description={t('home.improveCvDescription')}
              onOpen={cvTool ? () => navigate(CV_PATH) : undefined}
            />
          </div>
        </section>
      </>
    );
  } else if (status === 'loaded') {
    body = (
      <>
        <div className="flex flex-wrap items-center gap-4">
          {listTitle}
          <Button
            onClick={() => setAdding(true)}
            disabled={full}
            className="gap-2">
            <Icon name="plus" size={18} />
            {t('home.newApplicationButton')}
          </Button>
        </div>
        {full && (
          <Banner tone="warning">
            {t('applications.maxMessage', { max: APPLICATIONS_MAX })}
          </Banner>
        )}
        <div className="flex flex-wrap items-start gap-5">
          <ul className="grid min-w-0 flex-[999_1_560px] grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-5">
            {applications.map(application => (
              <li key={application.id} className="flex flex-col">
                <ApplicationCard
                  application={application}
                  profileRevision={profileRevision}
                />
              </li>
            ))}
          </ul>
          <div className="min-w-0 flex-[1_1_260px]">
            <ProfileCard />
          </div>
        </div>
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
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">{body}</div>
      {adding && <NewApplicationPanel onClose={() => setAdding(false)} />}
    </SignedInShell>
  );
};

export default ApplicationsScreen;
