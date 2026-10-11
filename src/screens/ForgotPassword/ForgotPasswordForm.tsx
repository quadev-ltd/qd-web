// The web version of qd-mobile src/screens/ForgotPassword/ForgotPasswordForm.tsx: as in the
// app, this form owns its useForm (it has one field and nothing above it needs the form).
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import ForgotPasswordStatus from './ForgotPasswordStatus';
import { useForgotPassword } from './useForgotPassword';

import { HookFormTextInput } from '@/components/HookFormInputs/HookFormTextInput';
import Button from '@/components/ui/Button';
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
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  emailLabel,
  emailPlaceholder,
  defaultEmail,
  submitLabel,
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
        isLoading={isLoading}
        isSuccess={isSuccess}
        errorMessage={errorMessage}
      />
    );
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit(forgotPassword)}
      className="flex flex-col gap-5">
      <p className="text-[15px] leading-normal text-muted">
        {t('forgotPassword.subtitle')}
      </p>
      <HookFormTextInput
        label={emailLabel}
        name={ForgotPasswordFields.email}
        control={control}
        error={errors[ForgotPasswordFields.email]}
        type="email"
        autoComplete="email"
        placeholder={emailPlaceholder}
      />
      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
