// CV versions (delivery 2b, D69), as quadev-backend keeps them (packages/shared/src/cvVersion.ts,
// research doc 18): a new version of one of the candidate's CVs, improved in general or tailored
// to one job, made by the `cv-version` skill pack and reviewed change by change. A version keeps
// a copy of the CV's text and every change quotes it, so the text of a version is the CV's text
// with the accepted changes applied (cvVersionText). The names, limits and that function are
// mirrored here; the backend applies them again.
import { z } from 'zod';

import { APPLICATION_NAME_MAX_CHARS } from './applications';

// ---------- Limits ----------

/** Versions one user can hold, failed ones included. */
export const CV_VERSIONS_MAX = 50;
/** Versions one user can have made in a day (UTC); the backend also caps their cost. */
export const CV_DAILY_VERSIONS = 5;
/** The service name the backend counts versions under, in `usage/{uid}/days/{date}`. */
export const CV_SERVICE = 'cvVersion';
/** Longest role a general version is aimed at. */
export const CV_ROLE_MAX_CHARS = APPLICATION_NAME_MAX_CHARS;
/**
 * A version still `creating` this long after it was asked for was lost (the function stopped):
 * the page offers to remove it. Making one takes about a minute; the callable allows three.
 */
export const CV_CREATING_STALE_MS = 5 * 60_000;

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const cvVersionsPath = (uid: string, versionId?: string) =>
  `users/${uid}/cvVersions${versionId === undefined ? '' : `/${versionId}`}`;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);

export const CV_VERSION_LENGTHS = ['same', 'one-page', 'two-pages'] as const;
export type CvVersionLength = (typeof CV_VERSION_LENGTHS)[number];

export const CV_FINDING_KINDS = [
  'structure',
  'clarity',
  'results',
  'keywords',
  'parsing',
  'convention',
] as const;
export const CV_FINDING_SEVERITIES = ['high', 'medium', 'low'] as const;
export const CV_CHANGE_ACTIONS = ['rewrite', 'add', 'remove'] as const;
export const CV_CHANGE_DECISIONS = [
  'open',
  'accepted',
  'edited',
  'kept',
] as const;
export const CV_QUESTION_STATUSES = ['open', 'answered', 'skipped'] as const;
export const CV_VERSION_STATUSES = ['creating', 'ready', 'failed'] as const;
export type CvVersionStatus = (typeof CV_VERSION_STATUSES)[number];
/**
 * Why a version could not be made: no usable answer in time (`model`), the model refused the
 * content (`blocked`), the daily limit was reached meanwhile (`quota`), or something else.
 */
export const CV_VERSION_FAILURES = [
  'model',
  'blocked',
  'quota',
  'internal',
] as const;
export type CvVersionFailure = (typeof CV_VERSION_FAILURES)[number];

/** What a version is for: one application's job, or the CV in general, perhaps for a role. */
export const CvVersionTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('job'), applicationId: z.string() }),
  z.object({
    kind: z.literal('general'),
    role: z.string().optional().catch(undefined),
  }),
]);
export type CvVersionTarget = z.infer<typeof CvVersionTargetSchema>;

/** One problem of the CV for its target (FR-25): the analysis, shown first. */
export const CvFindingSchema = z.object({
  kind: z.enum(CV_FINDING_KINDS).catch('clarity'),
  severity: z.enum(CV_FINDING_SEVERITIES).catch('medium'),
  /** The passage of the CV it is about, as in `cv`; empty for the whole CV. */
  passage: z.string().catch(''),
  text: z.string(),
});
export type CvFinding = z.infer<typeof CvFindingSchema>;

/** Where the facts of a change come from: the CV itself, or one item of the skill map. */
export const CvChangeSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('cv') }),
  z.object({ kind: z.literal('item'), itemId: z.string() }),
]);
export type CvChangeSource = z.infer<typeof CvChangeSourceSchema>;

/** One proposed change. Nothing is in the version's text until the candidate accepts it. */
export const CvChangeSchema = z.object({
  id: z.string(),
  action: z.enum(CV_CHANGE_ACTIONS),
  /** `rewrite` and `remove`: the passage it changes, exactly as in `cv`. */
  original: z.string().catch(''),
  /** `add`: the passage the new line goes after, exactly as in `cv`. */
  after: z.string().catch(''),
  /** `rewrite` and `add`: the new text. */
  proposed: z.string().catch(''),
  reason: z.string().catch(''),
  sources: z.array(CvChangeSourceSchema).catch([]),
  decision: z.enum(CV_CHANGE_DECISIONS).catch('open'),
  /** `edited` only: the candidate's text, in place of `proposed`. */
  text: z.string().optional().catch(undefined),
});
export type CvChange = z.infer<typeof CvChangeSchema>;

/** A fact nobody gave, asked of the candidate instead of guessed. */
export const CvQuestionSchema = z.object({
  id: z.string(),
  passage: z.string().catch(''),
  text: z.string(),
  status: z.enum(CV_QUESTION_STATUSES).catch('open'),
  answer: z.string().optional().catch(undefined),
});
export type CvQuestion = z.infer<typeof CvQuestionSchema>;

