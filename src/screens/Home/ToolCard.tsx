import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';

export interface ToolCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** Whether the tool is released for this user (its feature flag). Otherwise "Coming soon". */
  available: boolean;
}

/** One tool on the signed-in home. */
export const ToolCard: React.FC<ToolCardProps> = ({
  icon,
  title,
  description,
  available,
}) => {
  const { t } = useTranslation();
  return (
    <Card as="article" elevation="raised" className="gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-control bg-tint text-primary">
          {icon}
        </span>
        <Chip>
          {available ? t('home.availableChip') : t('home.comingSoonChip')}
        </Chip>
      </div>
      <h2 className="font-display text-[19px] leading-natural font-semibold">
        {title}
      </h2>
      <p className="text-[15px] leading-normal text-muted">{description}</p>
    </Card>
  );
};

export default ToolCard;
