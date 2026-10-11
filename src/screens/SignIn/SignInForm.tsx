// The web version of qd-mobile src/screens/SignIn/SignInForm.tsx: the same fields, read from
// the form context that SignInScreen provides.
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useSignIn } from './useSignIn';

import { HookFormPasswordInput } from '@/components/HookFormInputs/HookFormPasswordInput';
import { HookFormTextInput } from '@/components/HookFormInputs/HookFormTextInput';
import ErrorMessage from '@/components/SignIn/ErrorMessage';
import SubmitButton from '@/components/SignIn/SubmitButton';
import { SignInFields, type SignInSchemaType } from '@/schemas/signInSchema';

export const SignInForm: React.FC = () => {
  const {
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useFormContext<SignInSchemaType>();
  const { t } = useTranslation();
  const { signIn, isLoading, errorMessage } = useSignIn(setError);
  const password = useWatch({ control, name: SignInFields.password });
  const email = useWatch({ control, name: SignInFields.email });

  return (
    <form
      noValidate
      onSubmit={handleSubmit(signIn)}
      className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <HookFormTextInput
          label={t('signIn.emailLabel')}
          name={SignInFields.email}
          control={control}
          error={errors[SignInFields.email]}
          type="email"
          autoComplete="email"
          placeholder={t('signIn.emailPlaceholder')}
        />
        <HookFormPasswordInput
          label={t('signIn.passwordLabel')}
          name={SignInFields.password}
          password={password}
          control={control}
          error={errors[SignInFields.password]}
          autoComplete="current-password"
          forgotPasswordLink={{
            label: t('signIn.forgotButton'),
            to: '/forgot-password',
            // As in the app: after a failed sign-in the email is carried over.
            state: errors[SignInFields.email] ? { email } : undefined,
          }}
        />
      </div>
      {errorMessage && <ErrorMessage text={errorMessage} />}
      <SubmitButton isLoading={isLoading}>
        {t('signIn.submitButton')}
      </SubmitButton>
    </form>
  );
};

export default SignInForm;
