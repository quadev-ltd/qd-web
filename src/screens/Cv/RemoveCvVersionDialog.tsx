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
import { cvVersionRemoved } from '@/core/state/slices/cvVersionsSlice';

export interface RemoveCvVersionDialogProps {
  versionId: string;
  /** The day of the version, as its title says it. */
  date: string;
  onCancel: () => void;
  /** The version is gone, from the backend and from the list. */
  onRemoved: () => void;
}

/**
 * "Remove this version?" (C3): asked first, as for an application. Nothing else changes, and
 * the dialog cannot be left while the backend is at it.
 */
export const RemoveCvVersionDialog: React.FC<RemoveCvVersionDialogProps> = ({
  versionId,
  date,
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
      await gateway.removeCvVersion(versionId);
    } catch (reason) {
      // Already gone (in another tab) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeCvVersion', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    dispatch(cvVersionRemoved(versionId));
    onRemoved();
  };

  return (
    <Dialog
      title={t('cv.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {t('cv.removeDialogText', { date })}
      </p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('cv.removeFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          disabled={isRemoving}
          aria-busy={isRemoving}
          onClick={remove}
          className="flex-[1_1_200px] gap-2">
          {isRemoving ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="trash" size={18} />
          )}
          {isRemoving ? t('cv.removingButton') : t('cv.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('cv.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveCvVersionDialog;
