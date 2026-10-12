import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Shown on the public home right after the account was deleted (the app shows a toast).
 * The focus moves to it, so it is read out on arrival.
 */
export const AccountDeletedNotice: React.FC = () => {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="status"
      tabIndex={-1}
      data-surface="light"
      className="-mb-6 flex w-full max-w-[720px] items-start gap-3 rounded-cta bg-surface px-[18px] py-3.5 text-text shadow-floating">
      <svg
        aria-hidden="true"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-none text-primary">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12.5l3 3 5-6" />
      </svg>
      <div className="flex flex-col gap-0.5 text-[15px] leading-[1.45]">
        <strong className="font-bold">{t('deleteAccount.successTitle')}</strong>
        <span className="text-muted">{t('deleteAccount.successMessage')}</span>
      </div>
    </div>
  );
};

export default AccountDeletedNotice;
