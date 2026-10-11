import { useTranslation } from 'react-i18next';

import TermsAndConditionsContent from './TermsAndConditionsContent';

import LegalPage from '@/components/layout/LegalPage';

export const TermsAndConditionsScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <LegalPage title={t('termsAndConditions.documentTitle')}>
      <TermsAndConditionsContent />
    </LegalPage>
  );
};

export default TermsAndConditionsScreen;
