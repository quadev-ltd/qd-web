import { useTranslation } from 'react-i18next';

import PrivacyPolicyContent from './PrivacyPolicyContent';

import LegalPage from '@/components/layout/LegalPage';

export const PrivacyPolicyScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <LegalPage title={t('privacyPolicy.documentTitle')}>
      <PrivacyPolicyContent />
    </LegalPage>
  );
};

export default PrivacyPolicyScreen;
