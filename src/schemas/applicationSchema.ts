// "New application" and "Edit the application". The limits are the backend's
// (src/core/profile/applications.ts): checked here first, and again by the backend.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import {
  APPLICATION_NAME_MAX_CHARS,
  APPLICATION_NOTES_MAX_CHARS,
  JOB_DESCRIPTION_MAX_CHARS,
} from '@/core/profile/applications';
import { parseProfileLink } from '@/core/profile/contract';

const { t } = i18n;

export enum ApplicationFields {
  title = 'title',
  company = 'company',
  role = 'role',
  jobDescription = 'jobDescription',
  postingUrl = 'postingUrl',
  notes = 'notes',
}

const title = z
  .string()
  .trim()
  .min(1, { error: t('applications.titleRequiredError') })
  .max(APPLICATION_NAME_MAX_CHARS, {
    error: t('applications.nameLengthError'),
  });

const optionalName = z
  .string()
  .trim()
  .max(APPLICATION_NAME_MAX_CHARS, {
    error: t('applications.nameLengthError'),
  });

const jobDescription = z
  .string()
  .trim()
  .min(1, { error: t('applications.jobRequiredError') })
  .max(JOB_DESCRIPTION_MAX_CHARS, {
    error: t('applications.jobLengthError'),
  });

/** A new application, while the backend does not read the title from the job (research doc 17). */
export const newApplicationSchema = z.object({
  [ApplicationFields.title]: title,
  [ApplicationFields.jobDescription]: jobDescription,
});
export type NewApplicationSchemaType = z.infer<typeof newApplicationSchema>;

const editFields = {
  [ApplicationFields.title]: title,
  [ApplicationFields.company]: optionalName,
  [ApplicationFields.role]: optionalName,
  [ApplicationFields.jobDescription]: jobDescription,
  [ApplicationFields.postingUrl]: z
    .string()
    .trim()
    // Empty is allowed: the posting's address is optional.
    .refine(value => value === '' || parseProfileLink(value) !== undefined, {
      error: t('applications.postingError'),
    }),
  [ApplicationFields.notes]: z
    .string()
    .trim()
    .max(APPLICATION_NOTES_MAX_CHARS, {
      error: t('applications.notesLengthError'),
    }),
};

export const editApplicationSchema = z.object(editFields);

/** While the job is being read, its text cannot change: the form leaves it out. */
export const editWhileReadingSchema = z.object({
  ...editFields,
  [ApplicationFields.jobDescription]: z.string(),
});
export type EditApplicationSchemaType = z.infer<typeof editApplicationSchema>;
