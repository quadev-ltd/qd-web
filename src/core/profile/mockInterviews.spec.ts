import {
  isMockIdle,
  MOCK_IDLE_MS,
  mockProgress,
  MockSessionSchema,
} from './mockInterviews';

/** A session as the Firebase layer gives it: Timestamps already in milliseconds. */
const stored = (overrides: Record<string, unknown> = {}) =>
  MockSessionSchema.parse({
    id: 's1',
    applicationId: 'a1',
    application: { title: 'Senior Backend Engineer' },
    interviewId: 'i1',
    interview: { name: 'Technical interview', type: 'technical' },
    way: 'take-turns',
    lengthMinutes: 10,
    voice: 'gemini',
    status: 'active',
    plan: {
      questions: [
        {
          id: 'p1',
          text: 'Tell me about yourself.',
          rephrased: 'Who are you?',
          kind: 'role',
        },
        {
          id: 'p2',
          text: 'An incident you led?',
          rephrased: 'A fire you put out?',
          kind: 'behavioural',
        },
        { nothing: 'readable' },
      ],
    },
    turns: [
      {
        id: 't1',
        kind: 'planned',
        planId: 'p1',
        question: 'Tell me about yourself.',
        status: 'answered',
        answer: { transcript: 'I build payments.', spokenMs: 12_000, words: 3 },
        repeats: 1,
        askedAt: 1,
        answeredAt: 2,
      },
      {
        id: 't2',
        kind: 'follow-up',
        planId: 'p1',
        question: 'What was your part?',
        status: 'open',
        repeats: 0,
        askedAt: 3,
        answeredAt: null,
      },
    ],
    current: { turnId: 't2', lineId: 'l4' },
    startedAt: 1,
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    createdAt: 1,
    updatedAt: 10,
    ...overrides,
  });

describe('a mock interview as stored (D100)', () => {
  it('reads the session, leaving out a plan question it can’t read', () => {
    const session = stored();
    expect(session.plan.questions.map(({ id }) => id)).toEqual(['p1', 'p2']);
    expect(session.turns[0]?.answer?.transcript).toBe('I build payments.');
    expect(session.current).toEqual({ turnId: 't2', lineId: 'l4' });
  });

  it('numbers a question by its place in the plan, a follow-up keeping its question’s', () => {
    const session = stored();
    expect(mockProgress(session, 't1')).toEqual({ number: 1, of: 2 });
    expect(mockProgress(session, 't2')).toEqual({ number: 1, of: 2 });
    expect(mockProgress(session, 'unknown')).toBeNull();
  });

  it('is not finished once active and idle for 30 minutes', () => {
    const session = stored({ updatedAt: 0 });
    expect(isMockIdle(session, MOCK_IDLE_MS + 1)).toBe(true);
    expect(isMockIdle(session, MOCK_IDLE_MS)).toBe(false);
    expect(
      isMockIdle(stored({ status: 'ended', updatedAt: 0 }), MOCK_IDLE_MS + 1),
    ).toBe(false);
  });
});
