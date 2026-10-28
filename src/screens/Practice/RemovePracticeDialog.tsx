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
import { usePractice } from '@/core/profile/usePractice';
import { useSessionUser } from '@/core/session/hooks';

export interface RemovePracticeDialogProps {
  turnId: string;
  onCancel: () => void;
  /** The practice is gone. */
  onRemoved: () => void;
}

/**
 * "Remove this practice?" (X7): asked first, as for an interview. The dialog cannot be left while
 * the backend is at it.
 */
export const RemovePracticeDialog: React.FC<RemovePracticeDialogProps> = ({
  turnId,
  onCancel,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const { remove } = usePractice();
  const [isRemoving, setIsRemoving] = useState(false);
  const [failed, setFailed] = useState(false);
  const error = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (failed) {
      error.current?.focus();
    }
  }, [failed]);

  const confirm = async () => {
    setIsRemoving(true);
    setFailed(false);
    try {
      await remove(turnId);
    } catch (reason) {
      // Already gone (in another tab, or 12 months old) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removePracticeTurn', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    onRemoved();
  };

  return (
    <Dialog
      title={t('practice.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {t('practice.removeDialogText')}
      </p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('practice.removeFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          disabled={isRemoving}
          aria-busy={isRemoving}
          onClick={confirm}
          className="flex-[1_1_200px] gap-2">
          {isRemoving ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="trash" size={18} />
          )}
          {isRemoving
            ? t('practice.removingButton')
            : t('practice.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('practice.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemovePracticeDialog;
