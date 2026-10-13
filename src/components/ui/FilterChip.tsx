import { type ReactNode } from 'react';

import Icon, { type IconName } from '@/components/Icon';

export interface FilterChipProps {
  /** Whether the filter is on. */
  pressed: boolean;
  icon?: IconName;
  onClick: () => void;
  children: ReactNode;
}

/** A filter that is on or off, among others: a button that stays pressed. */
export const FilterChip: React.FC<FilterChipProps> = ({
  pressed,
  icon,
  onClick,
  children,
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className={`flex h-11 flex-none cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm leading-natural whitespace-nowrap ${
      pressed
        ? 'border-primary bg-primary font-bold text-white'
        : 'border-border-strong bg-surface font-medium text-text hover:bg-tint'
    }`}>
    {icon && <Icon name={icon} size={16} filled={pressed && icon === 'star'} />}
    {children}
  </button>
);

export default FilterChip;
