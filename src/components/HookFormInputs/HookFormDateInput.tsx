// The web version of qd-mobile src/components/HookFormInputs/HookFormDateInput.tsx.
import {
  type Control,
  Controller,
  type FieldError,
  type FieldErrorsImpl,
  type FieldValues,
  type Merge,
  type Path,
} from 'react-hook-form';

import { FormDateInput } from './FormDateInput';

interface HookFormDateInputProps<TFormSchema extends FieldValues> {
  name: Path<TFormSchema>;
  label: string;
  placeholder?: string;
  control?: Control<TFormSchema>;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
}

export const HookFormDateInput = <TFormSchema extends FieldValues>({
  name,
  label,
  placeholder,
  control,
  error,
}: HookFormDateInputProps<TFormSchema>) => {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { onChange, onBlur, value, ref } }) => {
        return (
          <FormDateInput
            name={name}
            label={label}
            placeholder={placeholder}
            onBlur={onBlur}
            onChangeText={onChange}
            value={value}
            error={error}
            ref={ref}
          />
        );
      }}
    />
  );
};

export default HookFormDateInput;
