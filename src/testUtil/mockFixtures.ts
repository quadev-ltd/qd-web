// A mock interview as the pages read it (D100): over, one answer with its feedback ready.
import {
  type MockSession,
  MockSessionSchema,
} from '@/core/profile/mockInterviews';

export const mockSessionFixture = (
  overrides: Record<string, unknown> = {},
): MockSession =>
  MockSessionSchema.parse({
    id: 's1',
    applicationId: 'a1',
    application: {
      title: 'Senior Backend Engineer',
      company: 'Northwind Logistics',
    },
    interviewId: 'i1',
    interview: { name: 'Technical interview', type: 'technical' },
    way: 'real-time',
    lengthMinutes: 20,
    voice: 'gemini',
    status: 'ended',
    endReason: 'finished',
    plan: {
      questions: [
        {
          id: 'p1',
          text: 'Tell me about yourself.',
          rephrased: '',
          kind: 'role',
        },
      ],
    },
    turns: [
      {
        id: 't1',
        kind: 'planned',
        planId: 'p1',
        question: 'Tell me about yourself.',
        status: 'answered',
        answer: {
          transcript: 'I build payment systems.',
          spokenMs: 31_000,
          words: 4,
        },
        repeats: 0,
        askedAt: Date.parse('2026-10-27T19:06:00Z'),
        answeredAt: Date.parse('2026-10-27T19:07:00Z'),
      },
    ],
    answerFeedback: {
      t1: {
        status: 'ready',
        feedback: {
          covered: ['You named your team.'],
          missing: [],
          structure: '',
          clarity: '',
          suggestions: ['Say what was at stake.'],
        },
      },
    },
    startedAt: Date.parse('2026-10-27T19:05:00Z'),
    endedAt: Date.parse('2026-10-27T19:23:00Z'),
    pausedAt: null,
    pausedMs: 0,
    createdAt: Date.parse('2026-10-27T19:05:00Z'),
    updatedAt: Date.parse('2026-10-27T19:23:00Z'),
    ...overrides,
  });
