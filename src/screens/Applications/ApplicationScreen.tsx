// One job application (A7 Details): what it is, the job, "Edit" and "Remove". The brief joins
// this page in the next slice (research doc 15 §16).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';

import EditApplicationPanel from './EditApplicationPanel';
import JobCard from './JobCard';
import RemoveApplicationDialog from './RemoveApplicationDialog';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import {
  useApplications,
  useApplicationsActions,
} from '@/core/profile/ApplicationsProvider';
import { parseProfileLink } from '@/core/profile/contract';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';
import { shortAddress } from '@/screens/Profile/Resource/resourceMeta';

const HOME_PATH = '/home';

const BackLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link
      to={HOME_PATH}
      className="flex min-h-11 items-center gap-1 self-start text-[15px] leading-natural font-medium no-underline hover:underline">
      <Icon name="left" size={18} />
      {t('applications.backLink')}
    </Link>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <>
    <dt className="text-sm leading-normal text-muted">{label}</dt>
    <dd className="text-base leading-normal whitespace-pre-wrap wrap-anywhere">
      {children}
    </dd>
  </>
);

export const ApplicationScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicationId = '' } = useParams();
  const { status, applications } = useApplications();
  const { reload } = useApplicationsActions();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

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
        <ButtonLink to={HOME_PATH} variant="secondary" size="small">
          {t('applications.notFoundLink')}
        </ButtonLink>
      </Card>,
    );
  }

  const posting = parseProfileLink(application.postingUrl ?? '');

  return frame(
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[clamp(26px,4vw,32px)] leading-tight font-semibold wrap-anywhere">
          {application.title}
        </h1>
        {application.company && (
          <p className="text-[17px] leading-normal text-muted wrap-anywhere">
            {application.company}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="application-details"
            className="gap-4">
            <div className="flex items-center gap-3">
              <h2
                id="application-details"
                className="flex-1 font-display text-[18px] leading-tight font-semibold">
                {t('applications.detailsTitle')}
              </h2>
              <Button
                variant="secondary"
                size="small"
                onClick={() => setEditing(true)}
                className="gap-2">
                <Icon name="edit" size={18} />
                {t('applications.editButton')}
              </Button>
            </div>
            <dl className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)] gap-x-4 gap-y-3">
              <Row label={t('applications.titleField')}>
                {application.title}
              </Row>
              {application.company && (
                <Row label={t('applications.companyLabel')}>
                  {application.company}
                </Row>
              )}
              {application.role && (
                <Row label={t('applications.roleLabel')}>
                  {application.role}
                </Row>
              )}
              {posting && (
                <Row label={t('applications.postingLabel')}>
                  <a
                    href={posting}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium no-underline hover:underline">
                    {shortAddress(posting)}
                    <span className="ml-1 inline-flex align-[-3px]">
                      <Icon name="external" size={16} />
                    </span>
                  </a>
                </Row>
              )}
              {application.notes && (
                <Row label={t('applications.notesLabel')}>
                  {application.notes}
                </Row>
              )}
            </dl>
          </Card>
          {application.jobDescription && <JobCard application={application} />}
        </div>

        <Card
          as="aside"
          elevation="raised"
          aria-labelledby="application-remove"
          className="min-w-0 flex-[1_1_300px] gap-3 p-4">
          <h2
            id="application-remove"
            className="font-display text-[18px] leading-tight font-semibold">
            {t('applications.removeTitle')}
          </h2>
          <p className="text-[15px] leading-normal text-muted">
            {t('applications.removeDescription')}
          </p>
          <Button
            variant="quietDanger"
            size="small"
            onClick={() => setRemoving(true)}
            className="gap-2 self-start text-[15px]">
            <Icon name="trash" size={18} />
            {t('applications.removeLink')}
          </Button>
        </Card>
      </div>

      {editing && (
        <EditApplicationPanel
          application={application}
          onClose={() => setEditing(false)}
        />
      )}
      {removing && (
        <RemoveApplicationDialog
          applicationId={application.id}
          onCancel={() => setRemoving(false)}
          onRemoved={() => navigate(HOME_PATH, { replace: true })}
        />
      )}
    </>,
  );
};

export default ApplicationScreen;
