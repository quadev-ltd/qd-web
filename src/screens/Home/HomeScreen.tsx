// The signed-in home. The app's HomeScreen (qd-mobile src/screens/Home/HomeScreen.tsx) is a
// welcome text and its drawer shows the name, the email, "Delete account" and "Sign out";
// the web design puts all of it on this page. Everything shown comes from the session.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { DocumentIcon, MicrophoneIcon, SoundWaveIcon } from './icons';
import StartCard from './StartCard';
import ToolCard from './ToolCard';

import Arcs from '@/components/layout/Arcs';
import SignedInShell, {
  ACCOUNT_SECTION_ID,
} from '@/components/layout/SignedInShell';
import Card from '@/components/ui/Card';
import { DELETE_ACCOUNT_PATH } from '@/core/auth/paths';
import { isoDateToDisplay } from '@/core/auth/profile';
import {
  APPLE_PROVIDER_ID,
  GOOGLE_PROVIDER_ID,
  PASSWORD_PROVIDER_ID,
} from '@/core/auth/types';
import { useFlag } from '@/core/flags/FlagsProvider';
import { useProfile, useSessionUser, useSignOut } from '@/core/session/hooks';

const CARD_TITLE = 'text-[17px] leading-natural font-bold';
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

export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const user = useSessionUser();
  const profile = useProfile();
  const signOut = useSignOut();
  // The interview tools are opened to accounts with this flag. What exists of them on the
  // website so far is the profile: the home then starts with "Add your CV". The three
  // tools below are not built here yet, so they say "Coming soon" to everyone.
  const interviewAssistant = useFlag('interviewAssistant');

  const firstName = profile?.firstName ?? '';
  const lastName = profile?.lastName ?? '';
  const fullName = `${firstName} ${lastName}`.trim();
  const dateOfBirth = displayDate(profile?.dateOfBirth);

  const providerIds = user?.providerIds ?? [];
  const hasPassword = providerIds.includes(PASSWORD_PROVIDER_ID);
  const signInMethods = [
    hasPassword && t('home.passwordMethod'),
    providerIds.includes(GOOGLE_PROVIDER_ID) && t('home.googleMethod'),
    providerIds.includes(APPLE_PROVIDER_ID) && t('home.appleMethod'),
  ].filter(Boolean);

  return (
    <SignedInShell title={t('home.documentTitle')}>
      <div
        data-surface="dark"
        className="relative overflow-hidden bg-primary px-gutter pt-[clamp(36px,7vw,56px)] pb-28 text-white">
        <Arcs variant="welcome" />
        <div className="relative mx-auto flex max-w-[1120px] flex-col gap-3">
          <h1 className="font-display text-[clamp(30px,5vw,40px)] leading-[1.15] font-semibold text-balance">
            {t('home.welcomeTitle', { firstName })}
          </h1>
          <p className="max-w-[560px] text-[18px] leading-normal">
            {t('home.welcomeDescription')}
          </p>
        </div>
      </div>

      <div className="px-gutter pb-16">
        <div className="relative mx-auto -mt-16 flex max-w-[1120px] flex-col gap-10">
          {interviewAssistant && <StartCard />}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5">
            <ToolCard
              icon={<MicrophoneIcon />}
              title={t('home.mockInterviewTitle')}
              description={t('home.mockInterviewDescription')}
              available={false}
            />
            <ToolCard
              icon={<SoundWaveIcon />}
              title={t('home.liveInterviewTitle')}
              description={t('home.liveInterviewDescription')}
              available={false}
            />
            <ToolCard
              icon={<DocumentIcon />}
              title={t('home.cvToolTitle')}
              description={t('home.cvToolDescription')}
              available={false}
            />
          </div>

          <section
            id={ACCOUNT_SECTION_ID}
            aria-labelledby="account-title"
            className="flex scroll-mt-4 flex-col gap-4">
            <h2
              id="account-title"
              className="font-display text-[22px] leading-natural font-semibold">
              {t('home.accountTitle')}
            </h2>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] gap-5">
              <Card className="gap-4">
                <h3 className={CARD_TITLE}>{t('home.profileTitle')}</h3>
                <dl className={DETAILS}>
                  <dt className="text-muted">{t('home.nameLabel')}</dt>
                  <dd>{fullName}</dd>
                  <dt className="text-muted">{t('home.emailLabel')}</dt>
                  <dd className="wrap-anywhere">{user?.email}</dd>
                  <dt className="text-muted">{t('home.dobLabel')}</dt>
                  {dateOfBirth ? (
                    <dd>{dateOfBirth}</dd>
                  ) : (
                    <dd className="text-muted">{t('home.dobNotSet')}</dd>
                  )}
                </dl>
              </Card>

              <Card className="gap-4">
                <h3 className={CARD_TITLE}>{t('home.securityTitle')}</h3>
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
          </section>
        </div>
      </div>
    </SignedInShell>
  );
};

export default HomeScreen;
