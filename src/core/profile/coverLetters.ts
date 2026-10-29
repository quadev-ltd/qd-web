// Cover letters (D98, research doc 22): a letter written for one application from the profile, the
// job and the CV it goes with, every fact sentence naming its sources. The header, the greeting and
// the sign-off are never written by the model: they come from the CV details, whom it is to and the
// convention. A copy of quadev-backend's packages/shared/src/coverLetter.ts (as of e15940b), with
// zod schemas to read the documents; its text functions are the backend's, so the copied text, the
// downloads and a form's box counter say what the backend's do. Its spec copies the backend's
// fixtures.
import { z } from 'zod';

import { CV_LINE_STATES } from './cvDocument';
import {
  CV_ASKED_MAX_CHARS,
  CV_ASKED_OUTCOMES,
  CV_QUESTION_STATUSES,
  CV_VERSION_CONVENTIONS,
  CV_VERSION_FAILURES,
  type CvVersionConvention,
} from './cvVersions';

// ---------- Limits ----------

/** Letters one user can hold, failed ones included. */
export const COVER_LETTERS_MAX = 50;
/** "Why this job?" and what the candidate asks of a letter (D97). */
export const COVER_LETTER_WHY_MAX_CHARS = 1_000;
export const COVER_LETTER_ASKED_MAX_CHARS = CV_ASKED_MAX_CHARS;
/** The candidate's draft, and the whole letter as they save it. */
export const COVER_LETTER_DRAFT_MAX_CHARS = 5_000;
export const COVER_LETTER_TEXT_MAX_CHARS = 10_000;
/** Who the letter is to, as long as a contact read from a posting. */
export const COVER_LETTER_ADDRESSEE_MAX_CHARS = 120;
/** The characters a form's box may hold. */
export const COVER_LETTER_BOX_MIN_CHARS = 300;
export const COVER_LETTER_BOX_MAX_CHARS = 10_000;
/** What "Most characters the box takes" starts at (canvas version 55, Web-L1-New-Box). */
export const COVER_LETTER_BOX_DEFAULT_CHARS = 1_500;
/** Longest sentence, note, outcome, question or answer kept. */
export const COVER_LETTER_SENTENCE_MAX_CHARS = 800;
/** The words a short letter and a one-page letter aim at. */
export const COVER_LETTER_WORDS = { short: 150, page: 300 } as const;

export const COVER_LETTER_DRAFT_MODES = ['polish', 'rewrite'] as const;
export type CoverLetterDraftMode = (typeof COVER_LETTER_DRAFT_MODES)[number];

/** `details.reason` of the letter callables' refusals, besides the CV's job ones. */
export const CoverLetterRefusal = {
  MaxLetters: 'max-letters',
  /** The letter is being written, or could not be: nothing in it can change. */
  NotReady: 'not-ready',
  /** A letter needs a profile with visible items, or a draft. */
  NoItems: 'no-items',
  /** The CV it is to go with is being made, or could not be. */
  CvNotReady: 'cv-not-ready',
  /** `restoreCoverLetterText` on a letter never saved with "Save my version". */
  NotSaved: 'not-saved',
} as const;

// ---------- Firestore (the owner reads, only the backend writes) ----------

export const coverLettersPath = (uid: string, letterId?: string) =>
  `users/${uid}/coverLetters${letterId === undefined ? '' : `/${letterId}`}`;

/** Milliseconds since the epoch; the Firebase layer turns Firestore Timestamps into them. */
const timestamp = z.number().nullable().catch(null);
const optionalText = z.string().min(1).optional().catch(undefined);

export const CoverLetterLengthSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('short') }),
  z.object({ kind: z.literal('page') }),
  z.object({ kind: z.literal('box'), maxChars: z.number().int().positive() }),
]);
export type CoverLetterLength = z.infer<typeof CoverLetterLengthSchema>;

/** Where a sentence's facts come from. A source the page doesn't know is left out. */
export const CoverLetterSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), itemId: z.string().min(1) }),
  z.object({ kind: z.literal('statement'), id: z.string().min(1) }),
  /** "From the job posting", with its words when the backend found them in the job's text. */
  z.object({ kind: z.literal('job'), quote: optionalText }),
  z.object({ kind: z.literal('cv') }),
]);
export type CoverLetterSource = z.infer<typeof CoverLetterSourceSchema>;

/** A number only the draft gives: `text.slice(at, at + mark.text.length)` is it (UTF-16 units). */
export const CoverLetterMarkSchema = z.object({
  text: z.string().min(1),
  at: z.number().int().nonnegative(),
});
export type CoverLetterMark = z.infer<typeof CoverLetterMarkSchema>;

const listOf = <T extends z.ZodType>(schema: T) =>
  z
    .array(z.unknown())
    .catch([])
    .transform(values =>
      values.flatMap(value => {
        const parsed = schema.safeParse(value);
        return parsed.success ? [parsed.data as z.infer<T>] : [];
      }),
    );

