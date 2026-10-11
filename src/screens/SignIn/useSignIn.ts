// Mirrors qd-mobile src/screens/SignIn/useSignIn.ts: the same normalisation of the email and
// the same error-to-field mapping. Errors that the app shows as a toast are returned as
// `errorMessage`, which the form shows in the page.
import { useState } from 'react';
import { type UseFormSetError } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import {
  AuthErrorCode,
  getErrorCode,
  getErrorMessageKey,
  logAuthError,
} from '@/core/auth/errors';
import { SignInFields, type SignInSchemaType } from '@/schemas/signInSchema';

// With email enumeration protection, a wrong email and a wrong password both give
// auth/invalid-credential; the older codes are kept for the emulator and older projects.
const CREDENTIAL_ERRORS: string[] = [
  AuthErrorCode.InvalidCredential,
  AuthErrorCode.WrongPassword,
  AuthErrorCode.UserNotFound,
  AuthErrorCode.InvalidEmail,
];

/**
 * Signs in with email and password. On success there is nothing to do here: the session
 * becomes ready and the route guard opens the signed-in home.
 */
export const useSignIn = (setError: UseFormSetError<SignInSchemaType>) => {
  const { t } = useTranslation();
  const gateway = useAuthGateway();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const signIn = async (formData: SignInSchemaType) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    try {
      await gateway.signInWithEmail(
        formData[SignInFields.email].trim().toLowerCase(),
        formData[SignInFields.password],
      );
    } catch (error) {
      logAuthError('signIn', error);
      setIsLoading(false);
      const message = t(getErrorMessageKey(error));
      if (CREDENTIAL_ERRORS.includes(getErrorCode(error) ?? '')) {
        setError(
          SignInFields.email,
          { type: 'manual', message },
          { shouldFocus: true },
        );
      } else {
        setErrorMessage(message);
      }
    }
  };

  return { signIn, isLoading, errorMessage };
};
