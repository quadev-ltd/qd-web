import { type ComponentProps, type ReactNode, useId } from 'react';

export interface CheckboxProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'type' | 'className'
> {
  /** The label; it may contain links. */
  children: ReactNode;
  /** The validation message, shown under the checkbox. */
  error?: string;
}

/** A native checkbox with its label on the right and its error underneath. */
export const Checkbox: React.FC<CheckboxProps> = ({
  children,
  error,
  ...inputProps
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="flex cursor-pointer items-start gap-3 text-[15px] leading-normal">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-px size-[22px] flex-none cursor-pointer accent-primary"
          {...inputProps}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p
          id={errorId}
          className="text-[13px] leading-[1.45] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default Checkbox;
