import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
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
import { practiceChanged } from '@/core/state/slices/practiceSlice';

export interface RemoveApplicationDialogProps {
  applicationId: string;
  onCancel: () => void;
  /** The application is gone, from the backend and from the list. */
  onRemoved: () => void;
}

/**
 * "Remove this application?": asked first, as for a resource. Removing cannot be undone, so
 * the dialog cannot be left while the backend is at it. With practice kept for it (D94), "Also
 * remove its practice (N questions)", unticked: otherwise it stays in Sessions (D99). The count is
 * read when the dialog opens; one that can't be read leaves the box out, and the practice stays.
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
  const [practice, setPractice] = useState<number | null>(null);
  const [removePractice, setRemovePractice] = useState(false);
  const error = useRef<HTMLDivElement>(null);
  const hintId = useId();

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.countApplicationPractice(uid, applicationId).then(
      count => live && setPractice(count),
      reason => {
        logProfileError('countApplicationPractice', reason, uid);
        if (live) {
          setPractice(0);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [applicationId, gateway, uid]);

  useEffect(() => {
    if (failed) {
      error.current?.focus();
    }
  }, [failed]);

  const remove = async () => {
    setIsRemoving(true);
    setFailed(false);
    try {
      await (removePractice
        ? gateway.removeApplication(applicationId, { removePractice: true })
        : gateway.removeApplication(applicationId));
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
    dispatch(practiceChanged());
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
      {practice !== null && practice > 0 && (
        <div className="flex flex-col gap-1 rounded-[14px] bg-background px-3.5 py-2.5">
          <Checkbox
            checked={removePractice}
            onChange={event => setRemovePractice(event.target.checked)}
            disabled={isRemoving}
            aria-describedby={hintId}>
            {t('applications.removePracticeLabel', { count: practice })}
          </Checkbox>
          <p
            id={hintId}
            className="pl-[34px] text-sm leading-normal text-muted">
            {t('applications.removePracticeHint')}
          </p>
        </div>
      )}
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('applications.removeFailedMessage')}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="danger"
          // Until the practice is counted, the candidate can't be asked about it.
          disabled={isRemoving || practice === null}
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
