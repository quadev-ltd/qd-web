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
import { useInterviews } from '@/core/profile/useInterviews';
import { useSessionUser } from '@/core/session/hooks';

export interface RemoveInterviewDialogProps {
  applicationId: string;
  interviewId: string;
  /** "Technical interview, Wednesday 28 Oct at 14:00. You can add it again later." */
  description: string;
  onCancel: () => void;
  /** The interview is gone, from the backend and from the list. */
  onRemoved: () => void;
}

/**
 * "Remove this interview?" (A8): asked first, as for an application. The dialog cannot be left
 * while the backend is at it.
 */
export const RemoveInterviewDialog: React.FC<RemoveInterviewDialogProps> = ({
  applicationId,
  interviewId,
  description,
  onCancel,
  onRemoved,
}) => {
  const { t } = useTranslation();
  const gateway = useProfileGateway();
  const { removed } = useInterviews(applicationId);
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
      await gateway.removeInterview(applicationId, interviewId);
    } catch (reason) {
      // Already gone (in another tab) is what was asked for.
      if (getProfileErrorCode(reason) !== ProfileErrorCode.NotFound) {
        logProfileError('removeInterview', reason, uid);
        setFailed(true);
        setIsRemoving(false);
        return;
      }
    }
    await removed(interviewId);
    onRemoved();
  };

  return (
    <Dialog
      title={t('interviews.removeDialogTitle')}
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
          {t('interviews.removeFailedMessage')}
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
            ? t('interviews.removingButton')
            : t('interviews.removeConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('interviews.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveInterviewDialog;
