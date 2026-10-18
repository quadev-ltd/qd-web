import { useId } from 'react';

export interface Choice<Value extends string> {
  value: Value;
  title: string;
  meta?: string;
}

export interface ChoiceGroupProps<Value extends string> {
  label: string;
  choices: readonly Choice<Value>[];
  value: Value | undefined;
  onChange: (value: Value) => void;
  disabled?: boolean;
}

/**
 * One choice among a few, each with a line under it, as cards (C3, "What is it for?"). Native
 * radio buttons in a fieldset: the arrow keys move between them.
 */
export const ChoiceGroup = <Value extends string>({
  label,
  choices,
  value,
  onChange,
  disabled,
}: ChoiceGroupProps<Value>) => {
  const name = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm leading-normal font-medium">
        {label}
      </legend>
      {choices.map(choice => {
        const checked = choice.value === value;
        return (
          <label
            key={choice.value}
            className={`flex cursor-pointer items-start gap-3 rounded-[14px] border px-3.5 py-3 has-disabled:cursor-default ${
              checked
                ? 'border-primary bg-tint shadow-[inset_0_0_0_1px_var(--color-primary)]'
                : 'border-border bg-surface'
            }`}>
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={checked}
              onChange={() => onChange(choice.value)}
              className="mt-1 size-[18px] flex-none accent-primary"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-base leading-normal font-medium wrap-anywhere">
                {choice.title}
              </span>
              {choice.meta && (
                <span className="text-sm leading-normal text-muted wrap-anywhere">
                  {choice.meta}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
};

export default ChoiceGroup;
