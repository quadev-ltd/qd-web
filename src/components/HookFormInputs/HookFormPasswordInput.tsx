// The web version of qd-mobile src/components/HookFormInputs/HookFormPasswordInput.tsx: the
// same show/hide control (one state for the password and its confirmation), the same live
// hints for the rules that are not met yet, and the optional "Forgot password?" action.
import { useState } from 'react';
import {
  type Control,
  type FieldError,
  type FieldErrorsImpl,
  type FieldValues,
  type Merge,
  type Path,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, type To } from 'react-router';

import {
  usePasswordValidation,
  type PasswordValidityAttributes,
} from '../../hooks/usePasswordValidation';

import { HookFormTextInput } from './HookFormTextInput';

import { PasswordVisibilityToggle } from '@/components/PasswordVisibilityToggle';

interface PasswordConfirmationProps<TFormSchema extends FieldValues> {
  label: string;
  name: Path<TFormSchema>;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
}

interface ForgotPasswordLinkProps {
  label: string;
  to: To;
  /** Passed to the forgot-password page (the email typed so far). */
  state?: unknown;
}

interface HookFormPasswordInputProps<TFormSchema extends FieldValues> {
  label: string;
  name: Path<TFormSchema>;
  control: Control<TFormSchema>;
  /** The current value, to show which rules are not met yet. */
  password?: string;
  error?: FieldError | Merge<FieldError, FieldErrorsImpl>;
  /** Shown under the field until the user starts typing. */
  hint?: string;
  autoComplete?: 'current-password' | 'new-password';
  forgotPasswordLink?: ForgotPasswordLinkProps;
  passwordConfirmationField?: PasswordConfirmationProps<TFormSchema>;
}

export const HookFormPasswordInput = <TFormSchema extends FieldValues>({
  label,
  name,
  password,
  control,
  error,
  hint,
  autoComplete,
  forgotPasswordLink,
  passwordConfirmationField,
}: HookFormPasswordInputProps<TFormSchema>) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const { t } = useTranslation();
  const validations: PasswordValidityAttributes =
    usePasswordValidation(password);
  const passwordHints = Object.keys(validations)
    .filter(key => !validations[key] && key !== 'isValid')
    .map(key => {
      switch (key) {
        case 'hasUpperCase':
          return t('fieldError.passwordUppercaseError');
        case 'hasLowerCase':
          return t('fieldError.passwordLowercaseError');
        case 'hasNumber':
          return t('fieldError.passwordNumberError');
        case 'hasSpecialChar':
          return t('fieldError.passwordSpecialCharacterError');
        case 'hasLength':
          return t('fieldError.passwordLengthError');
        default:
          return undefined;
      }
    });
  const { isValid } = validations;
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const visibilityToggle = (
    <PasswordVisibilityToggle
      isPasswordVisible={isPasswordVisible}
      onToggle={togglePasswordVisibility}
    />
  );

  const liveHints = !isValid && (
    <ul className="flex flex-col gap-0.5">
      {passwordHints.map(passwordHint => (
        <li key={passwordHint}>{passwordHint}</li>
      ))}
    </ul>
  );

  return (
    <>
      <HookFormTextInput
        label={label}
        name={name}
        control={control}
        error={error}
        type={isPasswordVisible ? 'text' : 'password'}
        autoComplete={autoComplete}
        hint={liveHints || (!password && hint) || undefined}
        trailing={visibilityToggle}
        labelAction={
          forgotPasswordLink && (
            <Link
              to={forgotPasswordLink.to}
              state={forgotPasswordLink.state}
              className="text-sm leading-natural font-medium no-underline hover:underline">
              {forgotPasswordLink.label}
            </Link>
          )
        }
      />
      {passwordConfirmationField && (
        <HookFormTextInput
          label={passwordConfirmationField.label}
          name={passwordConfirmationField.name}
          control={control}
          error={passwordConfirmationField.error}
          type={isPasswordVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          trailing={visibilityToggle}
        />
      )}
    </>
  );
};

export default HookFormPasswordInput;
