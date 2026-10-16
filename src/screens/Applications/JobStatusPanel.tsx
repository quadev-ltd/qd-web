import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import { buttonClassName } from '@/components/ui/buttonStyles';
import { jobStatusOf, type JobApplication } from '@/core/profile/applications';
import { parseProfileLink } from '@/core/profile/contract';

const UNREADABLE = {
  page: {
    title: 'applications.pageUnreadableTitle',
    description: 'applications.pageUnreadableDescription',
  },
  file: {
    title: 'applications.fileUnreadableTitle',
    description: 'applications.fileUnreadableDescription',
  },
  job: {
    title: 'applications.jobUnreadableTitle',
    description: 'applications.jobUnreadableDescription',
  },
} as const;

export interface JobStatusPanelProps {
  application: Pick<JobApplication, 'job' | 'postingUrl'>;
  /** Opens the form where the job's text can be pasted instead. */
  onPaste: () => void;
}

/**
 * Where the job of an application is while it is not ready (A2, research doc 17): its file has
 * not arrived, it is being read, or it could not be read, and then how to go on.
 */
export const JobStatusPanel: React.FC<JobStatusPanelProps> = ({
  application,
  onPaste,
}) => {
  const { t } = useTranslation();
  const status = jobStatusOf(application);
  const { job } = application;

  if (status === 'reading' || status === 'awaitingUpload') {
    const reading = status === 'reading';
    return (
      <div
        role="status"
        className="flex flex-col gap-2.5 rounded-card bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex text-primary">
            {reading ? (
              <Spinner size="medium" decorative />
            ) : (
              <Icon name="clock" size={22} />
            )}
          </span>
          <h2 className="font-display text-[17px] leading-tight font-semibold">
            {t(
              reading
                ? 'applications.readingJobTitle'
                : 'applications.waitingJobTitle',
            )}
          </h2>
        </div>
        <p className="text-[15px] leading-normal text-muted">
          {t(
            reading
              ? 'applications.readingJobDescription'
              : 'applications.waitingJobDescription',
          )}
        </p>
      </div>
    );
  }

  const posting =
    job?.source === 'link'
      ? parseProfileLink(application.postingUrl ?? '')
      : undefined;
  const which =
    job?.source === 'link' && job.failure === 'link-unreadable'
      ? 'page'
      : job?.source === 'file'
        ? 'file'
        : 'job';
  return (
    <div
      role="status"
      className="flex flex-col gap-2.5 rounded-card bg-danger-tint p-5">
      <div className="flex items-center gap-3">
        <span className="flex text-danger">
          <Icon name="alert" size={22} />
        </span>
        <h2 className="font-display text-[17px] leading-tight font-semibold">
          {t(UNREADABLE[which].title)}
        </h2>
      </div>
      <p className="text-[15px] leading-normal">
        {t(UNREADABLE[which].description)}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="small" onClick={onPaste}>
          {t('applications.pasteInsteadButton')}
        </Button>
        {posting && (
          <a
            href={posting}
            target="_blank"
            rel="noreferrer"
            className={buttonClassName({
              variant: 'quiet',
              size: 'small',
              className: 'gap-2',
            })}>
            <Icon name="external" size={18} />
            {t('applications.openPostingLink')}
          </a>
        )}
      </div>
    </div>
  );
};

export default JobStatusPanel;
