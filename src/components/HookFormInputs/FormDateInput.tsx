// The web version of qd-mobile src/components/HookFormInputs/FormDateInput.tsx: a text field
// that writes what is typed as DD/MM/YYYY (the app uses react-native-mask-input for that).
import {
  type FieldError,
  type FieldErrorsImpl,
  type Merge,
} from 'react-hook-form';

import { FormTextInput } from '../FormTextInput';

import { maskDisplayDate } from '@/util';

export interface FormDateInputProps {
  label: string;
  name?: string;
  placeholder?: string;
  onBlur?: () => void;
  onChangeText?: (text: string) => void;
  value?: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
  ref?: React.Ref<HTMLInputElement>;
}

export const FormDateInput: React.FC<FormDateInputProps> = ({
  onChangeText,
  value,
  ...rest
}) => (
  <FormTextInput
    type="text"
    inputMode="numeric"
    maxLength={10}
    value={value ?? ''}
    onChange={event => onChangeText?.(maskDisplayDate(event.target.value))}
    {...rest}
  />
);

export default FormDateInput;