export const CoverLetterSentenceSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  kind: z.enum(['fact', 'frame']).catch('fact'),
  sources: listOf(CoverLetterSourceSchema),
  state: z.enum(CV_LINE_STATES).catch('written'),
  proposed: z.string().catch(''),
  draftOnly: listOf(CoverLetterMarkSchema).optional(),
  proposedDraftOnly: listOf(CoverLetterMarkSchema).optional(),
});
export type CoverLetterSentence = z.infer<typeof CoverLetterSentenceSchema>;

export const CoverLetterParagraphSchema = z.object({
  sentences: listOf(CoverLetterSentenceSchema),
});
export type CoverLetterParagraph = z.infer<typeof CoverLetterParagraphSchema>;

/** Something the candidate said that a sentence may cite: W… why, N… asked, D… draft, A… answer or edit. */
export const CoverLetterStatementSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['why', 'note', 'draft', 'answer', 'edit']),
  question: optionalText,
  text: z.string(),
});
export type CoverLetterStatement = z.infer<typeof CoverLetterStatementSchema>;

export const CoverLetterOutcomeSchema = z.object({
  about: z.enum(['asked', 'draft']),
  outcome: z.enum(CV_ASKED_OUTCOMES),
  text: z.string().min(1),
});
export type CoverLetterOutcome = z.infer<typeof CoverLetterOutcomeSchema>;

export const CoverLetterQuestionSchema = z.object({
  id: z.string().min(1),
  sentenceId: optionalText,
  text: z.string().min(1),
  status: z.enum(CV_QUESTION_STATUSES).catch('open'),
  answer: optionalText,
});
export type CoverLetterQuestion = z.infer<typeof CoverLetterQuestionSchema>;

/** `users/{uid}/coverLetters/{letterId}`. */
export const CoverLetterSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  /** Absent for "No CV". The letter stays when that CV is removed. */
  cvVersionId: optionalText,
  convention: z.enum(CV_VERSION_CONVENTIONS).catch('international'),
  length: CoverLetterLengthSchema.catch({ kind: 'page' }),
  /** As "To" was left; absent for "Hiring Manager". */
  addressee: optionalText,
  job: z
    .object({
      role: optionalText,
      company: optionalText,
      reference: optionalText,
    })
    .catch({}),
  why: optionalText,
  asked: optionalText,
  draft: z
    .object({
      text: z.string().min(1),
      mode: z.enum(COVER_LETTER_DRAFT_MODES).catch('polish'),
    })
    .optional()
    .catch(undefined),
  status: z.enum(['creating', 'ready', 'failed']),
  failure: z.enum(CV_VERSION_FAILURES).optional().catch(undefined),
  plan: z
    .object({
      requirements: z.array(z.string()).catch([]),
      story: z.string().catch(''),
    })
    .optional()
    .catch(undefined),
  /** The body, once ready; after "Save my version", the candidate's text. */
  paragraphs: listOf(CoverLetterParagraphSchema).optional(),
  /** After "Save my version" only: the letter as written, which "Restore the written letter" puts back. */
  writtenParagraphs: listOf(CoverLetterParagraphSchema).optional(),
  notes: z.array(z.string()).catch([]),
  outcomes: listOf(CoverLetterOutcomeSchema),
  questions: listOf(CoverLetterQuestionSchema),
  statements: listOf(CoverLetterStatementSchema),
  rewrittenFrom: optionalText,
  /** Milliseconds; set when the candidate marked it as the letter sent. */
  sentAt: timestamp.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
  readyAt: timestamp.optional(),
  savedAt: timestamp.optional(),
});
export type CoverLetter = z.infer<typeof CoverLetterSchema>;

export const isLetterSaved = (letter: Pick<CoverLetter, 'writtenParagraphs'>) =>
  letter.writtenParagraphs !== undefined;

/** Questions of a letter the candidate has not answered or skipped. They hold nothing back. */
export const openLetterQuestions = (
  letter: Pick<CoverLetter, 'questions'>,
): number =>
  letter.questions.filter(question => question.status === 'open').length;

// ---------- The text of a letter (the backend's own functions) ----------

/** The sign-off of each convention. */
export const COVER_LETTER_SIGN_OFFS: Readonly<
  Record<CvVersionConvention, string>
> = {
  uk: 'Yours sincerely,',
  us: 'Sincerely,',
  international: 'Kind regards,',
};

/** Whom a letter greets when it names nobody. */
export const COVER_LETTER_NOBODY = 'Hiring Manager';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** A date as a letter writes it, from its local day: "27 October 2026", or "October 27, 2026" in the US. */
export const coverLetterDate = (
  date: Date,
  convention: CvVersionConvention,
): string => {
  const [day, month, year] = [
    date.getDate(),
    MONTHS[date.getMonth()],
    date.getFullYear(),
  ];
  return convention === 'us'
    ? `${month} ${day}, ${year}`
    : `${day} ${month} ${year}`;
};

/** "Dear " and what "To" holds before its first comma, or "Dear Hiring Manager,". No title is guessed. */
export const coverLetterGreeting = (addressee: string | undefined): string => {
  const name = (addressee ?? '').split(',')[0].replaceAll(/\s+/g, ' ').trim();
  return `Dear ${name || COVER_LETTER_NOBODY},`;
};

