// The text of a skill map item, as the candidate edits it. The limit is the backend's
// (SKILL_MAP_ITEM_MAX_CHARS).
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import { SKILL_MAP_ITEM_MAX_CHARS } from '@/core/profile/contract';

const { t } = i18n;

export enum ItemTextFields {
  text = 'text',
}

export const itemTextSchema = z.object({
  [ItemTextFields.text]: z
    .string()
    .trim()
    .min(1, { error: t('item.textRequiredError') })
    .max(SKILL_MAP_ITEM_MAX_CHARS, { error: t('item.textLengthError') }),
});

export type ItemTextSchemaType = z.infer<typeof itemTextSchema>;
