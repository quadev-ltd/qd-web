import { type ReactNode } from 'react';

import Card from '@/components/ui/Card';

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  /** An optional link under the description. */
  children?: ReactNode;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon,
  title,
  description,
  children,
}) => (
  <Card as="article" tone="glass" className="gap-2.5">
    <span
      aria-hidden="true"
      className="flex size-11 items-center justify-center rounded-control bg-white text-primary">
      {icon}
    </span>
    <h2 className="mt-1 font-display text-[18px] leading-natural font-semibold">
      {title}
    </h2>
    <p className="text-[15px] leading-normal">{description}</p>
    {children}
  </Card>
);

export default FeatureCard;
