// The web version of qd-mobile src/components/HookFormInputs/HookFormTextInput.tsx.
import {
  type Control,
  Controller,
  type FieldError,
  type FieldErrorsImpl,
  type FieldValues,
  type Merge,
  type Path,
} from 'react-hook-form';

import { FormTextInput, type FormTextInputProps } from '../FormTextInput';

export interface HookFormTextInputProps<
  TFormSchema extends FieldValues,
> extends Omit<
  FormTextInputProps,
  'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'ref'
> {
  name: Path<TFormSchema>;
  control?: Control<TFormSchema>;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
}

export const HookFormTextInput = <TFormSchema extends FieldValues>({
  name,
  control,
  error,
  ...rest
}: HookFormTextInputProps<TFormSchema>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, onBlur, value, ref } }) => {
        return (
          <FormTextInput
            name={name}
            onBlur={onBlur}
            onChange={onChange}
            value={value ?? ''}
            error={error}
            ref={ref}
            {...rest}
          />
        );
      }}
    />
  );
};

export default HookFormTextInput;
