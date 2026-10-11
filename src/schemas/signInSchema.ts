// Mirrors qd-mobile src/schemas/signInSchema.ts (same fields, rules and error keys), written
// for zod 4: `required_error` is `error`, and the email format is a piped `z.email`.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import { isPasswordValid } from '@/hooks/usePasswordValidation';

const { t } = i18n;

export enum SignInFields {
  email = 'email',
  password = 'password',
}

export const signInSchema = z.object({
  [SignInFields.email]: z
    .string({
      error: t('fieldError.emailRequiredError'),
    })
    .trim()
    .pipe(z.email({ error: t('fieldError.emailFormatError') })),
  [SignInFields.password]: z
    .string({
      error: t('fieldError.passwordRequiredError'),
    })
    .refine(password => isPasswordValid(password).isValid, {
      error: t('fieldError.passwordFormatError'),
    }),
});

export type SignInSchemaType = z.infer<typeof signInSchema>;
