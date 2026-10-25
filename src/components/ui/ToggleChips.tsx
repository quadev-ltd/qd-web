import { useId } from 'react';

import Icon from '@/components/Icon';

export interface ToggleChipOption<Value extends string | number> {
  value: Value;
  label: string;
}

export interface ToggleChipsProps<Value extends string | number> {
  /** What is being chosen, shown above the chips. */
  label: string;
  options: readonly ToggleChipOption<Value>[];
  /** The chosen option; `null` when none is. */
  value: Value | null;
  onChange: (value: Value | null) => void;
  disabled?: boolean;
}

/**
 * An optional choice of one from a few, as chips (D89, the interview's length and type). Each
 * chip is a button that says whether it is pressed: pressing another one chooses it, and
 * pressing the chosen one again clears the choice, which a group of radios can't do.
 */
export const ToggleChips = <Value extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: ToggleChipsProps<Value>) => {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p id={labelId} className="text-sm leading-natural font-medium">
        {label}
      </p>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2">
        {options.map(option => {
          const pressed = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={pressed}
              disabled={disabled}
              onClick={() => onChange(pressed ? null : option.value)}
              className={`flex h-11 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[15px] leading-natural disabled:cursor-not-allowed disabled:opacity-60 ${
                pressed
                  ? 'border-2 border-primary bg-tint font-bold text-primary-dark'
                  : 'border border-border-strong bg-surface font-medium text-text'
              }`}>
              {pressed && <Icon name="check" size={16} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ToggleChips;
