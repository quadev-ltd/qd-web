// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordScreen.tsx. There is
// no artboard for it: it uses the sign-in card. On the web a signed-in user can open it too
// ("Change password" on the signed-in home).
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import ForgotPasswordForm from './ForgotPasswordForm';

import { FooterPrompt } from '@/components/SignIn/FooterPrompt';
import { Layout } from '@/components/SignIn/Layout';
import LegalNav from '@/components/SignIn/LegalNav';
import { ScreenType } from '@/components/SignIn/types';
import { useSessionStatus } from '@/core/session/hooks';
import { SessionStatus } from '@/core/state/slices/sessionSlice';

/** The email typed on the sign-in screen, carried over by the "Forgot password?" link. */
const emailFromState = (state: unknown): string => {
  const email = (state as { email?: unknown } | null)?.email;
  return typeof email === 'string' ? email : '';
};

export const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  // A signed-in user comes here from "Change password" on their home.
  const isSignedIn = useSessionStatus() === SessionStatus.Ready;

  return (
    <Layout
      showLogo
      documentTitle={t('forgotPassword.documentTitle')}
      title={t('forgotPassword.title')}
      headerActions={<LegalNav />}>
      <ForgotPasswordForm
        emailLabel={t('forgotPassword.emailLabel')}
        emailPlaceholder={t('forgotPassword.emailPlaceholder')}
        submitLabel={t('forgotPassword.submitButton')}
        defaultEmail={emailFromState(location.state)}
      />
      <Link
        to={isSignedIn ? '/home' : '/sign-in'}
        className="self-center text-[15px] leading-natural font-bold no-underline hover:underline">
        {isSignedIn
          ? t('forgotPassword.backToHomeLink')
          : t('forgotPassword.backToSignInLink')}
      </Link>
      {!isSignedIn && (
        <FooterPrompt
          changePath="/sign-up"
          screen={ScreenType.ForgotPassword}
        />
      )}
    </Layout>
  );
};

export default ForgotPasswordScreen;
