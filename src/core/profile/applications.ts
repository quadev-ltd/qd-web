// Job applications (delivery 2a), as quadev-backend keeps them (packages/shared/src/jobApplication.ts):
// one per job the candidate applies for, with the brief that prepares them for its interviews. The
// names, limits and checks are mirrored here; the backend applies them again and refuses what fails.
import { z } from 'zod';

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

/**
 * Where the job came from and where its reading is, once the backend reads the job itself
 * (research doc 17, not on the backend's `main` yet). An application without it has a pasted
 * job and is ready.
 */
export const ApplicationJobSchema = z.object({
  source: z.enum(['text', 'file', 'link']).catch('text'),
  status: z
    .enum(['awaitingUpload', 'reading', 'ready', 'failed'])
    .catch('ready'),
  failure: z.string().optional().catch(undefined),
  fileName: z.string().optional().catch(undefined),
  takenAt: timestamp.optional(),
  edited: z.boolean().catch(false),
});
export type ApplicationJob = z.infer<typeof ApplicationJobSchema>;

/** `users/{uid}/applications/{applicationId}`. */
export const JobApplicationSchema = z.object({
  id: z.string().min(1),
  /** Required today; read from the job once the backend reads it (doc 17). */
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

/** What `createJobApplication` takes today: a title, and the rest optional. */
export interface CreateJobApplicationRequest {
  title: string;
  company?: string;
  role?: string;
  jobDescription?: string;
  postingUrl?: string;
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
