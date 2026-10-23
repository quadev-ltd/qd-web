// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordScreen.tsx. On the
// web a signed-in user can open it too ("Change password" on the signed-in home): the way
// back then leads to their home, and there is no sign-up prompt.
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import ForgotPasswordForm from './ForgotPasswordForm';

import { FooterPrompt } from '@/components/SignIn/FooterPrompt';
import { Layout } from '@/components/SignIn/Layout';
import { ScreenType } from '@/components/SignIn/types';
import ButtonLink from '@/components/ui/ButtonLink';
import { ACCOUNT_PATH, SIGN_IN_PATH } from '@/core/auth/paths';
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
  // A signed-in user comes here from "Change password" on their account page.
  const isSignedIn = useSessionStatus() === SessionStatus.Ready;
  const backPath = isSignedIn ? ACCOUNT_PATH : SIGN_IN_PATH;

  return (
    <Layout
      documentTitle={t('forgotPassword.documentTitle')}
      title={t('forgotPassword.title')}
      headerActions={
        <div className="flex items-center gap-3 text-[15px] leading-natural">
          {!isSignedIn && (
            <span className="max-[720px]:hidden">
              {t('forgotPassword.rememberedPrompt')}
            </span>
          )}
          <ButtonLink to={backPath} variant="outline" size="small">
            {isSignedIn
              ? t('forgotPassword.backToHomeLink')
              : t('landing.changePathButton')}
          </ButtonLink>
        </div>
      }>
      <ForgotPasswordForm
        emailLabel={t('forgotPassword.emailLabel')}
        emailPlaceholder={t('forgotPassword.emailPlaceholder')}
        submitLabel={t('forgotPassword.submitButton')}
        defaultEmail={emailFromState(location.state)}
        backPath={backPath}
        backLabel={
          isSignedIn
            ? t('forgotPassword.backToHomeLink')
            : t('forgotPassword.backToSignInLink')
        }
      />
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
