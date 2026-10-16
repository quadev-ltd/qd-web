// Job applications (delivery 2a), as quadev-backend keeps them (packages/shared/src/jobApplication.ts):
// one per job the candidate applies for, with the brief that prepares them for its interviews. The
// names, limits and checks are mirrored here; the backend applies them again and refuses what fails.
import { z } from 'zod';

import {
  PROFILE_RESOURCE_FAILURES,
  PROFILE_UPLOAD_CONTENT_TYPES,
  type ProfileUploadContentType,
} from './contract';

// ---------- Limits ----------

/** Applications one user can hold. */
export const APPLICATIONS_MAX = 50;
/** Longest title, company or role of an application. */
export const APPLICATION_NAME_MAX_CHARS = 100;
/** Longest job description. A long posting is about 8,000 characters. */
export const JOB_DESCRIPTION_MAX_CHARS = 20_000;
/** Longest notes of the candidate about one job. */
export const APPLICATION_NOTES_MAX_CHARS = 5_000;
/** Briefs one user can have prepared in a day (UTC); the backend also caps their cost. */
export const BRIEF_DAILY_LIMIT = 10;
/** The service name the backend counts briefs under, in `usage/{uid}/days/{date}`. */
export const BRIEF_SERVICE = 'applicationBrief';

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const applicationsPath = (uid: string, applicationId?: string) =>
  `users/${uid}/applications${applicationId === undefined ? '' : `/${applicationId}`}`;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);

export const BRIEF_IMPORTANCES = ['required', 'preferred'] as const;
export const BRIEF_QUESTION_KINDS = [
  'behavioural',
  'technical',
  'role',
  'motivation',
] as const;

/** One thing the job asks for. No items: a gap. */
export const BriefRequirementSchema = z.object({
  text: z.string(),
  importance: z.enum(BRIEF_IMPORTANCES).catch('required'),
  /** The passage of the job description that states it, word for word. */
  evidence: z.string().optional().catch(undefined),
  /** The profile items that show it, strongest first. */
  itemIds: z.array(z.string()).catch([]),
});
export type BriefRequirement = z.infer<typeof BriefRequirementSchema>;

export const BriefQuestionSchema = z.object({
  text: z.string(),
  kind: z.enum(BRIEF_QUESTION_KINDS).catch('role'),
  bullets: z
    .array(
      z.object({
        text: z.string(),
        itemId: z.string().optional().catch(undefined),
      }),
    )
    .catch([]),
});
export type BriefQuestion = z.infer<typeof BriefQuestionSchema>;

/** The brief of an application, replaced as a whole each time it is prepared. */
export const ApplicationBriefSchema = z.object({
  requirements: z.array(BriefRequirementSchema).catch([]),
  questions: z.array(BriefQuestionSchema).catch([]),
  /** The `revision` of the application and of the profile it was built from. */
  applicationRevision: z.number().catch(0),
  profileRevision: z.number().catch(0),
  builtAt: timestamp,
});
export type ApplicationBrief = z.infer<typeof ApplicationBriefSchema>;

export const JOB_SOURCES = ['text', 'file', 'link'] as const;
export type JobSource = (typeof JOB_SOURCES)[number];

/**
 * Where the job of an application is in its reading (research doc 17): created and waiting for
 * its file, being read, ready (its text and names are there), or failed (why: `failure`). An
 * application without a `job` was created with a title and a pasted job, and is ready.
 */
