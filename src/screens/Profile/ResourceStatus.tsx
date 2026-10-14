import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import {
  type ProfileResource,
  type ProfileResourceFailure,
} from '@/core/profile/contract';

/** A few words for why a resource was not read, for a line of the list. */
const FAILURE_KEYS = {
  'unsupported-file': 'profile.failedUnsupportedFile',
  empty: 'profile.failedEmpty',
  'too-long': 'profile.failedTooLong',
  'too-large': 'profile.failedTooLarge',
  'link-unreadable': 'profile.failedLinkUnreadable',
  'flag-off': 'profile.failedFlagOff',
  quota: 'profile.failedQuota',
  blocked: 'profile.failedBlocked',
  model: 'profile.failedModel',
  internal: 'profile.failedInternal',
} as const satisfies Record<ProfileResourceFailure, string>;

const LINE = 'flex items-center gap-1.5 text-sm leading-normal';

/**
 * Where a resource is, in one line: waiting for its file, being read, read (with how many
 * items it added) or not read (with why). The line is a live region: when the
 * backend finishes while the page is open, a screen reader says the new state.
 */
export const ResourceStatus: React.FC<{
  resource: Pick<ProfileResource, 'status' | 'failure' | 'itemCount'>;
}> = ({ resource: { status, failure, itemCount } }) => {
  const { t } = useTranslation();

  if (status === 'ready') {
    return (
      <span aria-live="polite" className={`${LINE} font-medium text-success`}>
        <Icon name="check" size={16} />
        {itemCount > 0
          ? t('profile.statusReady', { count: itemCount })
          : t('profile.statusReadyNothingNew')}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span aria-live="polite" className={`${LINE} font-medium text-danger`}>
        <Icon name="alert" size={16} />
        {t(FAILURE_KEYS[failure ?? 'internal'])}
      </span>
    );
  }
  return (
    <span aria-live="polite" className={`${LINE} gap-2 text-muted`}>
      <span className="flex text-primary">
        <Spinner size="tiny" decorative />
      </span>
      {t(
        status === 'processing'
          ? 'profile.statusProcessing'
          : 'profile.statusAwaitingUpload',
      )}
    </span>
  );
};

export default ResourceStatus;
