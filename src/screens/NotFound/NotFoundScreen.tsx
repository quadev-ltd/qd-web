import { useTranslation } from 'react-i18next';

import PageShell from '@/components/layout/PageShell';
import ButtonLink from '@/components/ui/ButtonLink';

export const NotFoundScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PageShell
      tone="brand"
      title={t('notFound.documentTitle')}
      mainClassName="flex flex-col items-center justify-center gap-5 px-gutter py-16 text-center">
      <h1 className="font-display text-[clamp(32px,5.4vw,52px)] leading-[1.1] font-semibold text-balance">
        {t('notFound.title')}
      </h1>
      <p className="max-w-[600px] text-[18px] leading-[1.55]">
        {t('notFound.description')}
      </p>
      <ButtonLink to="/" variant="inverse" size="large" className="mt-2">
        {t('notFound.homeLink')}
      </ButtonLink>
    </PageShell>
  );
};

export default NotFoundScreen;