const shownSentences = (paragraph: CoverLetterParagraph) =>
  paragraph.sentences.filter(sentence => sentence.state !== 'removed');

/**
 * The body: the sentences not removed, joined by a space, and the paragraphs by a blank line; a
 * paragraph with nothing left is left out. What "Edit the whole letter" opens.
 */
export const coverLetterBody = (
  paragraphs: readonly CoverLetterParagraph[],
): string =>
  paragraphs
    .map(paragraph =>
      shownSentences(paragraph)
        .map(sentence => sentence.text.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join('\n\n');

/** The CV details a letter's heading and signature use. */
export interface CoverLetterDetails {
  name?: string;
  location?: string;
  email?: string;
  phone?: string;
}

/**
 * The plain text of a letter, for "Copy the text", the downloads and a form's box: a one-page
 * letter's heading (the details on one line, the date when given, whom it is to with the company,
 * the role with its reference), then the greeting, the body, the sign-off and the name. A short
 * letter and a form's box have no heading. Marks of numbers only the draft gives are plain text.
 */
export const coverLetterText = (
  letter: Pick<
    CoverLetter,
    'convention' | 'length' | 'addressee' | 'job' | 'paragraphs'
  >,
  details?: CoverLetterDetails | null,
  options: { date?: Date } = {},
): string => {
  const join = (parts: (string | undefined)[], separator: string) =>
    parts
      .map(part => part?.replaceAll(/\s+/g, ' ').trim() ?? '')
      .filter(Boolean)
      .join(separator);
  const name = details?.name?.replaceAll(/\s+/g, ' ').trim() ?? '';
  const blocks: string[] = [];
  if (letter.length.kind === 'page') {
    const { role, company, reference } = letter.job;
    const job = join(
      [
        role,
        reference
          ? role
            ? `(ref. ${reference.trim()})`
            : `Ref. ${reference.trim()}`
          : '',
      ],
      ' ',
    );
    blocks.push(
      [
        join([name, details?.location, details?.email, details?.phone], ' · '),
        options.date ? coverLetterDate(options.date, letter.convention) : '',
        join([letter.addressee || COVER_LETTER_NOBODY, company], ', '),
        job,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }
  blocks.push(
    coverLetterGreeting(letter.addressee),
    coverLetterBody(letter.paragraphs ?? []),
  );
  blocks.push(
    [COVER_LETTER_SIGN_OFFS[letter.convention], name]
      .filter(Boolean)
      .join('\n'),
  );
  return blocks.filter(Boolean).join('\n\n');
};

/** The length as a form's box counts it: UTF-16 code units, a line break as 1. */
export const coverLetterLength = (text: string): number =>
  text.replaceAll('\r\n', '\n').length;

/** The words of a text: "1,200", "p95" and "event-driven" are one word each. */
export const coverLetterWords = (text: string): number =>
  text.match(/[\p{L}\p{N}][\p{L}\p{N}'’+#.,-]*/gu)?.length ?? 0;

// ---------- Callables of the `interview-profile` codebase ----------

export const CREATE_COVER_LETTER = 'createCoverLetter';
export const REWRITE_COVER_LETTER = 'rewriteCoverLetter';
export const REVISE_COVER_LETTER_SENTENCE = 'reviseCoverLetterSentence';
export const ANSWER_COVER_LETTER_QUESTION = 'answerCoverLetterQuestion';
export const MARK_COVER_LETTER_SENT = 'markCoverLetterSent';
export const REMOVE_COVER_LETTER = 'removeCoverLetter';
export const SAVE_COVER_LETTER_TEXT = 'saveCoverLetterText';
export const RESTORE_COVER_LETTER_TEXT = 'restoreCoverLetterText';

/** "New cover letter" as the panel sends it: only what is set. */
export interface CreateCoverLetterRequest {
  applicationId: string;
  /** Absent for "No CV". */
  cvVersionId?: string;
  convention?: CvVersionConvention;
  length?: CoverLetterLength;
  /** What "To" shows; absent for "Hiring Manager". */
  addressee?: string;
  why?: string;
  asked?: string;
  draft?: { text: string; mode?: CoverLetterDraftMode };
}

/** A sentence revised: edited in the candidate's words (`text` with `edit` only), removed, or restored. */
export type ReviseCoverLetterSentenceRequest =
  { action: 'edit'; text: string } | { action: 'remove' | 'restore' };

/**
 * "Write this letter again": `asked` is what the panel shows (empty: nothing); `draft` is "Improve
 * my version", the candidate's text polished in place of the letter's draft.
 */
export interface RewriteCoverLetterRequest {
  asked?: string;
  draft?: string;
}

const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const AnswerCoverLetterQuestionResponseSchema = z.object({
  letterId: documentId,
  open: z.number().int().nonnegative(),
});

export const CoverLetterCreatingResponseSchema = z.object({
  letterId: documentId,
  status: z.literal('creating'),
});
export const CoverLetterResponseSchema = z.object({ letterId: documentId });
export const MarkCoverLetterSentResponseSchema = z.object({
  letterId: documentId,
  unmarked: z.number().int().nonnegative(),
});
