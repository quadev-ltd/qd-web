import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import Icon, { type IconName } from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';
import {
  PROFILE_DAILY_EXTRACTIONS,
  type ProfileResource,
  type ProfileResourceFailure,
} from '@/core/profile/contract';
import { dailyLimitResetTime } from '@/core/profile/limits';

/** The heading and the sentence for each reason a resource was not read. */
const FAILURES = {
  'unsupported-file': {
    title: 'resource.failedUnsupportedFileTitle',
    description: 'resource.failedUnsupportedFileDescription',
  },
  empty: {
    title: 'resource.failedEmptyTitle',
    description: 'resource.failedEmptyDescription',
  },
  'too-long': {
    title: 'resource.failedTooLongTitle',
    description: 'resource.failedTooLongDescription',
  },
  'too-large': {
    title: 'resource.failedTooLargeTitle',
    description: 'resource.failedTooLargeDescription',
  },
  'link-unreadable': {
    title: 'resource.failedLinkUnreadableTitle',
    description: 'resource.failedLinkUnreadableDescription',
  },
  'flag-off': {
    title: 'resource.failedFlagOffTitle',
    description: 'resource.failedFlagOffDescription',
  },
  quota: {
    title: 'resource.failedQuotaTitle',
    description: 'resource.failedQuotaDescription',
  },
  blocked: {
    title: 'resource.failedBlockedTitle',
    description: 'resource.failedBlockedDescription',
  },
  model: {
    title: 'resource.failedModelTitle',
    description: 'resource.failedModelDescription',
  },
  internal: {
    title: 'resource.failedInternalTitle',
    description: 'resource.failedInternalDescription',
  },
} as const satisfies Record<
  ProfileResourceFailure,
  { title: string; description: string }
>;

const SURFACES = {
  plain: 'bg-surface shadow-card',
  warning: 'bg-warning-tint',
  danger: 'bg-danger-tint',
};
const TILES = {
  success: 'bg-success-tint text-success',
  warning: 'bg-surface text-warning',
  danger: 'bg-surface text-danger',
};

interface PanelProps {
  tone: keyof typeof SURFACES;
  lead: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

const Panel: React.FC<PanelProps> = ({
  tone,
  lead,
  title,
  description,
  action,
}) => (
  <div
    role="status"
    className={`flex flex-col gap-2.5 rounded-card p-4 ${SURFACES[tone]}`}>
    <div className="flex items-center gap-3">
      {lead}
      <h2 className="min-w-0 flex-1 font-display text-[17px] leading-tight font-semibold">
        {title}
      </h2>
    </div>
    <p
      className={`text-[15px] leading-normal ${tone === 'plain' ? 'text-muted' : ''}`}>
      {description}
    </p>
    {action && <div className="flex flex-wrap gap-2">{action}</div>}
  </div>
);

const Tile: React.FC<{ icon: IconName; tone: keyof typeof TILES }> = ({
  icon,
  tone,
}) => (
  <span
    aria-hidden="true"
    className={`flex size-10 flex-none items-center justify-center rounded-full ${TILES[tone]}`}>
    <Icon name={icon} size={18} />
  </span>
);

export interface ResourceStatusPanelProps {
  resource: Pick<ProfileResource, 'status' | 'failure' | 'itemCount'>;
  /** The backend has not finished with it for longer than it ever takes. */
  stuck: boolean;
  onRemove: () => void;
}

/**
 * What is going on with a resource, when that needs more than a chip: it is being read, it
 * is stuck, it was read and added nothing, or it failed and why. A resource is read once,
 * so every way out of a failure is "Remove". A resource that was read and added items has
 * no panel: its items say it.
 */
export const ResourceStatusPanel: React.FC<ResourceStatusPanelProps> = ({
  resource: { status, failure, itemCount },
  stuck,
  onRemove,
}) => {
  const { t } = useTranslation();
  const remove = (
    <Button variant="danger" size="small" onClick={onRemove} className="gap-2">
      <Icon name="trash" size={18} />
      {t('resource.removeButton')}
    </Button>
  );

  if (status === 'failed') {
    const { title, description } = FAILURES[failure ?? 'internal'];
    return (
      <Panel
        tone="danger"
        lead={<Tile icon="alert" tone="danger" />}
        title={t(title)}
        description={t(description, {
          max: PROFILE_DAILY_EXTRACTIONS,
          time: dailyLimitResetTime(),
        })}
        action={remove}
      />
    );
  }
  if (status === 'ready') {
    return itemCount > 0 ? null : (
      <Panel
        tone="plain"
        lead={<Tile icon="check" tone="success" />}
        title={t('resource.nothingNewTitle')}
        description={t('resource.nothingNewDescription')}
      />
    );
  }
  if (stuck) {
    return (
      <Panel
        tone="warning"
        lead={<Tile icon="clock" tone="warning" />}
        title={t('resource.stuckTitle')}
        description={t(
          status === 'awaitingUpload'
            ? 'resource.stuckUploadDescription'
            : 'resource.stuckReadingDescription',
        )}
        action={remove}
      />
    );
  }
  return (
    <Panel
      tone="plain"
      lead={
        <span className="flex text-primary">
          <Spinner size="medium" decorative />
        </span>
      }
      title={t('resource.readingTitle')}
      description={t('resource.readingDescription')}
    />
  );
};

export default ResourceStatusPanel;
