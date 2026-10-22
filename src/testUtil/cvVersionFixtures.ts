// Fictional CV versions for specs (Maya Okafor, the candidate of the designs).
import { CV_DETAILS_FIELDS, type CvDetails } from '@/core/profile/cvDetails';
import { type CvDocument, type CvLine } from '@/core/profile/cvDocument';
import {
  type CvEditVersion,
  type CvWrittenVersion,
} from '@/core/profile/cvVersions';

export const CV_TEXT =
  'Maya Okafor\nExperience\n- Built reconciliation service for card transactions, approx. 2M/day.\n- Responsible for various API tasks.';

export const cvVersionFixture = (
  overrides: Partial<CvEditVersion> = {},
): CvEditVersion => ({
  id: 'v1',
  target: { kind: 'job', applicationId: 'a1' },
  resourceId: 'r1',
  length: 'same',
  status: 'ready',
  cv: CV_TEXT,
  findings: [],
  changes: [
    {
      id: 'c1',
      action: 'rewrite',
      original:
        'Built reconciliation service for card transactions, approx. 2M/day.',
      after: '',
      proposed:
        'Built the reconciliation service that matches two million card transactions a day.',
      reason: 'Reads as a full sentence, with the number written out.',
      sources: [{ kind: 'cv' }],
      decision: 'open',
    },
  ],
  questions: [
    {
      id: 'q1',
      passage: 'Responsible for various API tasks.',
      text: 'What did these tasks lead to?',
      status: 'open',
    },
  ],
  unsupportedJobTerms: [],
  profileRevision: 3,
  createdAt: Date.parse('2026-10-14T10:00:00Z'),
  updatedAt: Date.parse('2026-10-14T10:01:00Z'),
  ...overrides,
});

/** The CV's details as a CV read fills them: every field from the resource `r1`. */
export const cvDetailsFixture = (
  overrides: Partial<CvDetails> = {},
): CvDetails => ({
  name: 'Maya Okafor',
  headline: 'Senior Backend Engineer',
  email: 'maya.okafor@example.com',
  phone: '07700 900123',
  location: 'London, UK',
  rightToWork: 'British citizen',
  links: [
    'linkedin.com/in/maya-okafor-example',
    'github.com/maya-okafor-example',
  ],
  edited: [],
  sources: Object.fromEntries(
    CV_DETAILS_FIELDS.map(field => [field, 'r1']),
  ) as CvDetails['sources'],
  updatedAt: 1_500,
  ...overrides,
});

const writtenLine = (
  id: string,
  text: string,
  overrides: Partial<CvLine> = {},
): CvLine => ({
  id,
  text,
  sources: [{ kind: 'item', itemId: 'i1' }],
  state: 'written',
  proposed: text,
  ...overrides,
});

/** A written CV (D83): a profile, one role with two bullets, skills, education and a language. */
export const writtenDocumentFixture = (): CvDocument => {
  const heading = {
    title: 'Senior Backend Engineer',
    organisation: 'Fenwick Pay',
    location: 'London',
    start: '2021',
    end: '2026',
  };
  return {
    summary: [
      writtenLine(
        'l1',
        'Backend engineer who designs and runs Go services in production.',
      ),
    ],
    experience: [
      {
        id: 'e1',
        ...heading,
        sources: [{ kind: 'item', itemId: 'i1' }],
        state: 'written',
        proposedFields: heading,
        bullets: [
          writtenLine(
            'l2',
            'Moved the payments ledger to event sourcing; payment incidents fell 40%.',
          ),
          writtenLine('l3', 'Led the on-call redesign for a team of nine.', {
            sources: [{ kind: 'statement', id: 'A1' }],
          }),
        ],
      },
    ],
    projects: [],
    skills: [
      writtenLine('l4', 'Go · PostgreSQL · Java', {
        label: 'Languages and data',
      }),
    ],
    education: [writtenLine('l5', 'BSc Computer Science · 2015')],
    certifications: [],
    languages: [writtenLine('l6', 'English, native')],
  };
};

/** A written version for the job `a1`, ready, with two notes, a question and a line left out. */
export const writtenVersionFixture = (
  overrides: Partial<CvWrittenVersion> = {},
): CvWrittenVersion => ({
  id: 'w1',
  mode: 'write',
  target: { kind: 'job', applicationId: 'a1' },
  convention: 'uk',
  pages: 2,
  status: 'ready',
  document: writtenDocumentFixture(),
  notes: [
    'Put your ledger work first: the job is about running Go services.',
    'Kafka isn’t in your profile, so it isn’t in your CV.',
  ],
  questions: [
    {
      id: 'q1',
      lineId: 'l2',
      text: 'Have you run Kafka at high volume?',
      status: 'open',
    },
  ],
  unsupportedJobTerms: ['running Kafka at scale'],
  statements: [
    {
      id: 'A1',
      kind: 'answer',
      question: 'How large was the team?',
      text: 'Nine engineers.',
    },
  ],
  dropped: { lines: 1, numbers: 1, names: 0 },
  profileRevision: 3,
  createdAt: Date.parse('2026-10-15T10:00:00Z'),
  updatedAt: Date.parse('2026-10-15T10:01:00Z'),
  ...overrides,
});
