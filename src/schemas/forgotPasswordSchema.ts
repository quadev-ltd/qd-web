// Mirrors qd-mobile src/schemas/forgotPasswordSchema.ts, written for zod 4.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

const { t } = i18n;

export enum ForgotPasswordFields {
  email = 'email',
}

export const forgotPasswordSchema = z.object({
  [ForgotPasswordFields.email]: z
    .string({
      error: t('fieldError.emailRequiredError'),
    })
    .trim()
    .pipe(z.email({ error: t('fieldError.emailFormatError') })),
});

export type ForgotPasswordSchemaType = z.infer<typeof forgotPasswordSchema>;
