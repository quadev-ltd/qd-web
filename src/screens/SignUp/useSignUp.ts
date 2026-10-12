// Mirrors qd-mobile src/screens/SignUp/useSignUp.ts: the same normalisation, the same profile
// (ISO date of birth, left out when empty) and the same error-to-field mapping. Errors that
// the app shows as a toast are returned as `errorMessage`, which the form shows in the page.
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
import { displayDateToIso } from '@/core/auth/profile';
import { SignUpFields, type SignUpSchemaType } from '@/schemas/signUpSchema';

const EMAIL_ERRORS: string[] = [
  AuthErrorCode.EmailAlreadyInUse,
  AuthErrorCode.InvalidEmail,
];
const PASSWORD_ERRORS: string[] = [
  AuthErrorCode.PasswordDoesNotMeetRequirements,
  AuthErrorCode.WeakPassword,
];

/**
 * Creates the account and its profile. On success there is nothing to do here: the session
 * moves on by itself, and the route guard leads to the verify-email screen as soon as the
 * account exists (so `isLoading` stays on until the form is gone).
 */
export const useSignUp = (setError: UseFormSetError<SignUpSchemaType>) => {
  const { t } = useTranslation();
  const gateway = useAuthGateway();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const signUp = async (formData: SignUpSchemaType) => {
    setIsLoading(true);
    setErrorMessage(undefined);
    const dateOfBirth = formData[SignUpFields.dob]?.trim();
    try {
      await gateway.signUpWithEmail(
        formData[SignUpFields.email].trim().toLowerCase(),
        formData[SignUpFields.password],
        {
          firstName: formData[SignUpFields.firstName].trim(),
          lastName: formData[SignUpFields.lastName].trim(),
          ...(dateOfBirth
            ? { dateOfBirth: displayDateToIso(dateOfBirth) }
            : {}),
        },
      );
    } catch (error) {
      logAuthError('signUp', error);
      setIsLoading(false);
      const code = getErrorCode(error) ?? '';
      const message = t(getErrorMessageKey(error));
      if (EMAIL_ERRORS.includes(code)) {
        setError(
          SignUpFields.email,
          { type: 'manual', message },
          { shouldFocus: true },
        );
      } else if (PASSWORD_ERRORS.includes(code)) {
        setError(
          SignUpFields.password,
          { type: 'manual', message },
          { shouldFocus: true },
        );
      } else {
        setErrorMessage(message);
      }
    }
  };

  return { signUp, isLoading, errorMessage };
};
