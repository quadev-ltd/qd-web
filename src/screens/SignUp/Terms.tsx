// The web version of qd-mobile src/screens/SignUp/Terms.tsx. The app shows a sentence ("By
// submitting you agree with our ..."); the web design asks for agreement with a checkbox,
// which is the `terms` field of the sign-up form.
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Checkbox from '@/components/ui/Checkbox';
import { SignUpFields, type SignUpSchemaType } from '@/schemas/signUpSchema';

const LINK = 'font-bold underline';

export const Terms: React.FC = () => {
  const { t } = useTranslation();
  const {
    control,
    formState: { errors },
  } = useFormContext<SignUpSchemaType>();

  return (
    <Controller
      name={SignUpFields.terms}
      control={control}
      render={({ field: { onChange, onBlur, value, ref } }) => (
        <Checkbox
          name={SignUpFields.terms}
          checked={value === true}
          onChange={event => onChange(event.target.checked)}
          onBlur={onBlur}
          ref={ref}
          error={errors[SignUpFields.terms]?.message}>
          {t('signUp.termsAgreement')}{' '}
          {/* A new tab, so what was typed in the form is not lost. */}
          <Link
            to="/terms-and-conditions"
            target="_blank"
            rel="noreferrer"
            className={LINK}>
            {t('signUp.termsOfService')}
          </Link>{' '}
          {t('signUp.termsConjunction')}{' '}
          <Link
            to="/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className={LINK}>
            {t('signUp.privacyPolicy')}
          </Link>
          .
        </Checkbox>
      )}
    />
  );
};

export default Terms;
