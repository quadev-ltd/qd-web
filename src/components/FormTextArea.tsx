// A field for several lines of text, with the frame of FormTextInput: a visible label, the
// error and the hint under it, and a counter when the text has a limit.
import { type ComponentProps, type ReactNode, useId } from 'react';
import {
  type FieldError,
  type FieldErrorsImpl,
  type Merge,
} from 'react-hook-form';

import { FieldMessages } from './FormTextInput';

export interface FormTextAreaProps extends Omit<
  ComponentProps<'textarea'>,
  'id' | 'className'
> {
  label: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
  /** Help text under the field. */
  hint?: ReactNode;
  /** "262 / 50,000" under the field, red once the limit is passed. */
  counter?: { length: number; max: number };
}

export const FormTextArea: React.FC<FormTextAreaProps> = ({
  label,
  error,
  hint,
  counter,
  rows = 8,
  ...textAreaProps
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const counterId = `${id}-counter`;
  const message = error?.message as string | undefined;
  const describedBy =
    [message && errorId, hint && hintId, counter && counterId]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm leading-natural font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={message ? true : undefined}
        aria-describedby={describedBy}
        className={`min-w-0 resize-y rounded-control border bg-surface px-3.5 py-3 text-base leading-normal text-text placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60 ${
          message ? 'border-danger' : 'border-border-strong'
        }`}
        {...textAreaProps}
      />
      <FieldMessages
        errorId={errorId}
        hintId={hintId}
        counterId={counterId}
        message={message}
        hint={hint}
        counter={counter}
      />
    </div>
  );
};

export default FormTextArea;
