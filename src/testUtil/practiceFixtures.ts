// Fictional practice turns for specs (D94): a question of the designs' technical interview.
import { type PracticeTurn } from '@/core/profile/practice';

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
