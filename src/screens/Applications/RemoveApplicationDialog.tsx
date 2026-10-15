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
import { applicationRemoved } from '@/core/state/slices/applicationsSlice';

export interface RemoveApplicationDialogProps {
  applicationId: string;
  onCancel: () => void;
  /** The application is gone, from the backend and from the list. */
  onRemoved: () => void;
}

/**
 * "Remove this application?": asked first, as for a resource. Removing cannot be undone, so
 * the dialog cannot be left while the backend is at it.
 */
export const RemoveApplicationDialog: React.FC<
  RemoveApplicationDialogProps
> = ({ applicationId, onCancel, onRemoved }) => {
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
      await gateway.removeApplication(applicationId);
    } catch (reason) {
      // Already gone (in another tab, or from the app) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeApplication', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    dispatch(applicationRemoved(applicationId));
    onRemoved();
  };

  return (
    <Dialog
      title={t('applications.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {t('applications.removeDialogText')}
      </p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('applications.removeFailedMessage')}
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
            ? t('applications.removingButton')
            : t('applications.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('applications.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveApplicationDialog;
