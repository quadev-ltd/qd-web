import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import SignedInShell from '@/components/layout/SignedInShell';
import NotAvailable from '@/components/NotAvailable';
import Spinner from '@/components/Spinner';
import { useFlag, useFlagsReady } from '@/core/flags/FlagsProvider';
import { ProfileGatewayProvider } from '@/core/profile/ProfileGatewayProvider';

/** The main area of every profile page: the gutter, and room above the footer. */
export const PROFILE_MAIN = 'px-gutter pt-8 pb-16';

/** The frame of a profile page that has nothing to show yet. */
const Waiting: React.FC = () => {
  const { t } = useTranslation();
  return (
    <SignedInShell
      title={t('profile.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    </SignedInShell>
  );
};

/**
 * The routes of the interview profile, inside the signed-in routes. The profile is part of
 * the interview tools, so it follows their flag (`interviewAssistant`):
 * - while the user's flags are being read, a page that only waits;
 * - flag off: "Not available for your account yet", at every address of the profile;
 * - flag on: the page, with the profile gateway. The gateway is loaded here, by the first
 *   profile page, and stays for the others.
 */
export const ProfileRoutes: React.FC = () => {
  const { t } = useTranslation();
  const available = useFlag('interviewAssistant');
  const flagsReady = useFlagsReady();

  if (!flagsReady) {
    return <Waiting />;
  }
  if (!available) {
    return (
      <SignedInShell
        title={t('profile.documentTitle')}
        mainClassName={PROFILE_MAIN}>
        <NotAvailable
          icon="user"
          title={t('profile.title')}
          description={t('profile.notAvailableDescription')}
        />
      </SignedInShell>
    );
  }
  return (
    <ProfileGatewayProvider fallback={<Waiting />}>
      <Outlet />
    </ProfileGatewayProvider>
  );
};

export default ProfileRoutes;
