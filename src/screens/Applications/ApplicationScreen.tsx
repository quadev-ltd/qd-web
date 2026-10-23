// One job application: its name, its tabs (the brief, the details) and the tab that is open.
// Sessions and CV versions have no backend yet, so they have no tab (ADR 0008).
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useParams } from 'react-router';

import BriefTab from './BriefTab';
import DetailsTab from './DetailsTab';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { useFlag } from '@/core/flags/FlagsProvider';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import { CvVersionsProvider } from '@/core/profile/CvVersionsProvider';
import {
  applicationCvPath,
  applicationDetailsPath,
  applicationPath,
  APPLICATIONS_PATH,
} from '@/core/profile/paths';
import ApplicationCvTab from '@/screens/Cv/ApplicationCvTab';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';
import { shortAddress } from '@/screens/Profile/Resource/resourceMeta';

const TAB =
  'flex min-h-11 items-center border-b-2 px-4 text-[16px] leading-natural font-medium no-underline';

const BackLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link
      to={APPLICATIONS_PATH}
      className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
      <Icon name="left" size={18} />
      {t('applications.backLink')}
    </Link>
  );
};

export type ApplicationTab = 'brief' | 'details' | 'cv';

export const ApplicationScreen: React.FC<{ tab: ApplicationTab }> = ({
  tab,
}) => {
  const { t } = useTranslation();
  // The CV tab comes with the CV tool (delivery 2b).
  const cvTool = useFlag('cvTool');
  const { applicationId = '' } = useParams();
  const { status, applications } = useApplications();
  const { reload } = useApplicationsActions();

  const frame = (children: React.ReactNode) => (
    <SignedInShell
      title={t('applications.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <BackLink />
        {children}
      </div>
    </SignedInShell>
  );

  if (status === 'idle' || status === 'loading') {
    return frame(
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>,
    );
  }
  if (status === 'error') {
    return frame(
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('applications.retryButton')}
          </Button>
        }>
        {t('applications.loadErrorMessage')}
      </Banner>,
    );
  }

  const application = applications.find(({ id }) => id === applicationId);
  if (!application) {
    return frame(
      <Card
        elevation="raised"
        className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
        <h1 className="font-display text-[22px] leading-tight font-semibold">
          {t('applications.notFoundTitle')}
        </h1>
        <p className="text-[16px] leading-normal text-muted">
          {t('applications.notFoundDescription')}
        </p>
        <ButtonLink to={APPLICATIONS_PATH} variant="secondary" size="small">
          {t('applications.notFoundLink')}
        </ButtonLink>
      </Card>,
    );
  }

  // Until the names are read: where the job comes from, the posting's site or the file.
  const subtitle =
    application.company ||
    (application.title
      ? undefined
      : application.job?.source === 'file'
        ? application.job.fileName
        : application.postingUrl
          ? shortAddress(application.postingUrl).split('/')[0]
          : undefined);

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? `${TAB} border-primary text-primary`
      : `${TAB} border-transparent text-muted hover:text-text`;

  return frame(
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[clamp(26px,4vw,32px)] leading-tight font-semibold wrap-anywhere">
          {application.title || t('applications.untitled')}
        </h1>
        {subtitle && (
          <p className="text-[17px] leading-normal text-muted wrap-anywhere">
            {subtitle}
          </p>
        )}
      </div>
      <nav
        aria-label={t('applications.tabsLabel')}
        className="-mt-2 flex gap-1 border-b border-border">
        <NavLink end to={applicationPath(application.id)} className={tabClass}>
          {t('applications.briefTab')}
        </NavLink>
        <NavLink
          to={applicationDetailsPath(application.id)}
          className={tabClass}>
          {t('applications.detailsTab')}
        </NavLink>
        {cvTool && (
          <NavLink to={applicationCvPath(application.id)} className={tabClass}>
            {t('applications.cvTab')}
          </NavLink>
        )}
      </nav>
      {tab === 'details' ? (
        <DetailsTab application={application} />
      ) : tab === 'cv' && cvTool ? (
        <CvVersionsProvider>
          <ApplicationCvTab application={application} />
        </CvVersionsProvider>
      ) : (
        <BriefTab application={application} />
      )}
    </>,
  );
};

export const ApplicationBriefScreen: React.FC = () => (
  <ApplicationScreen tab="brief" />
);

export const ApplicationDetailsScreen: React.FC = () => (
  <ApplicationScreen tab="details" />
);

export const ApplicationCvScreen: React.FC = () => (
  <ApplicationScreen tab="cv" />
);

export default ApplicationScreen;
