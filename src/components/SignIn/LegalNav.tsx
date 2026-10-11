import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

const LINK = 'text-white no-underline hover:text-white hover:underline';

/** The legal links on the right of the header of the sign-in screens. */
export const LegalNav: React.FC = () => {
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('header.legalNavAccessibilityLabel')}
      className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] leading-natural font-medium">
      <Link to="/privacy-policy" className={LINK}>
        {t('footer.privacyPolicy')}
      </Link>
      <Link to="/terms-and-conditions" className={LINK}>
        {t('footer.termsAndConditions')}
      </Link>
    </nav>
  );
};

export default LegalNav;
