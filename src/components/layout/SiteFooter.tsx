import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { SUPPORT_EMAIL } from '@/core/contact';

const LINK = 'text-link-on-dark no-underline hover:text-white hover:underline';

export const SiteFooter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <footer
      data-surface="dark"
      className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 bg-primary-dark px-gutter py-[18px] text-sm leading-natural text-white">
      <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
      <nav
        aria-label={t('footer.navAccessibilityLabel')}
        className="flex flex-wrap gap-x-6 gap-y-2">
        <Link to="/privacy-policy" className={LINK}>
          {t('footer.privacyPolicy')}
        </Link>
        <Link to="/terms-and-conditions" className={LINK}>
          {t('footer.termsAndConditions')}
        </Link>
        <Link to="/delete-account" className={LINK}>
          {t('footer.deleteAccount')}
        </Link>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
          {SUPPORT_EMAIL}
        </a>
      </nav>
    </footer>
  );
};

export default SiteFooter;
