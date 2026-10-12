// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordForm.tsx: as in the
// app, this form owns its useForm (it has one field and nothing above it needs the form).
// While the email is being sent the form stays in place, disabled, and the button shows the
// spinner (the app replaces the form with a spinner).
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { type To } from 'react-router';

import ForgotPasswordStatus from './ForgotPasswordStatus';
import { useForgotPassword } from './useForgotPassword';

import { HookFormTextInput } from '@/components/HookFormInputs/HookFormTextInput';
import SubmitButton from '@/components/SignIn/SubmitButton';
import {
  ForgotPasswordFields,
  type ForgotPasswordSchemaType,
  forgotPasswordSchema,
} from '@/schemas/forgotPasswordSchema';

export interface ForgotPasswordFormProps {
  emailLabel: string;
  emailPlaceholder?: string;
  defaultEmail: string;
  submitLabel: string;
  /** Where "Back to …" under the success message leads, and what it says. */
  backPath: To;
  backLabel: string;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  emailLabel,
  emailPlaceholder,
  defaultEmail,
  submitLabel,
  backPath,
  backLabel,
}) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordSchemaType>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      [ForgotPasswordFields.email]: defaultEmail,
    },
  });
  const { t } = useTranslation();
  const {
    showStatus,
    setShowStatus,
    forgotPassword,
    isLoading,
    isError,
    isSuccess,
    errorMessage,
  } = useForgotPassword();

  const showPasswordResetFrom = () => setShowStatus(false);

  if (showStatus) {
    return (
      <ForgotPasswordStatus
        hideStatus={showPasswordResetFrom}
        isError={isError}
        isSuccess={isSuccess}
        errorMessage={errorMessage}
        backPath={backPath}
        backLabel={backLabel}
      />
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(forgotPassword)}
      className="flex flex-col gap-5">
      {/* Directly under the card's title (the card puts 20px between its parts). */}
      <p className="-mt-3.5 text-[15px] leading-normal text-muted">
        {t('forgotPassword.subtitle')}
      </p>
      <fieldset disabled={isLoading} className="flex min-w-0 flex-col">
        <HookFormTextInput
          label={emailLabel}
          name={ForgotPasswordFields.email}
          control={control}
          error={errors[ForgotPasswordFields.email]}
          type="email"
          autoComplete="email"
          placeholder={emailPlaceholder}
        />
      </fieldset>
      <p role="status" className="sr-only">
        {isLoading && t('forgotPassword.sending')}
      </p>
      <SubmitButton isLoading={isLoading}>{submitLabel}</SubmitButton>
    </form>
  );
};

export default ForgotPasswordForm;
