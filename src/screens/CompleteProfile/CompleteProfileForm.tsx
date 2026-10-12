// The fields of qd-mobile src/screens/CompleteProfile/CompleteProfileScreen.tsx, read from
// the form context that CompleteProfileScreen provides (the split the sign-up screen uses).
// The app replaces the form with a spinner while it saves; here the form stays in place,
// disabled, and the button shows the spinner.
import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useCompleteProfile } from './useCompleteProfile';

import { HookFormDateInput } from '@/components/HookFormInputs/HookFormDateInput';
import { HookFormTextInput } from '@/components/HookFormInputs/HookFormTextInput';
import ErrorMessage from '@/components/SignIn/ErrorMessage';
import SubmitButton from '@/components/SignIn/SubmitButton';
import { useSessionUser } from '@/core/session/hooks';
import {
  CompleteProfileFields,
  type CompleteProfileSchemaType,
} from '@/schemas/completeProfileSchema';

export const CompleteProfileForm: React.FC = () => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useFormContext<CompleteProfileSchemaType>();
  const { t } = useTranslation();
  const user = useSessionUser();
  const { save, isSaving, errorMessage } = useCompleteProfile(user?.uid);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.focus();
    }
  }, [errorMessage]);

  return (
    <form
      noValidate
      onSubmit={handleSubmit(save)}
      className="flex flex-col gap-5">
      <fieldset disabled={isSaving} className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-4">
          <HookFormTextInput
            label={t('signUp.firstNameLabel')}
            name={CompleteProfileFields.firstName}
            control={control}
            error={errors[CompleteProfileFields.firstName]}
            autoComplete="given-name"
          />
          <HookFormTextInput
            label={t('signUp.lastNameLabel')}
            name={CompleteProfileFields.lastName}
            control={control}
            error={errors[CompleteProfileFields.lastName]}
            autoComplete="family-name"
          />
        </div>
        <HookFormDateInput
          label={t('signUp.dobLabel')}
          name={CompleteProfileFields.dob}
          control={control}
          error={errors[CompleteProfileFields.dob]}
          placeholder={t('signUp.dobPlaceholder')}
        />
      </fieldset>
      {errorMessage && <ErrorMessage ref={errorRef} text={errorMessage} />}
      <SubmitButton isLoading={isSaving}>
        {t('completeProfile.submitButton')}
      </SubmitButton>
    </form>
  );
};

export default CompleteProfileForm;
