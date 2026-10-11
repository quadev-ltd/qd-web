import { useTranslation } from 'react-i18next';

import PageShell from '@/components/layout/PageShell';
import Card from '@/components/ui/Card';
import { SUPPORT_EMAIL } from '@/core/contact';

const SECTION_TITLE = 'font-display text-[19px] leading-[1.3] font-semibold';
const BODY = 'text-base leading-[1.6]';

/** Public information on how to delete an account (the deletion itself happens in the mobile app). */
export const DeleteAccountInfoScreen: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PageShell
      tone="light"
      title={t('deleteAccountInfo.documentTitle')}
      mainClassName="px-gutter py-[clamp(24px,5vw,48px)]">
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
        <div className="flex flex-col gap-3 pb-2">
          <h1 className="font-display text-[clamp(30px,5vw,40px)] leading-[1.15] font-semibold text-balance">
            {t('deleteAccountInfo.title')}
          </h1>
          <p className="text-[18px] leading-normal text-muted">
            {t('deleteAccountInfo.description')}
          </p>
        </div>

        <Card as="section" aria-labelledby="delete-steps" className="gap-3">
          <h2 id="delete-steps" className={SECTION_TITLE}>
            {t('deleteAccountInfo.stepsTitle')}
          </h2>
          <ol className={`list-decimal pl-6 ${BODY}`}>
            <li>{t('deleteAccountInfo.stepOpenMenu')}</li>
            <li>{t('deleteAccountInfo.stepChooseDelete')}</li>
            <li>{t('deleteAccountInfo.stepConfirm')}</li>
          </ol>
        </Card>

        <Card as="section" aria-labelledby="delete-erased" className="gap-3">
          <h2 id="delete-erased" className={SECTION_TITLE}>
            {t('deleteAccountInfo.erasedTitle')}
          </h2>
          <p className={BODY}>{t('deleteAccountInfo.erasedDescription')}</p>
        </Card>

        <Card as="section" aria-labelledby="delete-permanent" className="gap-3">
          <h2 id="delete-permanent" className={SECTION_TITLE}>
            {t('deleteAccountInfo.permanentTitle')}
          </h2>
          <p className={BODY}>{t('deleteAccountInfo.permanentDescription')}</p>
        </Card>

        <Card as="section" aria-labelledby="delete-email" className="gap-3">
          <h2 id="delete-email" className={SECTION_TITLE}>
            {t('deleteAccountInfo.emailTitle')}
          </h2>
          <p className={BODY}>{t('deleteAccountInfo.emailDescription')}</p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="self-start text-base font-bold underline">
            {SUPPORT_EMAIL}
          </a>
        </Card>
      </div>
    </PageShell>
  );
};

export default DeleteAccountInfoScreen;
