// A CV written from the profile (research doc 19, D83): the document a written version keeps,
// and the functions that print it. A copy of quadev-backend's packages/shared/src/cvDocument.ts
// (as of d5d1146), with zod schemas to read the document, so the website's text, compare and
// download say what the backend's says. Its spec copies the backend's fixtures.
import { z } from 'zod';

import { type CvVersionConvention } from './cvVersions';

/** How many words fill one A4 page of the download: the length check and the layout aim at this number. */
export const CV_WORDS_PER_PAGE = 500;

/** How long a written CV should be. */
export const CV_PAGE_COUNTS = [1, 2] as const;
export type CvPageCount = (typeof CV_PAGE_COUNTS)[number];

/** The sections of a written CV, in the order they are printed. */
export const CV_SECTION_KEYS = [
  'summary',
  'experience',
  'projects',
  'skills',
  'education',
  'certifications',
  'languages',
] as const;
export type CvSectionKey = (typeof CV_SECTION_KEYS)[number];

/** The heading printed above each section. */
export const CV_SECTION_HEADINGS: Readonly<Record<CvSectionKey, string>> = {
  summary: 'Profile',
  experience: 'Experience',
  projects: 'Projects',
  skills: 'Skills',
  education: 'Education',
  certifications: 'Certifications',
  languages: 'Languages',
};

// ---------- The written CV a version keeps ----------

/** Where a line's facts come from: one item of the skill map, or one of the candidate's statements. */
export const CvLineSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('item'), itemId: z.string() }),
  z.object({ kind: z.literal('statement'), id: z.string() }),
]);
export type CvLineSource = z.infer<typeof CvLineSourceSchema>;

/**
 * `written`: as the writer gave it. `edited`: in the candidate's words (they are its source).
 * `removed`: taken out by the candidate; kept so it can be restored, and left out of the text.
 */
export const CV_LINE_STATES = ['written', 'edited', 'removed'] as const;
export type CvLineState = (typeof CV_LINE_STATES)[number];

/** Sources the website does not know are left out, not the line. */
const sources = z
  .array(z.unknown())
  .catch([])
  .transform(values =>
    values.flatMap(value => {
      const parsed = CvLineSourceSchema.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    }),
  );

/** One line: a sentence of the profile, a bullet, a skill group, an education, certification or language line. */
export const CvLineSchema = z.object({
  /** `l1`, `l2`, ...: unique in the whole document. */
  id: z.string(),
  text: z.string(),
  /** Skills only: the group's label ("Cloud and infrastructure"). */
  label: z.string().optional().catch(undefined),
  sources,
  state: z.enum(CV_LINE_STATES).catch('written'),
  /** The writer's text, kept to undo an edit. */
  proposed: z.string().catch(''),
});
export type CvLine = z.infer<typeof CvLineSchema>;

/** The fields of a role's or a project's heading. Every one is a string, empty when unknown, as written. */
export const CvEntryFieldsSchema = z.object({
  title: z.string().catch(''),
  organisation: z.string().catch(''),
  location: z.string().catch(''),
  start: z.string().catch(''),
  end: z.string().catch(''),
});
export type CvEntryFields = z.infer<typeof CvEntryFieldsSchema>;

/** One role or one project, with its bullets. */
export const CvEntrySchema = CvEntryFieldsSchema.extend({
  /** `e1`, `e2`, ...: unique across the experience and the projects. */
  id: z.string(),
  sources,
  state: z.enum(CV_LINE_STATES).catch('written'),
  /** The writer's heading, kept to undo an edit. */
  proposedFields: CvEntryFieldsSchema.catch({
    title: '',
    organisation: '',
    location: '',
    start: '',
    end: '',
  }),
  bullets: z.array(CvLineSchema).catch([]),
});
export type CvEntry = z.infer<typeof CvEntrySchema>;

/** A whole CV without its header, in the order of {@link CV_SECTION_KEYS}. */
export const CvDocumentSchema = z.object({
  summary: z.array(CvLineSchema).catch([]),
  experience: z.array(CvEntrySchema).catch([]),
  projects: z.array(CvEntrySchema).catch([]),
  skills: z.array(CvLineSchema).catch([]),
  education: z.array(CvLineSchema).catch([]),
  certifications: z.array(CvLineSchema).catch([]),
  languages: z.array(CvLineSchema).catch([]),
});
export type CvDocument = z.infer<typeof CvDocumentSchema>;

/** The details the header is drawn from: the candidate's CV details as they are now (`details/cv`). */
export interface CvHeaderDetails {
  name?: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  rightToWork?: string;
  links?: string[];
}

/** Joins the parts of one header line. */
export const CV_HEADER_SEPARATOR = ' · ';

/**
 * The title of the entry that holds the roles a written CV keeps to one line each (cv-write
 * 1.1.0): the experience's last entry, with no organisation and no dates, whose bullets are
 * "Title, Organisation, start – end".
 */
export const CV_EARLIER_CAREER_TITLE = 'Earlier career';

/** The hosts whose links keep a query: an app store's, for the app's id. */
const STORE_QUERY: Readonly<Record<string, string>> = {
  'play.google.com': 'id',
};

/**
 * A link as printed: "https://play.google.com/store/apps/details?id=com.qdmobile&gl=UK" as
 * "play.google.com/store/apps/details?id=com.qdmobile". No scheme, no "www.", no fragment, no
 * trailing "/", and no query but an app store's id. Never cut short, so a label stays one link.
 */
