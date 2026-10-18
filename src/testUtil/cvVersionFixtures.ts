// Fictional CV versions for specs (Maya Okafor, the candidate of the designs).
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
