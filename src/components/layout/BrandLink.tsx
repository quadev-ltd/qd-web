import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import mark from '@/assets/images/QuaDevIconAlphaNoWording.png';

export interface BrandLinkProps {
  /** Where it leads: the public home, or on the signed-in pages where the user lands (D85). */
  to?: string;
}

/** The QuaDev mark and wordmark, linking to the home page. */
export const BrandLink: React.FC<BrandLinkProps> = ({ to = '/' }) => {
  const { t } = useTranslation();
  return (
    <Link to={to} className="flex items-center gap-3 text-white no-underline">
      <img src={mark} alt="" width={720} height={689} className="h-9 w-auto" />
      <span className="font-display text-[17px] leading-natural font-semibold tracking-[0.14em]">
        {t('brand.name')}
      </span>
    </Link>
  );
};

export default BrandLink;
