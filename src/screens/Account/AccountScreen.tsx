// "Your account" (D85): the personal details and how the user signs in, its own page behind
// the name in the header. The app's drawer shows the name, the email, "Delete account" and
// "Sign out". Everything shown comes from the session. "This month" (minutes and plans, D44)
// waits for the session tools.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import SignedInShell from '@/components/layout/SignedInShell';
import Card from '@/components/ui/Card';
import { DELETE_ACCOUNT_PATH } from '@/core/auth/paths';
import { isoDateToDisplay } from '@/core/auth/profile';
import {
  APPLE_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
  PASSWORD_PROVIDER_ID,
} from '@/core/auth/types';
import { useFlag } from '@/core/flags/FlagsProvider';
import { CV_DETAILS_PATH } from '@/core/profile/paths';
import { useProfile, useSessionUser, useSignOut } from '@/core/session/hooks';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const CARD_TITLE = 'font-display text-[18px] leading-tight font-semibold';
const DETAILS =
  'grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-4 gap-y-3 text-[15px] leading-natural';
const ACTION =
  'flex h-11 cursor-pointer items-center text-[15px] leading-natural font-bold no-underline hover:underline';

/** The date of birth as the form shows it, or nothing when it is missing or malformed. */
const displayDate = (isoDate?: string): string | undefined => {
  if (!isoDate) {
    return undefined;
  }
  try {
    return isoDateToDisplay(isoDate);
  } catch {
    return undefined;
  }
};

export const AccountScreen: React.FC = () => {
  const { t } = useTranslation();
  const user = useSessionUser();
  const profile = useProfile();
  const signOut = useSignOut();
  // The CV details are the CV tool's (D83): only an account with it has them.
  const interviewTools = useFlag('interviewAssistant');
  const cvTool = useFlag('cvTool');

  const fullName =
    `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim();
  const dateOfBirth = displayDate(profile?.dateOfBirth);

  const providerIds = user?.providerIds ?? [];
  const hasPassword = providerIds.includes(PASSWORD_PROVIDER_ID);
  const signInMethods = [
    hasPassword && t('home.passwordMethod'),
    providerIds.includes(GOOGLE_PROVIDER_ID) && t('home.googleMethod'),
    providerIds.includes(APPLE_PROVIDER_ID) && t('home.appleMethod'),
  ].filter(Boolean);

  return (
    <SignedInShell
      title={t('account.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[28px] leading-tight font-semibold">
            {t('home.accountTitle')}
          </h1>
          <p className="text-[16px] leading-normal text-muted">
            {t('account.description')}
          </p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))] gap-5">
          <Card
            as="section"
            aria-labelledby="account-personal"
            className="gap-4">
            <h2 id="account-personal" className={CARD_TITLE}>
              {t('account.personalTitle')}
            </h2>
            <dl className={DETAILS}>
              <dt className="text-muted">{t('home.nameLabel')}</dt>
              <dd className="wrap-anywhere">{fullName}</dd>
              <dt className="text-muted">{t('home.emailLabel')}</dt>
              <dd className="wrap-anywhere">{user?.email}</dd>
              <dt className="text-muted">{t('home.dobLabel')}</dt>
              {dateOfBirth ? (
                <dd>{dateOfBirth}</dd>
              ) : (
                <dd className="text-muted">{t('home.dobNotSet')}</dd>
              )}
            </dl>
            {interviewTools && cvTool && (
              <>
                <p className="text-sm leading-normal text-muted">
                  {t('account.personalCvNote')}
                </p>
                <Link
                  to={CV_DETAILS_PATH}
                  className={`${ACTION} self-start text-link hover:text-primary-dark`}>
                  {t('account.openCvDetailsLink')}
                </Link>
              </>
            )}
          </Card>

          <Card
            as="section"
            aria-labelledby="account-security"
            className="gap-4">
            <h2 id="account-security" className={CARD_TITLE}>
              {t('home.securityTitle')}
            </h2>
            <dl className={DETAILS}>
              <dt className="text-muted">{t('home.signInMethodsLabel')}</dt>
              <dd>{signInMethods.join(', ')}</dd>
              {hasPassword && (
                <>
                  <dt className="text-muted">{t('home.passwordLabel')}</dt>
                  <dd>
                    <Link
                      to="/forgot-password"
                      state={{ email: user?.email }}
                      className="font-bold no-underline hover:underline">
                      {t('home.changePasswordLink')}
                    </Link>
                  </dd>
                </>
              )}
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-faint pt-4">
              <button
                type="button"
                onClick={signOut}
                className={`${ACTION} text-link hover:text-primary-dark`}>
                {t('drawerMenu.signOut')}
              </button>
              <Link
                to={DELETE_ACCOUNT_PATH}
                className={`${ACTION} text-danger hover:text-danger`}>
                {t('drawerMenu.deleteAccount')}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </SignedInShell>
  );
};

export default AccountScreen;
