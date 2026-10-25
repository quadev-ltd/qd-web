// "Add an interview" and "Edit the interview" (D89). The limits are the backend's
// (src/core/profile/interviews.ts): checked here first, and again by the backend.
import { z } from 'zod';

import { i18n } from '../core/i18n/i18n';

import {
  INTERVIEW_DATE,
  INTERVIEW_DESCRIPTION_MAX_CHARS,
  INTERVIEW_NAME_MAX_CHARS,
  INTERVIEW_TIME,
  INTERVIEW_TYPES,
} from '@/core/profile/interviews';

const { t } = i18n;

export enum InterviewFields {
  name = 'name',
  date = 'date',
  startTime = 'startTime',
  lengthMinutes = 'lengthMinutes',
  type = 'type',
  description = 'description',
}

/** The years the backend takes. */
export const INTERVIEW_FIRST_DATE = '2000-01-01';
export const INTERVIEW_LAST_DATE = '2100-12-31';

/** A date that exists, from 2000 to 2100. The date field gives 'YYYY-MM-DD'. */
export const isInterviewDate = (value: string) => {
  if (!INTERVIEW_DATE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    value >= INTERVIEW_FIRST_DATE &&
    value <= INTERVIEW_LAST_DATE &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const interviewSchema = z.object({
  [InterviewFields.name]: z
    .string()
    .trim()
    .max(INTERVIEW_NAME_MAX_CHARS, {
      error: t('interviews.nameLengthError'),
    }),
  [InterviewFields.date]: z
    .string()
    .min(1, { error: t('interviews.dateRequiredError') })
    .refine(isInterviewDate, { error: t('interviews.dateRangeError') }),
  [InterviewFields.startTime]: z
    .string()
    // A field that shows seconds gives 'HH:mm:ss': the minutes are what counts.
    .transform(value => value.slice(0, 5))
    .pipe(
      z.string().regex(INTERVIEW_TIME, {
        error: t('interviews.timeRequiredError'),
      }),
    ),
  [InterviewFields.lengthMinutes]: z.number().int().nullable(),
  [InterviewFields.type]: z.enum(INTERVIEW_TYPES).nullable(),
  [InterviewFields.description]: z
    .string()
    .trim()
    .max(INTERVIEW_DESCRIPTION_MAX_CHARS, {
      error: t('interviews.descriptionLengthError'),
    }),
});

export type InterviewSchemaInput = z.input<typeof interviewSchema>;
export type InterviewSchemaType = z.output<typeof interviewSchema>;
