import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouteError } from 'react-router';

import PageShell from '@/components/layout/PageShell';
import ButtonLink from '@/components/ui/ButtonLink';
import logger from '@/core/logger';

/** Shown instead of a blank page when a screen fails to render. */
export const ErrorScreen: React.FC = () => {
  const { t } = useTranslation();
  const error = useRouteError();

  useEffect(() => {
    logger().logError(
      error instanceof Error ? error : new Error(String(error)),
    );
  }, [error]);

  return (
    <PageShell
      tone="brand"
      title={t('error.documentTitle')}
      mainClassName="flex flex-col items-center justify-center gap-5 px-gutter py-16 text-center">
      <h1 className="font-display text-[clamp(32px,5.4vw,52px)] leading-[1.1] font-semibold text-balance">
        {t('error.unexpectedErrorTitle')}
      </h1>
      <p className="max-w-[600px] text-[18px] leading-[1.55]">
        {t('error.unexpectedErrorMessage')}
      </p>
      <ButtonLink
        to="/"
        reloadDocument
        variant="inverse"
        size="large"
        className="mt-2">
        {t('notFound.homeLink')}
      </ButtonLink>
    </PageShell>
  );
};

export default ErrorScreen;
