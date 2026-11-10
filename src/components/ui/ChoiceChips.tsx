import { useId } from 'react';

import Icon from '@/components/Icon';

export interface ChoiceChipOption<Value extends string | number> {
  value: Value;
  label: string;
}

export interface ChoiceChipsProps<Value extends string | number> {
  /** What is being chosen, shown above the chips. */
  label: string;
  options: readonly ChoiceChipOption<Value>[];
  /** The chosen option; `null` until one is. */
  value: Value | null;
  onChange: (value: Value) => void;
  disabled?: boolean;
}

/**
 * A required choice of one from a few, drawn as chips (D100: a mock interview's length, the
 * feedback card's answers). A group of radio buttons underneath: the arrow keys move between the
 * chips, and one stays chosen. ToggleChips is the optional choice that can be cleared.
 */
export const ChoiceChips = <Value extends string | number>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: ChoiceChipsProps<Value>) => {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2">
      <legend className="mb-2 text-sm leading-natural font-medium">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <label
            key={option.value}
            className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-[15px] leading-natural font-medium text-text has-checked:border-2 has-checked:border-primary has-checked:bg-tint has-checked:font-bold has-checked:text-primary-dark has-disabled:cursor-not-allowed has-disabled:opacity-60 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)">
            <input
              type="radio"
              name={name}
              value={String(option.value)}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span className="hidden peer-checked:flex">
              <Icon name="check" size={16} />
            </span>
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default ChoiceChips;
