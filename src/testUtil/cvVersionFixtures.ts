// Fictional CV versions for specs (Maya Okafor, the candidate of the designs).
import { CV_DETAILS_FIELDS, type CvDetails } from '@/core/profile/cvDetails';
import { type CvVersion } from '@/core/profile/cvVersions';

export const CV_TEXT =
  'Maya Okafor\nExperience\n- Built reconciliation service for card transactions, approx. 2M/day.\n- Responsible for various API tasks.';

export const cvVersionFixture = (
  overrides: Partial<CvVersion> = {},
): CvVersion => ({
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