export const cvLinkLabel = (link: string): string => {
  const text = link
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/#.*$/, '');
  const at = text.indexOf('?');
  const path = (at === -1 ? text : text.slice(0, at)).replace(/\/$/, '');
  const host = path.split('/')[0]?.toLowerCase() ?? '';
  const kept = STORE_QUERY[host];
  const value =
    kept && at !== -1
      ? new URLSearchParams(text.slice(at + 1)).get(kept)
      : null;
  return value ? `${path}?${kept}=${value}` : path;
};

/** What the right to work is printed after, for a UK CV (D80). */
export const CV_RIGHT_TO_WORK_LABEL = 'Right to work in the UK';

/**
 * The right to work as printed: "Right to work in the UK: British citizen". A value that already
 * says what it is ("Full right to work in the UK", "Skilled Worker visa until 2028") is printed as
 * it is, so nothing is said twice.
 */
export const cvRightToWorkLine = (value: string | undefined): string => {
  const text = value?.trim() ?? '';
  if (!text) {
    return '';
  }
  return /right to work|visa|permit|sponsor/i.test(text)
    ? text
    : `${CV_RIGHT_TO_WORK_LABEL}: ${text}`;
};

/**
 * The lines at the top of a written CV: the name, the headline, the location, phone and email on
 * one line, the links on one line, and the right to work. Empty lines are left out; no details
 * give no header. The right to work is the UK's, so only a `uk` CV shows it (D86); without a
 * convention, it is shown.
 */
export const cvHeaderLines = (
  details: CvHeaderDetails | undefined | null,
  convention?: CvVersionConvention,
): string[] => {
  const join = (parts: (string | undefined)[]) =>
    parts
      .map(part => part?.trim() ?? '')
      .filter(Boolean)
      .join(CV_HEADER_SEPARATOR);
  return [
    details?.name?.trim() ?? '',
    details?.headline?.trim() ?? '',
    join([details?.location, details?.phone, details?.email]),
    join((details?.links ?? []).map(cvLinkLabel)),
    convention === undefined || convention === 'uk'
      ? cvRightToWorkLine(details?.rightToWork)
      : '',
  ].filter(Boolean);
};

/** The lines of a section that are not removed. */
const shown = (lines: readonly CvLine[]): CvLine[] =>
  lines.filter(line => line.state !== 'removed');

/** A role's heading as printed: "Title, Organisation, Location | start – end", leaving out what is empty. */
export const cvEntryHeading = (entry: CvEntryFields): string => {
  const what = [entry.title, entry.organisation, entry.location]
    .map(part => part.trim())
    .filter(Boolean)
    .join(', ');
  const when = [entry.start, entry.end]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' – ');
  return [what, when].filter(Boolean).join(' | ');
};

/** A line as printed: a skill group as "Label: skills". */
export const cvLineText = (line: CvLine): string =>
  line.label?.trim() ? `${line.label.trim()}: ${line.text}` : line.text;

/** The lines of each section as printed, without the header and the headings. */
const sectionLines = (document: CvDocument, key: CvSectionKey): string[] => {
  switch (key) {
    case 'summary':
      return shown(document.summary).length > 0
        ? [shown(document.summary).map(cvLineText).join(' ')]
        : [];
    case 'experience':
    case 'projects':
      return document[key]
        .filter(entry => entry.state !== 'removed')
        .flatMap((entry, index) => [
          ...(index > 0 ? [''] : []),
          cvEntryHeading(entry),
          ...shown(entry.bullets).map(line => `- ${line.text}`),
        ]);
    default:
      return shown(document[key]).map(cvLineText);
  }
};

/**
 * The plain text of a written CV: the header ({@link cvHeaderLines}), then each section that
 * has something, with its heading in capitals. The profile is one paragraph; a role is its
 * heading and its bullets ("- "); a skill group is "Label: skills". Removed lines and roles are
 * left out, edited ones are in the candidate's words.
 */
export const cvDocumentText = (
  document: CvDocument,
  details?: CvHeaderDetails | null,
  convention?: CvVersionConvention,
): string => {
  const blocks = [cvHeaderLines(details, convention).join('\n')];
  for (const key of CV_SECTION_KEYS) {
    const lines = sectionLines(document, key);
    if (lines.length > 0) {
      blocks.push(
        [CV_SECTION_HEADINGS[key].toUpperCase(), ...lines].join('\n'),
      );
    }
  }
  return blocks.filter(Boolean).join('\n\n');
};

/** The words of a written CV as printed, header aside. */
export const cvDocumentWords = (document: CvDocument): number =>
  // A word starts with a letter or a digit; "1,200", "p95", "C#" and "open-source" are one word each.
  cvDocumentText(document).match(/[\p{L}\p{N}][\p{L}\p{N}'’+#.,-]*/gu)
    ?.length ?? 0;

/** How many A4 pages the CV fills, to one decimal ({@link CV_WORDS_PER_PAGE} words a page). */
export const cvDocumentPages = (document: CvDocument): number =>
  Math.round((cvDocumentWords(document) / CV_WORDS_PER_PAGE) * 10) / 10;

/** Every line of a document, in order, with the entry it belongs to. */
export const cvDocumentLines = (
  document: CvDocument,
): { line: CvLine; entry?: CvEntry }[] =>
  CV_SECTION_KEYS.flatMap(key => {
    if (key === 'experience' || key === 'projects') {
      return document[key].flatMap(entry =>
        entry.bullets.map(line => ({ line, entry })),
      );
    }
    return document[key].map(line => ({ line }));
  });
