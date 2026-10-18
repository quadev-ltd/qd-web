import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { type ReadPostingAgain } from './useReadPostingAgain';

import ReadAgain from '@/components/ReadAgain';
import TextPreview from '@/components/TextPreview';
import Banner, { type BannerProps } from '@/components/ui/Banner';
import Card from '@/components/ui/Card';
import { type JobApplication } from '@/core/profile/applications';
import {
  isRereading,
  PROFILE_DAILY_EXTRACTIONS,
  type RereadOutcome,
  rereadOutcomeOf,
} from '@/core/profile/contract';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** What the card says once the posting was read again; with a brief, what happens to it. */
const OUTCOMES = {
  changed: {
    tone: 'success',
    key: 'applications.postingChangedMessage',
    briefKey: 'applications.postingChangedBriefMessage',
  },
  unchanged: {
    tone: 'info',
    key: 'applications.postingUnchangedMessage',
    briefKey: 'applications.postingUnchangedMessage',
  },
  gone: {
    tone: 'info',
    key: 'applications.postingGoneMessage',
    briefKey: 'applications.postingGoneBriefMessage',
  },
  quota: {
    tone: 'danger',
    key: 'applications.postingRereadQuotaMessage',
    briefKey: 'applications.postingRereadQuotaMessage',
  },
  error: {
    tone: 'danger',
    key: 'applications.postingRereadErrorMessage',
    briefKey: 'applications.postingRereadErrorMessage',
  },
} as const satisfies Record<
  RereadOutcome['kind'],
  { tone: BannerProps['tone']; key: string; briefKey: string }
>;

export interface JobCardProps {
  application: Pick<
    JobApplication,
    'jobDescription' | 'createdAt' | 'job' | 'brief'
  >;
  /** A job from a link only: "Read the posting again". */
  readAgain?: ReadPostingAgain;
}

/**
 * "The job" (A7, D78): the text the brief is built from, and where it came from: pasted, read
 * from a file, or the copy of a posting (research doc 17), which can be read again.
 */
export const JobCard: React.FC<JobCardProps> = ({
  application: { jobDescription = '', createdAt, job, brief },
  readAgain,
}) => {
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
  const posting = job?.source === 'link' && job.status === 'ready';
  const outcome = posting ? rereadOutcomeOf(job.refresh) : null;

  return (
    <Card as="section" elevation="raised" aria-labelledby={titleId}>
      {outcome && (
        <div className="mb-3">
          <Banner
            tone={OUTCOMES[outcome.kind].tone}
            role={
              OUTCOMES[outcome.kind].tone === 'danger' ? 'alert' : 'status'
            }>
            {t(OUTCOMES[outcome.kind][brief ? 'briefKey' : 'key'], {
              date,
              max: PROFILE_DAILY_EXTRACTIONS,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        </div>
      )}
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
      <div className="mt-3 flex flex-col gap-3">
        <TextPreview text={jobDescription} />
        {posting && readAgain && (
          <ReadAgain
            reading={isRereading(job.refresh)}
            busy={readAgain.busy}
            buttonLabel={t('applications.rereadPostingButton')}
            hint={t(
              brief
                ? 'applications.rereadPostingBriefHint'
                : 'applications.rereadPostingHint',
            )}
            readingTitle={t('applications.rereadingPostingTitle')}
            readingHint={t('applications.rereadingPostingHint', { date })}
            errorMessage={
              readAgain.confirming ? undefined : readAgain.errorMessage
            }
            onRead={() => {
              readAgain.start();
            }}
          />
        )}
      </div>
    </Card>
  );
};

export default JobCard;
