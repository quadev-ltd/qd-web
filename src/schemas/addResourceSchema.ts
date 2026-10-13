// The three forms of "Add a resource" (a file, pasted text, a link). The limits are the
// backend's (src/core/profile/contract.ts): they are checked here so the candidate hears
// about them before anything is sent, and again by the backend.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import {
  parseProfileLink,
  PROFILE_TEXT_MAX_CHARS,
  PROFILE_TITLE_MAX_CHARS,
  RESOURCE_TYPES_BY_SOURCE,
} from '@/core/profile/contract';

const { t } = i18n;

export enum AddResourceFields {
  title = 'title',
  type = 'type',
  text = 'text',
  url = 'url',
}

const title = z
  .string()
  .trim()
  .min(1, { error: t('addResource.titleRequiredError') })
  .max(PROFILE_TITLE_MAX_CHARS, {
    error: t('addResource.titleLengthError'),
  });

export const addFileSchema = z.object({
  [AddResourceFields.title]: title,
  [AddResourceFields.type]: z.enum(RESOURCE_TYPES_BY_SOURCE.file),
});
export type AddFileSchemaType = z.infer<typeof addFileSchema>;

export const addTextSchema = z.object({
  [AddResourceFields.title]: title,
  [AddResourceFields.type]: z.enum(RESOURCE_TYPES_BY_SOURCE.text),
  [AddResourceFields.text]: z
    .string()
    .trim()
    .min(1, { error: t('addResource.textRequiredError') })
    .max(PROFILE_TEXT_MAX_CHARS, {
      error: t('addResource.textLengthError'),
    }),
});
export type AddTextSchemaType = z.infer<typeof addTextSchema>;

export const addLinkSchema = z.object({
  [AddResourceFields.title]: title,
  [AddResourceFields.url]: z
    .string()
    .trim()
    .min(1, { error: t('addResource.addressRequiredError') })
    // An empty address has its own message above.
    .refine(value => value === '' || parseProfileLink(value) !== undefined, {
      error: t('addResource.addressError'),
    }),
});
export type AddLinkSchemaType = z.infer<typeof addLinkSchema>;
