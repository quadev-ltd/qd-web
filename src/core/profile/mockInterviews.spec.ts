import {
  isMockFeedbackWriting,
  isMockGoing,
  isMockIdle,
  MOCK_FEEDBACK_SETTLE_MS,
  MOCK_IDLE_MS,
  MOCK_OVERALL_KEY,
  mockAnswerFeedbackOf,
  mockFeedbackChipOf,
  mockHintsKey,
  mockHintsOf,
  mockOverallOf,
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

describe('a mock interview’s hints (slice H1)', () => {
  const POINTS = [
    { text: 'Payments migration: 40% fewer incidents', itemId: 'i1' },
    { text: 'Say what you changed afterwards.' },
  ];

  it('reads when they show, "When I ask" for a session from before hints', () => {
    expect(stored().hintsShown).toBe('on-request');
    expect(stored({ hintsShown: 'after-answer' }).hintsShown).toBe(
      'after-answer',
    );
    expect(stored({ hintsShown: 'sometimes' }).hintsShown).toBe('on-request');
  });

  it('reads each question’s hints, leaving out an entry or a point it can’t read', () => {
    const session = stored({
      hints: {
        p1: {
          status: 'ready',
          keyPoints: [...POINTS, { nothing: 'readable' }],
          readyAt: 5,
          ms: 7_000,
        },
        t2: { status: 'writing' },
        p2: { status: 'failed', reason: 'quota' },
        p3: { status: 'unknown' },
      },
    });
    expect(Object.keys(session.hints)).toEqual(['p1', 't2', 'p2']);
    expect(session.hints.p1?.keyPoints).toEqual(POINTS);
    expect(session.hints.p2).toEqual({
      status: 'failed',
      reason: 'quota',
      keyPoints: [],
    });
    expect(stored().hints).toEqual({});
  });

  it('keeps a planned question’s hints by its plan question, a follow-up’s by itself', () => {
    const [planned, followUp] = stored().turns;
    expect(mockHintsKey(planned!)).toBe('p1');
    expect(mockHintsKey(followUp!)).toBe('t2');
  });

  it('says what there is to show: the points, nothing this time, or not yet', () => {
    const session = stored({
      hints: {
        p1: { status: 'ready', keyPoints: POINTS },
        t2: { status: 'writing' },
      },
    });
    expect(mockHintsOf(session, 't1')).toEqual({
      status: 'ready',
      keyPoints: POINTS,
    });
    expect(mockHintsOf(session, 't2')).toEqual({ status: 'pending' });
    // A turn the read doesn't have yet, or no entry yet
    expect(mockHintsOf(session, 't9')).toEqual({ status: 'pending' });
    expect(mockHintsOf(stored(), 't1')).toEqual({ status: 'pending' });
    // Failed, or ready with nothing in it
    expect(
      mockHintsOf(
        stored({ hints: { p1: { status: 'failed', reason: 'model' } } }),
        't1',
      ),
    ).toEqual({ status: 'none' });
    expect(
      mockHintsOf(
        stored({ hints: { p1: { status: 'ready', keyPoints: [] } } }),
        't1',
      ),
    ).toEqual({ status: 'none' });
  });
});

describe('the feedback on a mock interview (D101, F1)', () => {
  const FEEDBACK = {
    covered: ['You named the method.'],
    missing: ['Your own part.'],
    structure: 'In order.',
    clarity: 'About 30 seconds.',
    suggestions: ['Start with what was at stake.'],
  };
  const ENDED = 600_000;
  const turn = (id: string, status: string, answeredAt: number | null) => ({
    id,
    kind: 'planned',
    planId: 'p1',
    question: `Question ${id}?`,
    status,
    ...(status === 'answered'
      ? { answer: { transcript: 'I did it.', spokenMs: 31_000, words: 3 } }
      : {}),
    repeats: 0,
    askedAt: 1,
    answeredAt,
  });
  const ended = (overrides: Record<string, unknown> = {}) =>
    stored({
      status: 'ended',
      endReason: 'finished',
      endedAt: ENDED,
      turns: [
        turn('t1', 'answered', 100_000),
        turn('t2', 'answered', 400_000),
        turn('t3', 'skipped', null),
      ],
      ...overrides,
    });
  const at = (now: number, retried: string[] = []) => ({
    now,
    retried: new Set(retried),
  });

  it('reads each answer’s and the overall view, leaving out what doesn’t match', () => {
    const session = ended({
      answerFeedback: {
        t1: { status: 'ready', feedback: FEEDBACK, startedAt: 1, readyAt: 2 },
        t2: { status: 'writing', startedAt: 5 },
        t3: { status: 'sometimes' },
        t4: { status: 'ready' },
      },
      overall: {
        status: 'ready',
        wentWell: ['Concrete answers.', 7],
        workOn: ['Say your part first.'],
        practiseAgain: [{ turnId: 't3', reason: 'Skipped' }, { reason: 'x' }],
      },
    });
    expect(Object.keys(session.answerFeedback)).toEqual(['t1', 't2']);
    expect(session.answerFeedback.t1?.feedback?.covered).toEqual([
      'You named the method.',
    ]);
    expect(session.overall).toMatchObject({
      status: 'ready',
      wentWell: ['Concrete answers.'],
      practiseAgain: [{ turnId: 't3', reason: 'Skipped' }],
    });
    // Before F1, and an overall view that can't be read
    expect(stored().answerFeedback).toEqual({});
    expect(stored({ overall: { status: 'later' } }).overall).toBeUndefined();
  });

  it('shows an answer’s feedback once ready, and where it stands until then', () => {
    const session = ended({
      answerFeedback: {
        t1: { status: 'ready', feedback: FEEDBACK },
        t2: { status: 'failed' },
      },
    });
    const of = (id: string, now = ENDED + 1_000) =>
      mockAnswerFeedbackOf(
        session,
        session.turns.find(turnOf => turnOf.id === id)!,
        at(now),
      );
    expect(of('t1')).toMatchObject({ status: 'ready', feedback: FEEDBACK });
    expect(of('t2')).toEqual({ status: 'failed' });
    // Skipped: no feedback, ever
    expect(of('t3')).toBeNull();
  });

  it('stopped by the day’s limit: it can be asked for again once the UTC day has changed', () => {
    const session = ended({ answerFeedback: { t1: { status: 'quota' } } });
    const t1 = session.turns[0]!;
    expect(mockAnswerFeedbackOf(session, t1, at(ENDED))).toEqual({
      status: 'quota',
      reset: false,
    });
    expect(mockAnswerFeedbackOf(session, t1, at(Date.UTC(1970, 0, 2)))).toEqual(
      { status: 'quota', reset: true },
    );
  });

  it('none coming: no entry, or writing, 5 minutes after the answer, unless asked again here', () => {
    const session = ended({
      answerFeedback: { t2: { status: 'writing', startedAt: 400_000 } },
    });
    const [t1, t2] = session.turns;
    const soon = 100_000 + MOCK_FEEDBACK_SETTLE_MS;
    expect(mockAnswerFeedbackOf(session, t1!, at(soon))).toEqual({
      status: 'writing',
    });
    expect(mockAnswerFeedbackOf(session, t1!, at(soon + 1))).toEqual({
      status: 'missing',
    });
    expect(mockAnswerFeedbackOf(session, t1!, at(soon + 1, ['t1']))).toEqual({
      status: 'writing',
    });
    // Stuck while written: claimed more than 5 minutes ago
    expect(
      mockAnswerFeedbackOf(
        session,
        t2!,
        at(400_000 + MOCK_FEEDBACK_SETTLE_MS + 1),
      ),
    ).toEqual({ status: 'missing' });
  });

  it('the overall view: only once ended with answers, none with one answer', () => {
    expect(mockOverallOf(stored(), at(ENDED))).toBeNull();
    expect(
      mockOverallOf(ended({ turns: [turn('t3', 'skipped', null)] }), at(ENDED)),
    ).toBeNull();
    expect(
      mockOverallOf(
        ended({ turns: [turn('t1', 'answered', 100_000)] }),
        at(ENDED),
      ),
    ).toEqual({ status: 'none' });
    expect(
      mockOverallOf(ended({ overall: { status: 'none' } }), at(ENDED)),
    ).toEqual({ status: 'none' });
  });

  it('the overall view: preparing with how many answers are ready, then ready, failed or stopped', () => {
    const answers = {
      t1: { status: 'ready', feedback: FEEDBACK },
      t2: { status: 'writing', startedAt: 400_000 },
    };
    expect(
      mockOverallOf(ended({ answerFeedback: answers }), at(ENDED + 1_000)),
    ).toEqual({ status: 'writing', ready: 1, of: 2 });
    expect(
      mockOverallOf(
        ended({
          answerFeedback: answers,
          overall: {
            status: 'ready',
            wentWell: ['Concrete.'],
            workOn: ['Shorter.'],
          },
        }),
        at(ENDED),
      ),
    ).toMatchObject({ status: 'ready', overall: { wentWell: ['Concrete.'] } });
    expect(
      mockOverallOf(ended({ overall: { status: 'failed' } }), at(ENDED)),
    ).toEqual({ status: 'failed' });
    expect(
      mockOverallOf(
        ended({ overall: { status: 'quota' } }),
        at(Date.UTC(1970, 0, 2)),
      ),
    ).toEqual({ status: 'quota', reset: true });
  });

  it('no feedback at all 5 minutes on (before F1): "Get feedback" asks for the answers with none', () => {
    const later = ENDED + MOCK_FEEDBACK_SETTLE_MS + 1;
    expect(mockOverallOf(ended(), at(later))).toEqual({
      status: 'missing',
      turnIds: ['t1', 't2'],
    });
    // Asked for here: preparing, whatever the read says yet
    expect(
      mockOverallOf(ended(), at(later, ['t1', 't2', MOCK_OVERALL_KEY])),
    ).toEqual({ status: 'writing', ready: 0, of: 2 });
  });

  it('every answer settled but no overall view 5 minutes after the end: it alone is asked for', () => {
    const settled = {
      t1: { status: 'ready', feedback: FEEDBACK },
      t2: { status: 'failed' },
    };
    const later = ENDED + MOCK_FEEDBACK_SETTLE_MS + 1;
    expect(
      mockOverallOf(ended({ answerFeedback: settled }), at(ENDED + 1_000)),
    ).toEqual({ status: 'writing', ready: 1, of: 2 });
    expect(
      mockOverallOf(ended({ answerFeedback: settled }), at(later)),
    ).toEqual({ status: 'missing', turnIds: [] });
    expect(
      mockOverallOf(
        ended({
          answerFeedback: settled,
          overall: { status: 'writing', startedAt: ENDED },
        }),
        at(later),
      ),
    ).toEqual({ status: 'missing', turnIds: [] });
  });

  it('is being written while an answer’s or the overall view is', () => {
    const settled = {
      t1: { status: 'ready', feedback: FEEDBACK },
      t2: { status: 'ready', feedback: FEEDBACK },
    };
    expect(
      isMockFeedbackWriting(
        ended({
          answerFeedback: {
            ...settled,
            t2: { status: 'writing', startedAt: ENDED },
          },
        }),
        at(ENDED),
      ),
    ).toBe(true);
    expect(
      isMockFeedbackWriting(ended({ answerFeedback: settled }), at(ENDED)),
    ).toBe(true);
    expect(
      isMockFeedbackWriting(
        ended({
          answerFeedback: settled,
          overall: { status: 'ready', wentWell: ['x'], workOn: ['y'] },
        }),
        at(ENDED),
      ),
    ).toBe(false);
    // Nothing coming by itself: not read again
    expect(
      isMockFeedbackWriting(ended(), at(ENDED + MOCK_FEEDBACK_SETTLE_MS + 1)),
    ).toBe(false);
  });
});

describe('a mock interview in a list (doc 24 §19)', () => {
  const FEEDBACK = {
    covered: [],
    missing: [],
    structure: '',
    clarity: '',
    suggestions: ['Say what was at stake.'],
  };
  const ended = (overrides: Record<string, unknown> = {}) =>
    stored({
      status: 'ended',
      endReason: 'finished',
      endedAt: 600_000,
      turns: [
        {
          id: 't1',
          kind: 'planned',
          planId: 'p1',
          question: 'Tell me about yourself.',
          status: 'answered',
          answer: { transcript: 'I build.', spokenMs: 9_000, words: 2 },
          repeats: 0,
          askedAt: 1,
          answeredAt: 500_000,
        },
        {
          id: 't2',
          kind: 'planned',
          planId: 'p2',
          question: 'An incident?',
          status: 'answered',
          answer: { transcript: 'I led it.', spokenMs: 9_000, words: 3 },
          repeats: 0,
          askedAt: 2,
          answeredAt: 550_000,
        },
      ],
      ...overrides,
    });
  const LATER = 600_000 + 6 * 60_000;

  it('preparing while any feedback is written; ready once one answer’s is; none otherwise', () => {
    expect(
      mockFeedbackChipOf(
        ended({
          answerFeedback: { t1: { status: 'writing', startedAt: 590_000 } },
        }),
        600_000,
      ),
    ).toBe('preparing');
    // One ready, the other failed, the overall view failed: what is there is ready
    expect(
      mockFeedbackChipOf(
        ended({
          answerFeedback: {
            t1: { status: 'ready', feedback: FEEDBACK },
            t2: { status: 'failed' },
          },
          overall: { status: 'failed' },
        }),
        LATER,
      ),
    ).toBe('ready');
    // Every answer failed or stopped, or none written (before F1)
    expect(
      mockFeedbackChipOf(
        ended({
          answerFeedback: { t1: { status: 'failed' }, t2: { status: 'quota' } },
          overall: { status: 'failed' },
        }),
        LATER,
      ),
    ).toBe('none');
    expect(mockFeedbackChipOf(ended(), LATER)).toBe('none');
  });

  it('a session still going is going; one idle for 30 minutes isn’t', () => {
    expect(isMockGoing(stored({ updatedAt: 10 }), 20)).toBe(true);
    expect(isMockGoing(stored({ updatedAt: 0 }), MOCK_IDLE_MS + 1)).toBe(false);
    expect(isMockGoing(ended(), 0)).toBe(false);
  });
});
