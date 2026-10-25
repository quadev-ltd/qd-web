// The interviews of a job application (D89, doc 07 FR-1f), as quadev-backend keeps them: one per
// round, each with the date and start time the candidate entered, in their time zone, and what
// they know about it. The names, limits and checks are mirrored here; the backend applies them
// again and refuses what fails. It computes `startsAt` from the date, the time and the zone:
// the pages sort and compare with it, and never work it out themselves.
import { z } from 'zod';

// ---------- Limits ----------

/** Interviews one application can hold. */
export const INTERVIEWS_MAX = 20;
/** Longest name of an interview. */
export const INTERVIEW_NAME_MAX_CHARS = 60;
/** Longest "What you know about it". */
export const INTERVIEW_DESCRIPTION_MAX_CHARS = 2_000;
/** The lengths the form offers; the backend takes any whole number of minutes from 5 to 480. */
export const INTERVIEW_LENGTHS = [30, 45, 60, 90] as const;
export const INTERVIEW_LENGTH_MIN = 5;
export const INTERVIEW_LENGTH_MAX = 480;

export const INTERVIEW_TYPES = [
  'behavioural',
  'technical',
  'system-design',
  'mixed',
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

/** `failed-precondition`: the application already holds INTERVIEWS_MAX interviews. */
export const INTERVIEW_LIMIT_REASON = 'interview-limit';

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const interviewsPath = (
  uid: string,
  applicationId: string,
  interviewId?: string,
) =>
  `users/${uid}/applications/${applicationId}/interviews${interviewId === undefined ? '' : `/${interviewId}`}`;

/** 'YYYY-MM-DD' and 'HH:mm' (24-hour), as the candidate entered them. */
export const INTERVIEW_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const INTERVIEW_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);

const lengthMinutes = z
  .number()
  .int()
  .min(INTERVIEW_LENGTH_MIN)
  .max(INTERVIEW_LENGTH_MAX)
  .optional()
  .catch(undefined);

/** `users/{uid}/applications/{applicationId}/interviews/{interviewId}`. */
export const ApplicationInterviewSchema = z.object({
  id: z.string().min(1),
  /** Absent when the candidate gave none. */
  name: z.string().optional().catch(undefined),
  date: z.string().regex(INTERVIEW_DATE),
  startTime: z.string().regex(INTERVIEW_TIME),
  /** An IANA name, the browser's when the date and time were entered. */
  timeZone: z.string().min(1),
  /** The instant it starts, computed by the backend. */
  startsAt: z.number(),
  lengthMinutes,
  type: z.enum(INTERVIEW_TYPES).optional().catch(undefined),
  /** '' when the candidate wrote nothing. */
  description: z.string().catch(''),
  /** Goes up when the description, the type or the length change. Not shown. */
  revision: z.number().catch(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ApplicationInterview = z.infer<typeof ApplicationInterviewSchema>;

/**
 * One interview as the application lists them (`interviewTimes`), so the list of applications
 * shows the next one without reading every application's interviews.
 */
export const InterviewTimeSchema = z.object({
  interviewId: z.string().min(1),
  startsAt: z.number(),
  date: z.string(),
  startTime: z.string(),
  timeZone: z.string(),
  name: z.string().optional().catch(undefined),
  /** Not sent by the backend yet; without it an interview is taken to last an hour. */
  lengthMinutes,
});
export type InterviewTime = z.infer<typeof InterviewTimeSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const CREATE_APPLICATION_INTERVIEW = 'createApplicationInterview';
export const UPDATE_APPLICATION_INTERVIEW = 'updateApplicationInterview';
export const REMOVE_APPLICATION_INTERVIEW = 'removeApplicationInterview';

export interface CreateInterviewRequest {
  applicationId: string;
  name?: string;
  date: string;
  startTime: string;
  timeZone: string;
  lengthMinutes?: number;
  type?: InterviewType;
  description?: string;
}

/**
 * A change to an interview: only the fields that change, one at least. `null` clears an
 * optional field, '' the description. The date, the start time and the zone go together.
 */
export type UpdateInterviewRequest = {
  applicationId: string;
  interviewId: string;
  name?: string | null;
  lengthMinutes?: number | null;
  type?: InterviewType | null;
  description?: string;
} & (
  | { date: string; startTime: string; timeZone: string }
  | { date?: never; startTime?: never; timeZone?: never }
);

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const CreateInterviewResponseSchema = z.object({
  applicationId: documentId,
  interviewId: documentId,
});
export const UpdateInterviewResponseSchema = z.object({
  applicationId: documentId,
  interviewId: documentId,
  revision: z.number().int().nonnegative(),
});
export const RemoveInterviewResponseSchema = z.object({
  applicationId: documentId,
  interviewId: documentId,
});
