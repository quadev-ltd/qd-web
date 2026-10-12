// The web version of qd-mobile src/components/FormTextInput.tsx. The app uses the label as a
// placeholder; the web design puts a visible <label> above the field, which is also the
// field's accessible name (so there is no separate accessibilityLabel).
import { type ComponentProps, type ReactNode, useId } from 'react';
import {
  type FieldError,
  type FieldErrorsImpl,
  type Merge,
} from 'react-hook-form';

export interface FormTextInputProps extends Omit<
  ComponentProps<'input'>,
  'id' | 'className'
> {
  label: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
  /** Help text under the field. */
  hint?: ReactNode;
  /** Shown on the right of the label (for example the "Forgot password?" link). */
  labelAction?: ReactNode;
  /** Shown inside the field, on the right (for example the "Show" button). */
  trailing?: ReactNode;
}

export const FormTextInput: React.FC<FormTextInputProps> = ({
  label,
  error,
  hint,
  labelAction,
  trailing,
  type = 'text',
  ...inputProps
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const message = error?.message as string | undefined;
  const describedBy =
    [message && errorId, hint && hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm leading-natural font-medium">
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative flex">
        <input
          id={id}
          type={type}
          aria-invalid={message ? true : undefined}
          aria-describedby={describedBy}
          className={`h-control min-w-0 flex-1 rounded-control border bg-surface text-base text-text placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 ${
            trailing ? 'pr-[72px] pl-3.5' : 'px-3.5'
          } ${message ? 'border-danger' : 'border-border-strong'}`}
          {...inputProps}
        />
        {trailing}
      </div>
      {message && (
        <p
          id={errorId}
          className="text-[13px] leading-[1.45] font-medium text-danger">
          {message}
        </p>
      )}
      {hint && (
        <div id={hintId} className="text-[13px] leading-[1.45] text-muted">
          {hint}
        </div>
      )}
    </div>
  );
};

export default FormTextInput;
