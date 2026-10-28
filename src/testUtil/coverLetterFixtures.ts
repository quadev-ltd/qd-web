// A fictional cover letter for specs (D98): Maya Okafor's letter for the designs' Northwind job,
// one paragraph of each kind: the role (a frame), a fact of the profile with the CV it goes with,
// the reason in her words, the posting quoted, and the notice period only her draft gives.
import { type CoverLetter } from '@/core/profile/coverLetters';

export const NOTICE =
  'My notice period is four weeks, so I can start in January.';

export const coverLetterFixture = (
  overrides: Partial<CoverLetter> = {},
): CoverLetter => ({
  id: 'letter-1',
  applicationId: 'a1',
  cvVersionId: 'v1',
  convention: 'uk',
  length: { kind: 'page' },
  job: {
    role: 'Senior Backend Engineer',
    company: 'Northwind Logistics',
    reference: 'NW-2231',
  },
  why: 'Tracking parcels is like matching payments.',
  status: 'ready',
  paragraphs: [
    {
      sentences: [
        {
          id: 's1',
          text: 'I’d like to apply for the Senior Backend Engineer role.',
          kind: 'frame',
          sources: [],
          state: 'written',
          proposed: 'I’d like to apply for the Senior Backend Engineer role.',
        },
        {
          id: 's2',
          text: 'I moved the payments ledger to event sourcing.',
          kind: 'fact',
          sources: [{ kind: 'item', itemId: 'item-1' }, { kind: 'cv' }],
          state: 'written',
          proposed: 'I moved the payments ledger to event sourcing.',
        },
      ],
    },
    {
      sentences: [
        {
          id: 's3',
          text: 'Tracking parcels is like matching payments.',
          kind: 'fact',
          sources: [
            { kind: 'statement', id: 'W1' },
            { kind: 'job', quote: 'Two million parcels a day.' },
          ],
          state: 'written',
          proposed: 'Tracking parcels is like matching payments.',
        },
        {
          id: 's4',
          text: NOTICE,
          kind: 'fact',
          sources: [{ kind: 'statement', id: 'D1' }],
          state: 'written',
          proposed: NOTICE,
          draftOnly: [{ text: 'four weeks', at: 20 }],
          proposedDraftOnly: [{ text: 'four weeks', at: 20 }],
        },
      ],
    },
    {
      sentences: [
        {
          id: 's5',
          text: 'I would welcome the chance to talk about the role.',
          kind: 'frame',
          sources: [],
          state: 'written',
          proposed: 'I would welcome the chance to talk about the role.',
        },
      ],
    },
  ],
  notes: ['Led with your ledger move.', 'Wrote “Dear Hiring Manager”.'],
  outcomes: [],
  questions: [{ id: 'q1', text: 'Who will read it?', status: 'open' }],
  statements: [
    {
      id: 'W1',
      kind: 'why',
      text: 'Tracking parcels is like matching payments.',
    },
    { id: 'D1', kind: 'draft', text: 'my notice is 4 weeks' },
  ],
  createdAt: Date.parse('2026-10-27T10:00:00Z'),
  updatedAt: Date.parse('2026-10-27T10:01:00Z'),
  readyAt: Date.parse('2026-10-27T10:01:00Z'),
  ...overrides,
});
