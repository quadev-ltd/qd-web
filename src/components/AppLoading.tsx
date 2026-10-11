// The web version of qd-mobile src/components/AppLoading.tsx: shown while the session is
// still being worked out (SessionStatus.Initializing).
import { useTranslation } from 'react-i18next';

import Spinner from './Spinner';

import PageShell from '@/components/layout/PageShell';

export const AppLoading: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PageShell
      tone="brand"
      arcs="auth"
      title={t('publicHome.documentTitle')}
      mainClassName="flex items-center justify-center px-gutter py-16">
      <Spinner />
    </PageShell>
  );
};

export default AppLoading;
