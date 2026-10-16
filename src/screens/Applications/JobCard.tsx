import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import TextPreview from '@/components/TextPreview';
import Card from '@/components/ui/Card';
import { type JobApplication } from '@/core/profile/applications';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/**
 * "The job" (A7, D78): the text the brief is built from, and where it came from: pasted, read
 * from a file, or the copy of a posting (research doc 17).
 */
export const JobCard: React.FC<{
  application: Pick<JobApplication, 'jobDescription' | 'createdAt' | 'job'>;
}> = ({ application: { jobDescription = '', createdAt, job } }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const taken = job?.takenAt ?? createdAt;
  const date = taken === null || taken === undefined ? null : formatDay(taken);
  const sourceLine =
    job?.source === 'file' && date
      ? t('applications.jobReadFrom', { fileName: job.fileName, date })
      : job?.source === 'link' && date
        ? t('applications.jobCopyTakenOn', { date })
        : date
          ? t('applications.jobPastedOn', { date })
          : t('applications.jobPasted');

  return (
    <Card as="section" elevation="raised" aria-labelledby={titleId}>
      <div className="flex flex-col gap-0.5">
        <h2
          id={titleId}
          className="font-display text-[18px] leading-tight font-semibold">
          {t('applications.jobTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {sourceLine}
          {job?.edited && ` ${t('applications.jobEditedHint')}`}
          {job?.truncated && ` ${t('applications.jobTruncated')}`}
        </p>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <TextPreview text={jobDescription} />
      </div>
    </Card>
  );
};

export default JobCard;
