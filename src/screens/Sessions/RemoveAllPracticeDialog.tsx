import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { logProfileError } from '@/core/profile/errors';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch } from '@/core/state/hooks';
import { practiceChanged } from '@/core/state/slices/practiceSlice';

export interface RemoveAllPracticeDialogProps {
  applicationId: string;
  /** The job's name, as Sessions shows it. */
  title: string;
  company?: string;
  questions: number;
  onCancel: () => void;
  onRemoved: () => void;
}

/**
 * "Remove all practice for Data Engineer?" (R1, D99): every practice of a removed application,
 * asked first. The dialog cannot be left while the backend is at it.
 */
export const RemoveAllPracticeDialog: React.FC<
  RemoveAllPracticeDialogProps
> = ({ applicationId, title, company, questions, onCancel, onRemoved }) => {
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
      await gateway.removeApplicationPractice(applicationId);
    } catch (reason) {
      logProfileError('removeApplicationPractice', reason, uid);
      setFailed(true);
      setIsRemoving(false);
      return;
    }
    dispatch(practiceChanged());
    onRemoved();
  };

  return (
    <Dialog
      title={t('sessions.removeAllTitle', { title })}
      icon="trash"
      tone="danger"
      onClose={() => {
        if (!isRemoving) {
          onCancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {company
          ? t('sessions.removeAllText', { count: questions, company })
          : t('sessions.removeAllTextNoCompany', { count: questions })}
      </p>
      {failed && (
        <Banner ref={error} tone="danger" role="alert">
          {t('sessions.removeFailedMessage')}
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
          {isRemoving
            ? t('sessions.removingButton')
            : t('sessions.removeAllConfirm')}
        </Button>
        <Button
          variant="secondary"
          disabled={isRemoving}
          onClick={onCancel}
          className="flex-[1_1_120px]">
          {t('sessions.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default RemoveAllPracticeDialog;
