// Fictional practice turns for specs (D94): a question of the designs' technical interview, and
// an answer to it with its feedback (Web-X7-Practise-Feedback).
import {
  type PracticeAttempt,
  type PracticeTurn,
} from '@/core/profile/practice';

export const PRACTICE_ANSWER =
  'Last March card payments started failing for about 8% of our customers on a Friday evening. I was on call, so I opened an incident, pulled in the database owner, and we traced it to a migration that had locked a table. We rolled it back within 40 minutes.';

export const practiceAttemptFixture = (
  overrides: Partial<PracticeAttempt> = {},
): PracticeAttempt => ({
  answer: PRACTICE_ANSWER,
  feedback: {
    covered: [
      'You led it from the alert: you opened the incident and brought in the right person.',
    ],
    missing: [
      'Your bigger result on incidents: the ledger move that cut them by 40%.',
    ],
    structure: 'Situation, action and result are there, in order.',
    clarity: 'About 40 seconds when spoken, which suits a first answer.',
    suggestions: [
      'Start with what was at stake: 8% of customers couldn’t pay.',
    ],
    example:
      'On a Friday evening last March, card payments started failing for 8% of our customers. I was on call, so I led the incident.',
  },
  at: Date.parse('2026-10-25T10:42:00Z'),
  ...overrides,
});

export const practiceTurnFixture = (
  overrides: Partial<PracticeTurn> = {},
): PracticeTurn => ({
  id: 'turn-1',
  applicationId: 'a1',
  application: {
    title: 'Senior Backend Engineer',
    company: 'Northwind Logistics',
  },
  interviewId: 'i1',
  interview: { name: 'Technical interview', type: 'technical' },
  question: {
    text: 'Tell me about an incident you led from alert to fix.',
    kind: 'behavioural',
    source: 'interview',
    listId: 'list-1',
    questionId: 'q1',
  },
  keyPoints: [
    { text: 'Payments migration: 40% fewer incidents', itemId: 'item-1' },
    { text: 'The on-call redesign', itemId: 'item-gone' },
    { text: 'Say what you changed afterwards.' },
  ],
  attempts: [],
  createdAt: Date.parse('2026-10-25T10:00:00Z'),
  updatedAt: Date.parse('2026-10-25T10:00:00Z'),
  ...overrides,
});
