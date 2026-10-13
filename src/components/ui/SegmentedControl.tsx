import { useId } from 'react';

export interface SegmentedOption<Value extends string> {
  value: Value;
  label: string;
}

export interface SegmentedControlProps<Value extends string> {
  /** What is being chosen, shown above the options. */
  label: string;
  options: readonly SegmentedOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  disabled?: boolean;
}

/**
 * A choice between two or three options, side by side. It is a group of radio buttons
 * drawn as one control: the arrow keys move between the options, as in any radio group.
 */
export const SegmentedControl = <Value extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps<Value>) => {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-sm leading-natural font-medium">
        {label}
      </legend>
      <div className="flex gap-0.5 rounded-control bg-border-faint p-0.5">
        {options.map(option => (
          <label
            key={option.value}
            className="flex h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-[10px] px-2 text-sm leading-natural font-medium text-muted has-checked:bg-surface has-checked:font-bold has-checked:text-primary has-checked:shadow-[0_1px_3px_rgb(22_23_80/0.18)] has-disabled:cursor-not-allowed has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            <span className="truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default SegmentedControl;
