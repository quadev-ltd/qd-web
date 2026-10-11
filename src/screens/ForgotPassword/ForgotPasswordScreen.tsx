// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordScreen.tsx. There is
// no artboard for it: it uses the sign-in card.
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router';

import ForgotPasswordForm from './ForgotPasswordForm';

import { FooterPrompt } from '@/components/SignIn/FooterPrompt';
import { Layout } from '@/components/SignIn/Layout';
import LegalNav from '@/components/SignIn/LegalNav';
import { ScreenType } from '@/components/SignIn/types';

/** The email typed on the sign-in screen, carried over by the "Forgot password?" link. */
const emailFromState = (state: unknown): string => {
  const email = (state as { email?: unknown } | null)?.email;
  return typeof email === 'string' ? email : '';
};

export const ForgotPasswordScreen: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();

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
        to="/sign-in"
        className="self-center text-[15px] leading-natural font-bold no-underline hover:underline">
        {t('forgotPassword.backToSignInLink')}
      </Link>
      <FooterPrompt changePath="/sign-up" screen={ScreenType.ForgotPassword} />
    </Layout>
  );
};

export default ForgotPasswordScreen;
