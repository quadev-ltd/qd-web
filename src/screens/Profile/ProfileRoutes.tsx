import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useMatch } from 'react-router';

import SignedInShell from '@/components/layout/SignedInShell';
import NotAvailable from '@/components/NotAvailable';
import Spinner from '@/components/Spinner';
import { HOME_PATH } from '@/core/auth/paths';
import { useFlag, useFlagsReady } from '@/core/flags/FlagsProvider';
import { InterviewProfileProvider } from '@/core/profile/InterviewProfileProvider';
import { APPLICATIONS_PATH } from '@/core/profile/paths';
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
 * - flag off: "Not available for your account yet", at every address of the profile, except
 *   the list of applications, which is the home for an account with the flag: there, the
 *   home of an account without it (D85);
 * - flag on: the page, with the profile gateway and the profile itself. Both are loaded
 *   here, by the first profile page, and stay for the others.
 */
export const ProfileRoutes: React.FC = () => {
  const { t } = useTranslation();
  const available = useFlag('interviewAssistant');
  const flagsReady = useFlagsReady();
  const atApplications = useMatch(APPLICATIONS_PATH) !== null;

  if (!flagsReady) {
    return <Waiting />;
  }
  if (!available && atApplications) {
    return <Navigate to={HOME_PATH} replace />;
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
      <InterviewProfileProvider>
        <Outlet />
      </InterviewProfileProvider>
    </ProfileGatewayProvider>
  );
};

export default ProfileRoutes;
