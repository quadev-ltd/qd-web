// The route of a cover letter (D98): without the `coverLetters` flag, "Not available for your
// account yet", as the CV routes say it without `cvTool`.
import { useTranslation } from 'react-i18next';

import LetterScreen from './LetterScreen';

import SignedInShell from '@/components/layout/SignedInShell';
import NotAvailable from '@/components/NotAvailable';
import { useFlag } from '@/core/flags/FlagsProvider';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

export const LetterRoute: React.FC = () => {
  const { t } = useTranslation();
  if (!useFlag('coverLetters')) {
    return (
      <SignedInShell
        title={t('letters.documentTitle')}
        mainClassName={PROFILE_MAIN}>
        <NotAvailable
          icon="text"
          title={t('letters.sectionTitle')}
          description={t('letters.notAvailableDescription')}
        />
      </SignedInShell>
    );
  }
  return <LetterScreen />;
};

export default LetterRoute;
