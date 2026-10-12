// The web version of qd-mobile src/screens/DeleteAccount/DeleteAccountScreen.tsx, for a
// signed-in user (the app opens it from its drawer; here it is "Delete account" on the
// signed-in home). The public page that explains how to delete an account is
// DeleteAccountInfoScreen, at /delete-account.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DeleteAccountForm } from './DeleteAccountForm';

import SignedInShell from '@/components/layout/SignedInShell';
import StatusIcon from '@/components/StatusIcon';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { useAuthGateway } from '@/core/auth/AuthGatewayProvider';
import { HOME_PATH } from '@/core/auth/paths';
import { SUPPORT_EMAIL } from '@/core/contact';
import { useSessionUser } from '@/core/session/hooks';

const TEXT = 'text-base leading-[1.55] text-muted';
const LINK = 'font-bold no-underline hover:underline';

export const DeleteAccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const gateway = useAuthGateway();
  const user = useSessionUser();
  // No way to ask "is it really you?" on the web (an account with Apple alone, until Apple
  // sign-in is set up here): the page says where the account can be deleted instead.
  const canConfirm = Boolean(user && gateway.getReauthMethod(user));

  return (
    <SignedInShell
      title={t('deleteAccount.documentTitle')}
      mainClassName="flex flex-col items-center justify-center px-gutter py-[clamp(24px,6vw,56px)]">
      <Card
        elevation="raised"
        padding="roomy"
        className="w-full max-w-[560px] gap-5">
        <div className="flex flex-col gap-3.5">
          <StatusIcon icon="trash" tone="danger" />
          <h1 className="font-display text-[28px] leading-[1.2] font-semibold">
            {canConfirm
              ? t('deleteAccount.title')
              : t('drawerMenu.deleteAccount')}
          </h1>
        </div>
        {canConfirm ? (
          <DeleteAccountForm />
        ) : (
          <>
            <p className={TEXT}>{t('deleteAccount.unavailableOnWeb')}</p>
            <ul className="flex flex-col gap-2 text-[15px] leading-natural">
              <li>
                <Link to="/delete-account" className={LINK}>
                  {t('publicHome.deleteCardLink')}
                </Link>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
            <ButtonLink to={HOME_PATH} variant="secondary">
              {t('forgotPassword.backToHomeLink')}
            </ButtonLink>
          </>
        )}
      </Card>
    </SignedInShell>
  );
};

export default DeleteAccountScreen;
