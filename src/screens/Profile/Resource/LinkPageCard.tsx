import { useTranslation } from 'react-i18next';

import { formatDay } from './resourceMeta';

import Icon from '@/components/Icon';
import { buttonClassName } from '@/components/ui/buttonStyles';
import Card from '@/components/ui/Card';

export interface LinkPageCardProps {
  /** The page's address, one `parseProfileLink` accepts. */
  address: URL;
  /** When the link was added, and so read. */
  createdAt: number | null;
}

/**
 * "The page", for a link that was read: what a link keeps is its address and what was found
 * on the page, read once when it was added, never the page itself.
 */
export const LinkPageCard: React.FC<LinkPageCardProps> = ({
  address,
  createdAt,
}) => {
  const { t } = useTranslation();
  const path = `${address.pathname}${address.search}`;
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="link-page"
      className="items-start gap-3 p-5">
      <h2
        id="link-page"
        className="font-display text-[18px] leading-tight font-semibold">
        {t('resource.pageTitle')}
      </h2>
      <div className="flex w-full items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="link" size={18} />
        </span>
        <p className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] leading-normal text-muted wrap-anywhere">
            {address.hostname}
          </span>
          {path !== '/' && (
            <span className="text-[15px] leading-normal font-medium wrap-anywhere">
              {path}
            </span>
          )}
        </p>
      </div>
      <p className="text-sm leading-normal text-muted">
        {createdAt === null
          ? t('resource.pageRead')
          : t('resource.pageReadOn', { date: formatDay(createdAt) })}
      </p>
      <a
        href={address.href}
        target="_blank"
        rel="noreferrer"
        className={buttonClassName({
          variant: 'secondary',
          size: 'small',
          className: 'gap-2 text-[15px]',
        })}>
        <Icon name="external" size={18} />
        {t('resource.openPageLink')}
      </a>
    </Card>
  );
};

export default LinkPageCard;
