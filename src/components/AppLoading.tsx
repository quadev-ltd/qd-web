// The web version of qd-mobile src/components/AppLoading.tsx: shown while the session is
// still being worked out (SessionStatus.Initializing). Like the app's, it is only the logo
// and a turning ring: no header and no footer, so nothing jumps when the page arrives.
import { useTranslation } from 'react-i18next';

import Spinner from './Spinner';

import logo from '@/assets/images/QuaDevIconAlpha.png';
import Arcs from '@/components/layout/Arcs';

export const AppLoading: React.FC = () => {
  const { t } = useTranslation();
  return (
    <main
      data-surface="dark"
      className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-primary px-gutter py-16 text-white">
      <title>{t('publicHome.documentTitle')}</title>
      <Arcs variant="auth" />
      <img
        src={logo}
        alt={t('brand.logoAlt')}
        width={720}
        height={888}
        className="relative h-[150px] w-auto"
      />
      <Spinner className="relative" />
    </main>
  );
};

export default AppLoading;
