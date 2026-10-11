// Mirrors qd-mobile src/schemas/signUpSchema.ts (same fields, rules and error keys), written
// for zod 4: `required_error` is `error`, and the email format is a piped `z.email`.
// Added for the web: `terms`, because the web design asks for agreement with a checkbox
// (the app shows a sentence under the form). Its error key exists in the app's translations.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import { isPasswordValid } from '@/hooks/usePasswordValidation';
import { isValidDisplayDate, stringToDate } from '@/util';

const { t } = i18n;

export enum SignUpFields {
  email = 'email',
  firstName = 'firstName',
  lastName = 'lastName',
  dob = 'dateOfBirth',
  password = 'password',
  passwordConfirmation = 'passwordConfirmation',
  terms = 'terms',
}

// Same limits as the Firestore rules for users/{uid} (quadev-backend firestore.rules).
export const firstNameSchema = z
  .string({
    error: t('fieldError.firstNameRequiredError'),
  })
  .trim()
  .min(1, { error: t('fieldError.firstNameRequiredError') })
  .max(30, { error: t('fieldError.firstNameLengthError') });

export const lastNameSchema = z
  .string({
    error: t('fieldError.lastNameRequiredError'),
  })
  .trim()
  .min(1, { error: t('fieldError.lastNameRequiredError') })
  .max(30, { error: t('fieldError.lastNameLengthError') });

/** Optional (decision D16): empty is fine; anything entered must be a real, past DD/MM/YYYY date. */
export const optionalDateOfBirthSchema = z
  .string()
  .trim()
  .optional()
  .refine(dob => !dob || isValidDisplayDate(dob), {
    error: t('fieldError.dobFormatError'),
  })
  .refine(
    dob => !dob || !isValidDisplayDate(dob) || stringToDate(dob) <= new Date(),
    {
      error: t('fieldError.dobFutureError'),
    },
  );

export const signUpSchema = z
  .object({
    [SignUpFields.email]: z
      .string({
        error: t('fieldError.emailRequiredError'),
      })
      .trim()
      .pipe(z.email({ error: t('fieldError.emailFormatError') })),
    [SignUpFields.firstName]: firstNameSchema,
    [SignUpFields.lastName]: lastNameSchema,
    [SignUpFields.dob]: optionalDateOfBirthSchema,
    [SignUpFields.password]: z
      .string({
        error: t('fieldError.passwordRequiredError'),
      })
      .refine(password => isPasswordValid(password).isValid, {
        error: t('fieldError.passwordFormatError'),
      }),
    [SignUpFields.passwordConfirmation]: z.string({
      error: t('fieldError.passwordConfirmationRequiredError'),
    }),
    [SignUpFields.terms]: z.literal(true, {
      error: t('fieldError.termsRequiredError'),
    }),
  })
  .refine(
    data =>
      data[SignUpFields.password] === data[SignUpFields.passwordConfirmation],
    {
      error: t('fieldError.passwordConfirmationMatchError'),
      path: [SignUpFields.passwordConfirmation],
    },
  );

export type SignUpSchemaType = z.infer<typeof signUpSchema>;
