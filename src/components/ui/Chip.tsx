import { type ReactNode } from 'react';

import Icon, { type IconName } from '@/components/Icon';

export interface ChipProps {
  /**
   * info: a state worth knowing ("Coming soon"). brand: what something is ("CV", "Link").
   * success, warning and danger: how something went. neutral: a quiet mark ("Edited").
   */
  tone?: 'info' | 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  /** A small icon before the text. */
  icon?: IconName;
  children: ReactNode;
}

const TONES = {
  info: 'bg-chip text-chip-text',
  brand: 'bg-tint text-primary-dark',
  success: 'bg-success-tint text-success',
  warning: 'bg-warning-tint text-warning',
  danger: 'bg-danger-tint text-danger',
  neutral: 'bg-border-faint text-muted',
};

/** A short status label, for example "Coming soon". */
export const Chip: React.FC<ChipProps> = ({
  tone = 'info',
  icon,
  children,
}) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap ${TONES[tone]}`}>
    {icon && <Icon name={icon} size={14} />}
    {children}
  </span>
);

export default Chip;
