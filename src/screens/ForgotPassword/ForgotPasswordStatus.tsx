// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordStatus.tsx: what the
// card shows after the form was sent (the neutral success message, or an error). While the
// email is being sent the form stays in place (ForgotPasswordForm), so there is no
// "sending" state here as there is in the app.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, type To } from 'react-router';

import ErrorMessage from '@/components/SignIn/ErrorMessage';
import StatusIcon from '@/components/StatusIcon';
import Button from '@/components/ui/Button';

export interface ForgotPasswordStatusProps {
  isSuccess: boolean;
  isError: boolean;
  errorMessage?: string;
  hideStatus: () => void;
  /** Where "Back to …" under the success message leads, and what it says. */
  backPath: To;
  backLabel: string;
}

export const ForgotPasswordStatus: React.FC<ForgotPasswordStatusProps> = ({
  isSuccess,
  isError,
  errorMessage,
  hideStatus,
  backPath,
  backLabel,
}) => {
  const { t } = useTranslation();
  const actionRef = useRef<HTMLButtonElement>(null);
  // One text in the app, with an empty line in the middle: two paragraphs here.
  const [summary, ...details] = t('forgotPassword.success').split('\n\n');

  // The form (and the focused button) is gone: continue from the next action.
  useEffect(() => {
    actionRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col gap-5">
      {isSuccess && (
        <>
          <div
            role="status"
            className="flex flex-col items-center gap-3.5 text-center text-base leading-[1.55]">
            <StatusIcon icon="check" />
            <p>{summary}</p>
            {details.map(paragraph => (
              <p key={paragraph} className="text-muted">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <Button
              ref={actionRef}
              variant="secondary"
              onClick={hideStatus}
              className="w-full">
              {t('forgotPassword.repeat')}
            </Button>
            <Link
              to={backPath}
              className="flex h-11 items-center self-center text-[15px] leading-natural font-bold no-underline hover:underline">
              {backLabel}
            </Link>
          </div>
        </>
      )}
      {isError && (
        <>
          <div className="flex justify-center">
            <StatusIcon icon="error" tone="danger" />
          </div>
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