export const JOB_STATUSES = [
  'awaitingUpload',
  'reading',
  'ready',
  'failed',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Longest name of a job's file, as shown ("Read from …"). */
export const APPLICATION_FILE_NAME_MAX_CHARS = 200;

export const ApplicationJobSchema = z.object({
  source: z.enum(JOB_SOURCES).catch('text'),
  status: z.enum(JOB_STATUSES).catch('ready'),
  /** The reasons of a resource (`ProfileResourceFailure`). */
  failure: z.enum(PROFILE_RESOURCE_FAILURES).optional().catch('internal'),
  /** Only for a file: its name on the candidate's device. */
  fileName: z.string().optional().catch(undefined),
  /** When its text was kept: pasted, read from the file, or the copy of the page taken. */
  takenAt: timestamp.optional(),
  /** The candidate changed the text since it was kept. */
  edited: z.boolean().catch(false),
  /** The copy of a page was cut at JOB_DESCRIPTION_MAX_CHARS. */
  truncated: z.boolean().optional().catch(undefined),
});
export type ApplicationJob = z.infer<typeof ApplicationJobSchema>;

/** `users/{uid}/applications/{applicationId}`. */
export const JobApplicationSchema = z.object({
  id: z.string().min(1),
  /** Read from the job, or given; empty until a reading names it. */
  title: z.string().catch(''),
  company: z.string().optional().catch(undefined),
  role: z.string().optional().catch(undefined),
  /** The text of the job. A brief needs it. */
  jobDescription: z.string().optional().catch(undefined),
  /** Where the posting is, to open it again. */
  postingUrl: z.string().optional().catch(undefined),
  /** The candidate's own notes about this job. */
  notes: z.string().optional().catch(undefined),
  /** Goes up by one with every change the brief is built from. */
  revision: z.number().catch(0),
  brief: ApplicationBriefSchema.optional().catch(undefined),
  job: ApplicationJobSchema.optional().catch(undefined),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type JobApplication = z.infer<typeof JobApplicationSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const CREATE_JOB_APPLICATION = 'createJobApplication';
export const UPDATE_JOB_APPLICATION = 'updateJobApplication';
export const REMOVE_JOB_APPLICATION = 'removeJobApplication';
export const PREPARE_APPLICATION_BRIEF = 'prepareApplicationBrief';

/** The job of a new application (D74, D76): pasted, a file to upload, or a posting's address. */
export type NewJob =
  | { source: 'text'; text: string }
  | {
      source: 'file';
      contentType: ProfileUploadContentType;
      fileName: string;
    }
  | { source: 'link'; url: string };

/** What `createJobApplication` takes: the job; the names are read from it unless given. */
export interface CreateJobApplicationRequest {
  job: NewJob;
  title?: string;
  company?: string;
  role?: string;
  notes?: string;
}

/**
 * A change to an application: only the fields that change. `null` clears a field; the
 * title and, on the website, the job description are never cleared.
 */
export interface UpdateJobApplicationRequest {
  applicationId: string;
  title?: string;
  company?: string | null;
  role?: string | null;
  jobDescription?: string;
  postingUrl?: string | null;
  notes?: string | null;
}

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const CreateJobApplicationResponseSchema = z.object({
  applicationId: documentId,
  /** Only for a job given as a file: upload it here, once, with this content type. */
  upload: z
    .object({
      path: z.string().min(1),
      contentType: z.enum(PROFILE_UPLOAD_CONTENT_TYPES),
      maxBytes: z.number().int().positive(),
    })
    .optional(),
});
export const UpdateJobApplicationResponseSchema = z.object({
  applicationId: documentId,
  revision: z.number().int().positive(),
});
export const RemoveJobApplicationResponseSchema = z.object({
  applicationId: documentId,
});
/** The brief itself is stored on the application; this is how big it is. */
export const PrepareApplicationBriefResponseSchema = z.object({
  applicationId: documentId,
  requirements: z.number().int().nonnegative(),
  gaps: z.number().int().nonnegative(),
  questions: z.number().int().nonnegative(),
});

// ---------- What the pages work out ----------

/** Where the brief of an application is, as the home and the brief say it. */
export type BriefState =
  | { kind: 'none' }
  | { kind: 'ready'; gaps: number }
  | { kind: 'outOfDate'; because: 'job' | 'profile' };

/**
 * The brief's state: none yet, ready (with its gaps), or out of date because the job or the
 * profile changed since it was built. The job comes first, as on the brief's own banner.
 */
export const briefStateOf = (
  { brief, revision }: Pick<JobApplication, 'brief' | 'revision'>,
  profileRevision: number | null,
): BriefState => {
  if (!brief) {
    return { kind: 'none' };
  }
  if (brief.applicationRevision < revision) {
    return { kind: 'outOfDate', because: 'job' };
  }
  if (profileRevision !== null && brief.profileRevision < profileRevision) {
    return { kind: 'outOfDate', because: 'profile' };
  }
  return {
    kind: 'ready',
    gaps: brief.requirements.filter(({ itemIds }) => itemIds.length === 0)
      .length,
  };
};

/** Where the job of an application is; one created before jobs were read is ready. */
export const jobStatusOf = ({ job }: Pick<JobApplication, 'job'>): JobStatus =>
  job?.status ?? 'ready';

/** The backend has not finished with the job: its file has not arrived, or it is being read. */
export const isJobPending = (application: Pick<JobApplication, 'job'>) => {
  const status = jobStatusOf(application);
  return status === 'awaitingUpload' || status === 'reading';
};
