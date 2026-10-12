// The web version of qd-mobile src/screens/VerifyEmail/VerifyEmailScreen.tsx: the same
// texts, states and actions. Added for the web: the email and "Sign out" in the header.
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type ResendStatus, useVerifyEmail } from './useVerifyEmail';

import ErrorMessage from '@/components/SignIn/ErrorMessage';
import { FooterPrompt } from '@/components/SignIn/FooterPrompt';
import { Layout } from '@/components/SignIn/Layout';
import SignedInActions from '@/components/SignIn/SignedInActions';
import { ScreenType } from '@/components/SignIn/types';
import Spinner from '@/components/Spinner';
import StatusIcon, { type StatusIconName } from '@/components/StatusIcon';
import Button from '@/components/ui/Button';
import { useProfile, useSessionUser } from '@/core/session/hooks';

// The app shows a different animation for each of these; the website a different icon.
const iconFor = (
  isChecking: boolean,
  resendStatus: ResendStatus,
): StatusIconName => {
  if (isChecking || resendStatus === 'sending') return 'busy';
  if (resendStatus === 'sent') return 'check';
  if (resendStatus === 'error') return 'error';
  return 'mail';
};

/** Stands for the email in the translated sentence, to put the real one in bold. */
const EMAIL_SLOT = '{email}';

const PARAGRAPH = 'text-base leading-[1.55] text-muted';

export const VerifyEmailScreen: React.FC = () => {
  const { t } = useTranslation();
  const user = useSessionUser();
  const profile = useProfile();
  const {
    isChecking,
    notVerifiedYet,
    resendStatus,
    errorMessage,
    cooldown,
    checkVerification,
    resendEmail,
    switchAccount,
  } = useVerifyEmail();
  const errorRef = useRef<HTMLParagraphElement>(null);

  const firstName = profile?.firstName ? ` ${profile.firstName}` : '';
  const title = `${t('emailVerification.title')} ${t(
    'brand.applicationName',
  )}${firstName}!`;
  const email = user?.email ?? '';
  const [beforeEmail, afterEmail = ''] = t('emailVerification.emailSent', {
    email: EMAIL_SLOT,
  }).split(EMAIL_SLOT);
  const isSending = resendStatus === 'sending';
  const isBusy = isChecking || isSending;
  const resendLabel =
    cooldown > 0
      ? t('emailVerification.resendCooldown', { seconds: cooldown })
      : t('emailVerification.resendCTA');
  const error = notVerifiedYet
    ? t('emailVerification.notVerifiedYet')
    : errorMessage;

  // The message appears above the buttons: the focus moves to it, and Tab goes on from there.
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  return (
    <Layout
      width="medium"
      centered
      documentTitle={t('emailVerification.documentTitle')}
      title={title}
      icon={
        <StatusIcon
          icon={iconFor(isChecking, resendStatus)}
          tone={resendStatus === 'error' && !isBusy ? 'danger' : 'brand'}
        />
      }
      subtitle={
        <>
          <p className={PARAGRAPH}>
            {beforeEmail}
            <strong className="font-bold wrap-anywhere text-text">
              {email}
            </strong>
            {afterEmail}
          </p>
          <p className={PARAGRAPH}>
            {t('emailVerification.emailVerificationInstructions')}
          </p>
        </>
      }
      headerActions={<SignedInActions />}>
      {error && <ErrorMessage ref={errorRef} text={error} />}
      {/* Says that the link was sent again; the countdown on the button is not read out. */}
      <p role="status" className="sr-only">
        {resendStatus === 'sent' && t('emailVerification.emailSent', { email })}
      </p>
      <div className="flex flex-col gap-3">
        <Button
          disabled={isBusy}
          aria-busy={isChecking}
          onClick={checkVerification}
          className="w-full gap-2.5">
          {isChecking && <Spinner size="small" decorative />}
          {t('emailVerification.verifiedCTA')}
        </Button>
        <Button
          variant="secondary"
          disabled={isBusy || cooldown > 0}
          aria-busy={isSending}
          onClick={resendEmail}
          className="w-full gap-2.5">
          {isSending && <Spinner size="small" decorative />}
          {resendLabel}
        </Button>
      </div>
      <FooterPrompt
        changePath={switchAccount}
        screen={ScreenType.EmailVerification}
      />
    </Layout>
  );
};

export default VerifyEmailScreen;
