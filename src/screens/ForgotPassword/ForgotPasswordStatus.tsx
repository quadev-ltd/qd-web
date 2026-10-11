// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordStatus.tsx: what the
// card shows after the form is sent (sending, the neutral success message, or an error).
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import ErrorMessage from '@/components/SignIn/ErrorMessage';
import Spinner from '@/components/Spinner';
import Button from '@/components/ui/Button';

export interface ForgotPasswordStatusProps {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  errorMessage?: string;
  hideStatus: () => void;
}

export const ForgotPasswordStatus: React.FC<ForgotPasswordStatusProps> = ({
  isLoading,
  isSuccess,
  isError,
  errorMessage,
  hideStatus,
}) => {
  const { t } = useTranslation();
  const actionRef = useRef<HTMLButtonElement>(null);

  // The form (and the focused button) is gone: continue from the next action.
  useEffect(() => {
    if (!isLoading) {
      actionRef.current?.focus();
    }
  }, [isLoading]);

  return (
    <div className="flex flex-col gap-5">
      {isLoading && (
        <div
          role="status"
          className="flex items-center gap-3 text-[15px] leading-normal text-muted">
          <Spinner size="small" />
          <span>{t('forgotPassword.sending')}</span>
        </div>
      )}
      {isSuccess && (
        <>
          <p
            role="status"
            className="text-[15px] leading-normal whitespace-pre-line">
            {t('forgotPassword.success')}
          </p>
          <Button ref={actionRef} onClick={hideStatus} className="w-full">
            {t('forgotPassword.repeat')}
          </Button>
        </>
      )}
      {isError && (
        <>
          <ErrorMessage text={errorMessage || t('forgotPassword.error')} />
          <Button ref={actionRef} onClick={hideStatus} className="w-full">
            {t('forgotPassword.tryAgain')}
          </Button>
        </>
      )}
    </div>
  );
};

export default ForgotPasswordStatus;
