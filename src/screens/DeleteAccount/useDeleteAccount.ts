// Mirrors qd-mobile src/screens/DeleteAccount/useDeleteAccount.ts. The app shows a toast
// after the account is gone; the website says it on the public home (the `exit` slice).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import {
  AuthErrorCode,
  getErrorCode,
  getErrorMessageKey,
  isPopupCancellation,
  logAuthError,
  SIGN_IN_CANCELLED,
} from '@/core/auth/errors';
import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch } from '@/core/state/hooks';
import { accountDeleted } from '@/core/state/slices/exitSlice';

/**
 * Delete account: how the user proves who they are depends on the provider (see
 * `deleteAccount` in the auth gateway). A password user is asked for the password only when
 * the backend requires a recent sign-in; a Google user confirms in a Google window. On
 * success the backend signs the user out and the route guard leaves for the public home.
 */
export const useDeleteAccount = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const gateway = useAuthGateway();
  const user = useSessionUser();
  const reauthMethod = user ? gateway.getReauthMethod(user) : null;
  const [isDeleting, setIsDeleting] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleDeleteAccount = async (password?: string) => {
    setIsDeleting(true);
    setErrorMessage(undefined);
    try {
      // Called at once, before any wait: a Google window may only open from the click itself.
      await gateway.deleteAccount(password ? { password } : {});
    } catch (error) {
      setIsDeleting(false);
      const code = getErrorCode(error);
      // The user closed the Google window: nothing happened, nothing to say.
      if (code === SIGN_IN_CANCELLED || isPopupCancellation(error)) {
        return;
      }
      if (
        code === AuthErrorCode.RequiresRecentLogin &&
        reauthMethod === 'password' &&
        !needsPassword
      ) {
        setNeedsPassword(true);
        return;
      }
      logAuthError('deleteAccount', error, user?.uid);
      setErrorMessage(t(getErrorMessageKey(error)));
      return;
    }
    dispatch(accountDeleted());
  };

  return {
    handleDeleteAccount,
    reauthMethod,
    isDeleting,
    needsPassword,
    errorMessage,
  };
};
