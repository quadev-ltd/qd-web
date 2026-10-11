// Mirrors qd-mobile src/screens/ForgotPassword/useForgotPassword.ts.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import {
  AuthErrorCode,
  getErrorCode,
  getErrorMessageKey,
  logAuthError,
} from '@/core/auth/errors';
import {
  ForgotPasswordFields,
  type ForgotPasswordSchemaType,
} from '@/schemas/forgotPasswordSchema';

/**
 * Asks for the password reset email; the reset itself happens on the page the email links to.
 * Success is always the same neutral message: with email enumeration protection the site
 * cannot (and must not) tell whether an account exists.
 */
export const useForgotPassword = () => {
  const { t } = useTranslation();
  const gateway = useAuthGateway();
  const [showStatus, setShowStatus] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const requestPasswordReset = async (formData: ForgotPasswordSchemaType) => {
    setShowStatus(true);
    setIsLoading(true);
    setIsSuccess(false);
    setErrorMessage(undefined);
    try {
      await gateway.sendPasswordReset(
        formData[ForgotPasswordFields.email].trim().toLowerCase(),
      );
      setIsSuccess(true);
    } catch (error) {
      if (getErrorCode(error) === AuthErrorCode.UserNotFound) {
        // Only without enumeration protection (e.g. the emulator): still say nothing.
        setIsSuccess(true);
      } else {
        logAuthError('sendPasswordReset', error);
        setErrorMessage(t(getErrorMessageKey(error)));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    showStatus,
    setShowStatus,
    forgotPassword: requestPasswordReset,
    isLoading,
    isError: Boolean(errorMessage),
    isSuccess,
    errorMessage,
  };
};
