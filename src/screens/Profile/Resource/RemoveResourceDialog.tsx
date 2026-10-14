import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch } from '@/core/state/hooks';
import { resourceRemoved } from '@/core/state/slices/interviewProfileSlice';

export interface RemoveResourceDialogProps {
  resourceId: string;
  /** How many items were read from the resource, and go with it. */
  itemCount: number;
  onCancel: () => void;
  /** The resource is gone, from the backend and from the list. */
  onRemoved: () => void;
}

/**
 * "Remove this resource?": says what goes with it before anything is removed. Removing
 * cannot be undone, so the dialog cannot be left while the backend is at it.
 */
export const RemoveResourceDialog: React.FC<RemoveResourceDialogProps> = ({
  resourceId,
  itemCount,
  onCancel,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid;
  const [isRemoving, setIsRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const error = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failed) {
      error.current?.focus();
    }
  }, [failed]);

  const remove = async () => {
    setIsRemoving(true);
    setFailed(false);
    try {
      await gateway.removeResource(resourceId);
    } catch (reason) {
      // Already gone (removed from the app, or in another tab) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeResource', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    dispatch(resourceRemoved(resourceId));
    onRemoved();
  };

  return (
    <Dialog
      title={t('resource.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {itemCount === 0
          ? t('resource.removeDialogNoItems')
          : `${t('resource.removeDialogItems', { count: itemCount })} ${t(
              'resource.removeDialogBriefs',
              { count: itemCount },
            )}`}
      </p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('resource.removeFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          disabled={isRemoving}
          aria-busy={isRemoving}
          onClick={remove}
          className="flex-[1_1_240px] gap-2">
          {isRemoving ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="trash" size={18} />
          )}
          {isRemoving
            ? t('resource.removingButton')
            : itemCount === 0
              ? t('resource.removeConfirmButton')
              : t('resource.removeConfirmItemsButton', { count: itemCount })}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('resource.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveResourceDialog;
