// The CV tab of an application (A6, doc 13 §16.2, §19): the version sent with it, with the job's
// words it doesn't show; the other versions for this job; and "Tailor your CV for this job",
// which opens "New CV version" on this job.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { startTitle, versionDay } from './cvMeta';
import { VersionRow } from './CvScreen';
import DownloadButton from './download/DownloadButton';
import NewCvVersionPanel from './NewCvVersionPanel';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type JobApplication, jobStatusOf } from '@/core/profile/applications';
import { openReviews } from '@/core/profile/cvVersions';
import {
  useCvVersions,
  useCvVersionsActions,
} from '@/core/profile/CvVersionsProvider';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { cvVersionPath } from '@/core/profile/paths';

export const ApplicationCvTab: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const { status, versions } = useCvVersions();
  const { reload } = useCvVersionsActions();
  const { resources } = useInterviewProfile();
  const [panel, setPanel] = useState(false);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('cv.retryButton')}
          </Button>
        }>
        {t('cv.loadErrorMessage')}
      </Banner>
    );
  }

  const forJob = versions.filter(
    ({ target }) =>
      target.kind === 'job' && target.applicationId === application.id,
  );
  const sent = forJob.find(
    ({ sentAt }) => sentAt !== undefined && sentAt !== null,
  );
  const others = forJob.filter(version => version !== sent);
  const ready =
    jobStatusOf(application) === 'ready' && Boolean(application.jobDescription);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-5">
        {sent && (
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="cv-sent-version"
            className="gap-2.5 p-5">
            <span className="flex">
              <Chip tone="success" icon="check">
                {t('cv.sentChip')}
              </Chip>
            </span>
            <h2
              id="cv-sent-version"
              className="font-display text-[18px] leading-tight font-semibold">
              {t('cv.versionOf', { date: versionDay(sent) })}
            </h2>
            <p className="text-sm leading-normal text-muted">
              {t('cv.versionFrom', { title: startTitle(t, sent, resources) })}
            </p>
            {sent.unsupportedJobTerms.length > 0 && (
              <p className="text-[15px] leading-normal text-muted">
                {t('cv.notShownIn', {
                  terms: sent.unsupportedJobTerms.join(', '),
                })}
              </p>
            )}
            <div className="flex flex-wrap items-start gap-2">
              <ButtonLink
                to={cvVersionPath(sent.id)}
                variant="secondary"
                size="small">
                {t('cv.openButton')}
              </ButtonLink>
              {openReviews(sent) === 0 && (
                <DownloadButton
                  version={sent}
                  fileTitle={t('cv.fileTitle', {
                    heading: [application.title, application.company]
                      .filter(Boolean)
                      .join(' · '),
                    date: versionDay(sent),
                  })}
                />
              )}
            </div>
          </Card>
        )}
        {others.length > 0 && (
          <Card
            as="section"
            elevation="raised"
            aria-labelledby="cv-other-versions"
            className="gap-1 p-5">
            <h2
              id="cv-other-versions"
              className="font-display text-[18px] leading-tight font-semibold">
              {t('cv.otherVersionsTitle')}
            </h2>
            <ul className="flex flex-col">
              {others.map(version => (
                <VersionRow
                  key={version.id}
                  version={version}
                  title={t('cv.versionOf', { date: versionDay(version) })}
                  meta={t('cv.versionFrom', {
                    title: startTitle(t, version, resources),
                  })}
                />
              ))}
            </ul>
          </Card>
        )}
      </div>
      <Card
        as="section"
        elevation="raised"
        aria-labelledby="cv-tailor-job"
        className="min-w-0 flex-[1_1_300px] gap-3 p-5">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="case" size={20} />
        </span>
        <h2
          id="cv-tailor-job"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('cv.tailorJobTitle')}
        </h2>
        <p className="text-[15px] leading-normal text-muted">
          {ready ? t('cv.tailorJobText') : t('cv.jobNotReadyForCv')}
        </p>
        <Button
          size="small"
          disabled={!ready}
          onClick={() => setPanel(true)}
          className="gap-2 self-start">
          <Icon name="plus" size={18} />
          {t('cv.newForJobButton')}
        </Button>
      </Card>
      {panel && (
        <NewCvVersionPanel
          kind="job"
          ask={false}
          applicationId={application.id}
          onClose={() => setPanel(false)}
        />
      )}
    </div>
  );
};

export default ApplicationCvTab;
