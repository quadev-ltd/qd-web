// Mirrors qd-mobile src/screens/VerifyEmail/useVerifyEmail.ts: the same states and the same
// session actions (the app keeps the key of an error; here it is the translated message, as
// in the other web hooks). The app checks again when it returns to the foreground; the website
// checks again when its tab becomes visible. Web only so far: a new account starts with the
// wait before "resend" already running.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import {
  AuthErrorCode,
  getErrorCode,
  getErrorMessageKey,
  logAuthError,
} from '@/core/auth/errors';
import { SIGN_IN_PATH } from '@/core/auth/paths';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectSessionUser } from '@/core/state/selectors/session';
import { signedOutPathChosen } from '@/core/state/slices/exitSlice';
import {
  authStateChanged,
  claimsChanged,
} from '@/core/state/slices/sessionSlice';

export const RESEND_COOLDOWN_SECONDS = 60;

export type ResendStatus = 'idle' | 'sending' | 'sent' | 'error';

/**
 * Signing up sends the first email, and the backend refuses another one within about a minute.
 * So a new account starts with the wait running: the seconds left of it, counted from the
 * creation of the account (0 for an older account, or when the gateway gives no date).
 */
export const waitLeftAfterSignUp = (
  createdAt: number | undefined,
  now: number,
): number => {
  if (createdAt === undefined) {
    return 0;
  }
  const secondsLeft = Math.ceil(
    (createdAt + RESEND_COOLDOWN_SECONDS * 1000 - now) / 1000,
  );
  // Never longer than a full wait, whatever the clock of this device says.
  return Math.max(0, Math.min(RESEND_COOLDOWN_SECONDS, secondsLeft));
};

/**
 * VerifyEmail logic. The link in the email opens the page that confirms the address; back
 * here the user presses "I've verified my email" (or simply returns to this tab) and
 * `refreshUser` picks up the change. The session then moves on by itself.
 */
export const useVerifyEmail = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const gateway = useAuthGateway();
  const [isChecking, setIsChecking] = useState(false);
  const [notVerifiedYet, setNotVerifiedYet] = useState(false);
  const [resendStatus, setResendStatus] = useState<ResendStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createdAt = useAppSelector(selectSessionUser)?.createdAt;
  const [firstWait] = useState(() => {
    const now = Date.now();
    const seconds = waitLeftAfterSignUp(createdAt, now);
    return { seconds, endsAt: now + seconds * 1000 };
  });
  const [cooldown, setCooldown] = useState(firstWait.seconds);
  // The wait is measured against the clock, so it stays right while the browser slows the
  // timers of a tab in the background.
  const cooldownEndsAt = useRef(firstWait.endsAt);

  const startCooldown = () => {
    cooldownEndsAt.current = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    setCooldown(RESEND_COOLDOWN_SECONDS);
  };

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => {
      const secondsLeft = Math.round(
        (cooldownEndsAt.current - Date.now()) / 1000,
      );
      setCooldown(Math.max(0, Math.min(secondsLeft, cooldown - 1)));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const checkVerification = useCallback(
    async (manual: boolean) => {
      if (manual) {
        setIsChecking(true);
        setErrorMessage(undefined);
        setNotVerifiedYet(false);
      }
      try {
        const user = await gateway.refreshUser();
        if (user) {
          // No auth-state event follows a refresh: the session is told here.
          dispatch(authStateChanged(user));
          if (user.emailVerified) {
            gateway
              .getClaims()
              .then(claims => dispatch(claimsChanged(claims)))
              .catch(error => logAuthError('getClaims', error, user.uid));
          } else if (manual) {
            setNotVerifiedYet(true);
          }
        }
      } catch (error) {
        logAuthError('refreshUser', error);
        if (manual) {
          setErrorMessage(t(getErrorMessageKey(error)));
        }
      } finally {
        if (manual) {
          setIsChecking(false);
        }
      }
    },
    [dispatch, gateway, t],
  );

  // Coming back from the mail or from the tab that confirmed the address: check without asking.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkVerification(false);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [checkVerification]);

  const resendEmail = async () => {
    if (cooldown > 0 || resendStatus === 'sending') {
      return;
    }
    setResendStatus('sending');
    setErrorMessage(undefined);
    setNotVerifiedYet(false);
    try {
      await gateway.sendVerificationEmail();
      setResendStatus('sent');
      startCooldown();
    } catch (error) {
      logAuthError('sendVerificationEmail', error);
      setResendStatus('error');
      setErrorMessage(t(getErrorMessageKey(error)));
      if (getErrorCode(error) === AuthErrorCode.TooManyRequests) {
        startCooldown();
      }
    }
  };

  /** "Use another account": signs out and leads to the sign-in screen, not the public home. */
  const switchAccount = async () => {
    dispatch(signedOutPathChosen(SIGN_IN_PATH));
    try {
      await gateway.signOut();
    } catch (error) {
      logAuthError('signOut', error);
      dispatch(signedOutPathChosen(null));
    }
  };

  return {
    isChecking,
    notVerifiedYet,
    resendStatus,
    errorMessage,
    cooldown,
    checkVerification: () => checkVerification(true),
    resendEmail,
    switchAccount,
  };
};
