import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { type JobApplication } from '@/core/profile/applications';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** A job longer than this opens with its start only, and "Show all". */
const SHORT_JOB_CHARS = 700;

/**
 * "The job" (A7, D78): the text the brief is built from, and where it came from: pasted, read
 * from a file, or the copy of a posting (research doc 17).
 */
export const JobCard: React.FC<{
  application: Pick<JobApplication, 'jobDescription' | 'createdAt' | 'job'>;
}> = ({ application: { jobDescription = '', createdAt, job } }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const textId = useId();
  const long = jobDescription.length > SHORT_JOB_CHARS;
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
    <Card as="section" elevation="raised" aria-labelledby={`${textId}-title`}>
      <div className="flex flex-col gap-0.5">
        <h2
          id={`${textId}-title`}
          className="font-display text-[18px] leading-tight font-semibold">
          {t('applications.jobTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {sourceLine}
          {job?.edited && ` ${t('applications.jobEditedHint')}`}
          {job?.truncated && ` ${t('applications.jobTruncated')}`}
        </p>
      </div>
      <div
        id={textId}
        className={`relative mt-3 overflow-hidden rounded-control bg-background px-4 py-3 ${
          long && !open ? 'max-h-[240px]' : ''
        }`}>
        <p className="text-[15px] leading-normal whitespace-pre-wrap wrap-anywhere">
          {jobDescription}
        </p>
        {long && !open && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-background"
          />
        )}
      </div>
      {long && (
        <Button
          variant="quiet"
          size="small"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen(!open)}
          className="mt-2 gap-1.5 self-start text-[15px]">
          <Icon name={open ? 'up' : 'down'} size={18} />
          {t(
            open ? 'applications.showLessButton' : 'applications.showAllButton',
          )}
        </Button>
      )}
    </Card>
  );
};

export default JobCard;
