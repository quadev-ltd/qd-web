import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import SignedInShell from '@/components/layout/SignedInShell';
import NotAvailable from '@/components/NotAvailable';
import { useFlag } from '@/core/flags/FlagsProvider';
import { ApplicationsProvider } from '@/core/profile/ApplicationsProvider';
import { CvVersionsProvider } from '@/core/profile/CvVersionsProvider';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

/**
 * The routes of the CV versions (delivery 2b), inside the profile's routes (ProfileRoutes):
 * those give them the interview tools' flag, the gateway and the profile. The CV tool has a
 * flag of its own (`cvTool`): without it, "Not available for your account yet". With it, the
 * applications (a version can be for one of them) and the versions.
 */
export const CvRoutes: React.FC = () => {
  const { t } = useTranslation();
  if (!useFlag('cvTool')) {
    return (
      <SignedInShell title={t('cv.documentTitle')} mainClassName={PROFILE_MAIN}>
        <NotAvailable
          icon="file"
          title={t('cv.title')}
          description={t('cv.notAvailableDescription')}
        />
      </SignedInShell>
    );
  }
  return (
    <ApplicationsProvider>
      <CvVersionsProvider>
        <Outlet />
      </CvVersionsProvider>
    </ApplicationsProvider>
  );
};

export default CvRoutes;
