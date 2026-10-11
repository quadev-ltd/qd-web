// The web version of qd-mobile src/screens/SignUp/SignUpForm.tsx: the same fields, read from
// the form context that SignUpScreen provides. The order follows the web design (names first).
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Terms } from './Terms';
import { useSignUp } from './useSignUp';

import { HookFormDateInput } from '@/components/HookFormInputs/HookFormDateInput';
import { HookFormPasswordInput } from '@/components/HookFormInputs/HookFormPasswordInput';
import { HookFormTextInput } from '@/components/HookFormInputs/HookFormTextInput';
import ErrorMessage from '@/components/SignIn/ErrorMessage';
import SubmitButton from '@/components/SignIn/SubmitButton';
import { SignUpFields, type SignUpSchemaType } from '@/schemas/signUpSchema';

export const SignUpForm: React.FC = () => {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useFormContext<SignUpSchemaType>();
  const { t } = useTranslation();
  const { signUp, isLoading, errorMessage } = useSignUp(setError);

  const password = useWatch({ control, name: SignUpFields.password });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(signUp)}
      className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4">
        <HookFormTextInput
          label={t('signUp.firstNameLabel')}
          name={SignUpFields.firstName}
          control={control}
          error={errors[SignUpFields.firstName]}
          autoComplete="given-name"
        />
        <HookFormTextInput
          label={t('signUp.lastNameLabel')}
          name={SignUpFields.lastName}
          control={control}
          error={errors[SignUpFields.lastName]}
          autoComplete="family-name"
        />
      </div>
      <HookFormTextInput
        label={t('signUp.emailLabel')}
        name={SignUpFields.email}
        control={control}
        error={errors[SignUpFields.email]}
        type="email"
        autoComplete="email"
        placeholder={t('signUp.emailPlaceholder')}
      />
      <HookFormDateInput
        label={t('signUp.dobLabel')}
        name={SignUpFields.dob}
        control={control}
        error={errors[SignUpFields.dob]}
        placeholder={t('signUp.dobPlaceholder')}
      />
      <HookFormPasswordInput
        label={t('signUp.passwordLabel')}
        name={SignUpFields.password}
        password={password}
        control={control}
        error={errors[SignUpFields.password]}
        hint={t('signUp.passwordHint')}
        autoComplete="new-password"
        passwordConfirmationField={{
          label: t('signUp.passwordConfirmationLabel'),
          name: SignUpFields.passwordConfirmation,
          error: errors[SignUpFields.passwordConfirmation],
        }}
      />
      <Terms />
      {errorMessage && <ErrorMessage text={errorMessage} />}
      <SubmitButton isLoading={isLoading}>
        {t('signUp.submitButton')}
      </SubmitButton>
    </form>
  );
};

export default SignUpForm;
