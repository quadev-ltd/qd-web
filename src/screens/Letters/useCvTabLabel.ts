import { useTranslation } from 'react-i18next';

import { useFlag } from '@/core/flags/FlagsProvider';

/** The application's CV tab: "CV and letter" with cover letters (D98), "CV" without. */
export const useCvTabLabel = () => {
  const { t } = useTranslation();
  return useFlag('coverLetters')
    ? t('applications.cvAndLetterTab')
    : t('applications.cvTab');
};

export default useCvTabLabel;
