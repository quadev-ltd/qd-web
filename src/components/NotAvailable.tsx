import { useTranslation } from 'react-i18next';

import Icon, { type IconName } from './Icon';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';

export interface NotAvailableProps {
  icon: IconName;
  /** The name of the tool: the heading of the page. */
  title: string;
  /** What the tool does, so the visitor knows what is coming. */
  description: string;
}

/**
 * What a signed-in user sees on the page of a tool that is not switched on for their
 * account (its feature flag): the tool stays visible and says so, instead of disappearing.
 */
export const NotAvailable: React.FC<NotAvailableProps> = ({
  icon,
  title,
  description,
}) => {
  const { t } = useTranslation();
  return (
    <Card
      elevation="raised"
      className="mx-auto mt-12 w-full max-w-[560px] items-start gap-3.5 p-8">
      <span
        aria-hidden="true"
        className="flex size-[72px] flex-none items-center justify-center rounded-full bg-tint text-primary">
        <Icon name={icon} size={32} />
      </span>
      <Chip>{t('access.notAvailableChip')}</Chip>
      <h1 className="font-display text-[28px] leading-tight font-semibold">
        {title}
      </h1>
      <p className="text-[16px] leading-normal text-muted">{description}</p>
      <p className="text-[16px] leading-normal text-muted">
        {t('access.stagesDescription')}
      </p>
    </Card>
  );
};

export default NotAvailable;