/** `users/{uid}/cvVersions/{versionId}`, with its id. */
export const CvVersionSchema = z.object({
  id: z.string().min(1),
  target: CvVersionTargetSchema,
  /** The CV it starts from: a resource of type `cv`. It may have been removed since. */
  resourceId: z.string(),
  length: z.enum(CV_VERSION_LENGTHS).catch('same'),
  status: z.enum(CV_VERSION_STATUSES),
  failure: z.enum(CV_VERSION_FAILURES).optional().catch('internal'),
  /** The CV's text when the version was made. Every passage quotes it. */
  cv: z.string().catch(''),
  findings: z.array(CvFindingSchema).catch([]),
  changes: z.array(CvChangeSchema).catch([]),
  questions: z.array(CvQuestionSchema).catch([]),
  /** For a job: its words that the CV and the profile don't show. Never added. */
  unsupportedJobTerms: z.array(z.string()).catch([]),
  applicationRevision: z.number().optional().catch(undefined),
  profileRevision: z.number().catch(0),
  /** For a job: when the candidate marked it as the version sent. */
  sentAt: timestamp.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  readyAt: timestamp.optional(),
});
export type CvVersion = z.infer<typeof CvVersionSchema>;

// ---------- Callables of the `interview-profile` codebase ----------

export const CREATE_CV_VERSION = 'createCvVersion';
export const REMOVE_CV_VERSION = 'removeCvVersion';

/** What `createCvVersion` takes. A version is always a UK CV for now (D80). */
export interface CreateCvVersionRequest {
  resourceId: string;
  target:
    { kind: 'job'; applicationId: string } | { kind: 'general'; role?: string };
  length?: CvVersionLength;
}

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/** The answer comes at once, `creating`: the document then says how it goes (research doc 18). */
export const CreateCvVersionResponseSchema = z.object({
  versionId: documentId,
  status: z.enum(['creating', 'ready', 'failed']),
  failure: z.enum(CV_VERSION_FAILURES).optional(),
});
export const RemoveCvVersionResponseSchema = z.object({
  versionId: documentId,
});

/** `details.reason` of the `failed-precondition` refusals of `createCvVersion`. */
export const CvRefusal = {
  NotACv: 'not-a-cv',
  NoCvText: 'no-cv-text',
  MaxVersions: 'max-versions',
  NoJobDescription: 'no-job-description',
} as const;

// ---------- What the pages work out ----------

/** Changes and questions not decided yet. The download waits until there are none. */
export const openReviews = (
  version: Pick<CvVersion, 'changes' | 'questions'>,
): number =>
  version.changes.filter(({ decision }) => decision === 'open').length +
  version.questions.filter(({ status }) => status === 'open').length;

/** The version is still being made, and was not lost. */
export const isCreating = (
  version: Pick<CvVersion, 'status' | 'createdAt'>,
  now = Date.now(),
) =>
  version.status === 'creating' &&
  now - (version.createdAt ?? now) < CV_CREATING_STALE_MS;

// ---------- The text of a version (the same as the backend's cvVersionText) ----------

/** The list mark a line starts with ("- ", "• ", "* "), or an empty string. */
const listMark = (line: string): string =>
  /^\s*(?:[-•*▪◦–]\s+)/.exec(line)?.[0] ?? '';

/** The start and end of the line around `index`, without its line break. */
const lineAround = (text: string, index: number) => {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const next = text.indexOf('\n', index);
  return { start, end: next === -1 ? text.length : next };
};

/** Puts `line` on a line of its own after the line that holds `index`, with its list mark. */
const insertLineAfter = (text: string, index: number, line: string) => {
  const { start, end } = lineAround(text, index);
  const mark = listMark(text.slice(start, end));
  const body = mark && !line.startsWith(mark.trim()) ? `${mark}${line}` : line;
  return `${text.slice(0, end)}\n${body}${text.slice(end)}`;
};

const applyChange = (text: string, change: CvChange): string => {
  const line =
    (change.decision === 'edited' ? change.text : change.proposed)?.trim() ??
    '';
  if (change.action === 'add') {
    const at = text.indexOf(change.after);
    return at === -1 || !line
      ? text
      : insertLineAfter(text, at + change.after.length, line);
  }
  const at = text.indexOf(change.original);
  if (at === -1) {
    return text;
  }
  const before = text.slice(0, at);
  const after = text.slice(at + change.original.length);
  if (change.action === 'rewrite') {
    return line ? `${before}${line}${after}` : text;
  }
  // A removal of a whole line (its list mark aside) takes the line with it.
  const { start, end } = lineAround(text, at);
  const whole = text.slice(start, end);
  if (whole.slice(listMark(whole).length).trim() === change.original.trim()) {
    return end < text.length
      ? text.slice(0, start) + text.slice(end + 1)
      : text.slice(0, Math.max(0, start - 1));
  }
  // Part of a line: the words on either side join with one space, or none before punctuation.
  const head = before.replace(/[ \t]+$/, '');
  const tail = after.replace(/^[ \t]+/, '');
  const space =
    head && tail && !head.endsWith('\n') && !/^[\n.,;:)]/.test(tail) ? ' ' : '';
  return `${head}${space}${tail}`;
};

/**
 * The text of a version: its CV's text with every accepted or edited change applied, in their
 * order, and each answered question's answer on a line of its own after its passage (at the end
 * when it has none). A change whose passage is no longer there is left out. A copy of the
 * backend's function, so the download and the comparison say what the backend says.
 */
export const cvVersionText = (
  version: Pick<CvVersion, 'cv' | 'changes' | 'questions'>,
): string => {
  let text = version.cv;
  for (const change of version.changes) {
    if (change.decision === 'accepted' || change.decision === 'edited') {
      text = applyChange(text, change);
    }
  }
  for (const question of version.questions) {
    const answer =
      question.status === 'answered' ? question.answer?.trim() : undefined;
    if (!answer) {
      continue;
    }
    const at = question.passage ? text.indexOf(question.passage) : -1;
    text =
      at === -1
        ? `${text.trimEnd()}\n${answer}`
        : insertLineAfter(text, at + question.passage.length, answer);
  }
  return text;
};
