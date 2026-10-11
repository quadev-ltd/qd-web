import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import mark from '@/assets/images/QuaDevIconAlphaNoWording.png';

/** The QuaDev mark and wordmark, linking to the home page. */
export const BrandLink: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex items-center gap-3 text-white no-underline">
      <img src={mark} alt="" width={720} height={689} className="h-9 w-auto" />
      <span className="font-display text-[17px] leading-natural font-semibold tracking-[0.14em]">
        {t('brand.name')}
      </span>
    </Link>
  );
};

export default BrandLink;
