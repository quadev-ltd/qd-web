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
import { useCoverLetters } from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';

export interface RemoveLetterDialogProps {
  applicationId: string;
  letterId: string;
  /** "The letter of 27 Oct 2026 is removed. …" */
  description: string;
  onCancel: () => void;
  onRemoved: () => void;
}

/**
 * "Remove this letter?" (D98): asked first, as for a CV version. The dialog cannot be left while
 * the backend is at it.
 */
export const RemoveLetterDialog: React.FC<RemoveLetterDialogProps> = ({
  applicationId,
  letterId,
  description,
  onCancel,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const { remove } = useCoverLetters(applicationId);
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
      await remove(letterId);
    } catch (reason) {
      // Already gone (in another tab) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeCoverLetter', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    onRemoved();
  };

  return (
    <Dialog
      title={t('letters.removeDialogTitle')}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">{description}</p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('letters.removeFailedMessage')}
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
            ? t('letters.removingButton')
            : t('letters.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('letters.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveLetterDialog;
