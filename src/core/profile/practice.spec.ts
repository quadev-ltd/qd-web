import {
  practiceMarksOf,
  practiceRestartRequest,
  practiceStartKey,
  type PracticeTurn,
  PracticeTurnSchema,
} from './practice';

/** One try with the least the backend stores. */
const ATTEMPT = {
  answer: 'I led it.',
  feedback: {
    covered: [],
    missing: [],
    structure: '',
    clarity: '',
    suggestions: ['Say what was at stake.'],
  },
  at: null,
};

const turn = (
  id: string,
  updatedAt: number | null,
  question: Partial<PracticeTurn['question']> = {},
  attempts: unknown[] = [],
): PracticeTurn =>
  PracticeTurnSchema.parse({
    id,
    applicationId: 'a1',
    application: {},
    question: {
      text: 'Tell me about an incident.',
      kind: 'behavioural',
      source: 'interview',
      listId: 'list-1',
      questionId: 'q1',
      ...question,
    },
    keyPoints: [],
    attempts,
    createdAt: updatedAt,
    updatedAt,
  });

describe('practiceMarksOf', () => {
  it('marks each question with its newest turn, which "Practise again" opens', () => {
    const marks = practiceMarksOf(
      [
        turn('t1', 100),
        turn('t2', 300, {}, [ATTEMPT, ATTEMPT]),
        turn('t3', 200),
        turn('t4', 50, { questionId: 'q2' }),
      ],
      ({ question }) => question.questionId,
    );

    expect(marks).toEqual(
      new Map([
        ['q1', { turnId: 't2', tries: 2 }],
        ['q2', { turnId: 't4', tries: 0 }],
      ]),
    );
  });

  it('marks the brief’s questions by their text, and skips a turn without a key', () => {
    const marks = practiceMarksOf(
      [
        turn('t1', null, { source: 'brief', text: 'Why us?' }),
        turn('t2', 10, { source: 'brief', text: 'Why us?' }),
        turn('t3', 20, { source: 'typed', questionId: undefined }),
      ],
      ({ question }) =>
        question.source === 'brief' ? question.text : undefined,
    );

    expect(marks).toEqual(new Map([['Why us?', { turnId: 't2', tries: 0 }]]));
  });
});

describe('practiceStartKey', () => {
  it('names one practice being started, by where its question comes from', () => {
    expect(
      practiceStartKey({
        applicationId: 'a1',
        interviewId: 'i1',
        question: { source: 'interview', listId: 'list-1', questionId: 'q3' },
      }),
    ).toBe('interview/i1/q3');
    expect(
      practiceStartKey({
        applicationId: 'a1',
        question: { source: 'brief', text: 'Why us?' },
      }),
    ).toBe('brief/a1/Why us?');
    expect(
      practiceStartKey({
        applicationId: 'a1',
        interviewId: 'i1',
        question: { source: 'typed', text: 'Anything?' },
      }),
    ).toBe('typed/a1/i1');
  });
});

describe('a try and its feedback', () => {
  it('reads each try, leaving out one it can’t read and the lines that aren’t text', () => {
    const parsed = turn('t1', 100, {}, [
      {
        ...ATTEMPT,
        feedback: {
          ...ATTEMPT.feedback,
          covered: ['Opened the incident.', 42, ''],
          example: '',
        },
      },
      { answer: 'No feedback' },
    ]);

    expect(parsed.attempts).toEqual([
      {
        ...ATTEMPT,
        feedback: {
          ...ATTEMPT.feedback,
          covered: ['Opened the incident.'],
          example: undefined,
        },
      },
    ]);
  });
});

describe('practiceRestartRequest', () => {
  it('asks the same question again: from its list, the brief, or as typed', () => {
    const fromList = {
      ...turn('t1', 1),
      interviewId: 'i1',
    };
    expect(practiceRestartRequest(fromList)).toEqual({
      applicationId: 'a1',
      interviewId: 'i1',
      question: { source: 'interview', listId: 'list-1', questionId: 'q1' },
    });
    expect(
      practiceRestartRequest(
        turn('t2', 1, { source: 'brief', text: 'Why us?' }),
      ),
    ).toEqual({
      applicationId: 'a1',
      question: { source: 'brief', text: 'Why us?' },
    });
    expect(
      practiceRestartRequest(
        turn('t3', 1, { source: 'typed', text: 'Why now?' }),
      ),
    ).toEqual({
      applicationId: 'a1',
      question: { source: 'typed', text: 'Why now?' },
    });
  });

  it('can’t ask a question of a list without its interview', () => {
    expect(practiceRestartRequest(turn('t1', 1))).toBeNull();
  });
});
