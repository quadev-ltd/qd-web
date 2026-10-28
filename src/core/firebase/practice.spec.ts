import {
  collection,
  getDoc,
  getDocs,
  query,
  Timestamp,
  where,
} from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import {
  getBriefPracticeTurns,
  getListPracticeTurns,
  getPracticeToday,
  getPracticeTurn,
  removePracticeTurn,
  startPracticeTurn,
} from './practice';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
const callable = vi.hoisted(() => vi.fn());

vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));
vi.mock('./app', () => ({ db: vi.fn(() => ({ name: 'db' })) }));
vi.mock('./functions', () => ({
  functions: vi.fn(() => ({ name: 'functions' })),
}));
vi.mock('./storage', () => ({ storage: vi.fn(() => ({ name: 'storage' })) }));
vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
  uploadBytesResumable: vi.fn(),
}));
vi.mock('firebase/firestore/lite', () => {
  class FakeTimestamp {
    constructor(private readonly value: number) {}
    toMillis() {
      return this.value;
    }
  }
  return {
    Timestamp: FakeTimestamp,
    collection: vi.fn((_db: unknown, path: string) => ({ collection: path })),
    doc: vi.fn((_db: unknown, path: string) => ({ doc: path })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn((...parts: unknown[]) => ({ query: parts })),
    where: vi.fn((field: string, op: string, value: unknown) => ({
      where: [field, op, value],
    })),
  };
});
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => callable),
}));

const at = (milliseconds: number) =>
  new (Timestamp as unknown as new (value: number) => Timestamp)(milliseconds);

const document = (id: string, data?: Record<string, unknown>) => ({
  id,
  exists: () => data !== undefined,
  data: () => data,
});

/** A turn as the backend stores it (quadev-backend #57). */
const stored = (overrides: Record<string, unknown> = {}) => ({
  applicationId: 'a1',
  application: { title: 'Senior Backend Engineer', company: 'Northwind' },
  interviewId: 'i1',
  interview: { name: 'Technical interview', type: 'technical' },
  question: {
    text: 'Tell me about an incident you led.',
    kind: 'behavioural',
    source: 'interview',
    listId: 'list-1',
    questionId: 'q1',
  },
  keyPoints: [
    { text: 'Payments migration: 40% fewer incidents', itemId: 'item-1' },
    { text: 'Say what you changed afterwards.' },
  ],
  attempts: [],
  skill: { id: 'answer-guide', version: '1.0.0' },
  applicationRevision: 2,
  profileRevision: 3,
  interviewRevision: 1,
  createdAt: at(100),
  updatedAt: at(200),
  expireAt: at(300),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reading practice turns (D94)', () => {
  it('reads one turn with its dates in milliseconds, or null when it is gone', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(document('t1', stored()) as never);

    await expect(getPracticeTurn('uid-1', 't1')).resolves.toEqual({
      id: 't1',
      applicationId: 'a1',
      application: { title: 'Senior Backend Engineer', company: 'Northwind' },
      interviewId: 'i1',
      interview: { name: 'Technical interview', type: 'technical' },
      question: {
        text: 'Tell me about an incident you led.',
        kind: 'behavioural',
        source: 'interview',
        listId: 'list-1',
        questionId: 'q1',
      },
      keyPoints: [
        { text: 'Payments migration: 40% fewer incidents', itemId: 'item-1' },
        { text: 'Say what you changed afterwards.' },
      ],
      attempts: [],
      createdAt: 100,
      updatedAt: 200,
    });

    vi.mocked(getDoc).mockResolvedValueOnce(document('t2') as never);
    await expect(getPracticeTurn('uid-1', 't2')).resolves.toBeNull();
  });

  it('reads a removed application’s turn by its snapshot, and leaves out a key point it can’t read', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document(
        't1',
        stored({
          applicationRemoved: true,
          interviewRemoved: true,
          question: { text: 'Why us?', kind: 'small-talk', source: 'typed' },
          keyPoints: [{ text: '' }, { text: 'Advice.' }],
        }),
      ) as never,
    );

    const turn = await getPracticeTurn('uid-1', 't1');

    expect(turn).toMatchObject({
      applicationRemoved: true,
      interviewRemoved: true,
      // A kind it does not know is read as "about the role".
      question: { text: 'Why us?', kind: 'role', source: 'typed' },
      keyPoints: [{ text: 'Advice.' }],
    });
  });

  it('leaves out a turn without its question, and counts it in the log', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [document('t1', stored()), document('t2', { applicationId: 'a1' })],
    } as never);

    const turns = await getListPracticeTurns('uid-1', 'i1', 'list-1');

    expect(turns.map(({ id }) => id)).toEqual(['t1']);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getListPracticeTurns: 1 document(s) not understood'),
    );
  });

  it('reads the turns of an interview’s list by the interview and the list, with no order', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);

    await getListPracticeTurns('uid-1', 'i1', 'list-1');

    expect(collection).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/practiceTurns',
    );
    expect(where).toHaveBeenCalledWith('interviewId', '==', 'i1');
    expect(where).toHaveBeenCalledWith('question.listId', '==', 'list-1');
    expect(vi.mocked(query).mock.calls[0]).toHaveLength(3);
  });

  it('reads the turns of a brief’s questions by the application and the source', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({ docs: [] } as never);

    await getBriefPracticeTurns('uid-1', 'a1');

    expect(where).toHaveBeenCalledWith('applicationId', '==', 'a1');
    expect(where).toHaveBeenCalledWith('question.source', '==', 'brief');
  });

  it('reads how many practice calls were made today, 0 when none', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      data: () => ({ services: { practice: { calls: 3 } } }),
    } as never);
    await expect(getPracticeToday('uid-1')).resolves.toBe(3);

    vi.mocked(getDoc).mockResolvedValueOnce({ data: () => undefined } as never);
    await expect(getPracticeToday('uid-1')).resolves.toBe(0);
  });
});

describe('starting and removing a practice (D94)', () => {
  it('starts one with startPracticeTurn, and resolves the turn', async () => {
    callable.mockResolvedValue({
      data: { applicationId: 'a1', turnId: 't1', keyPoints: 3 },
    });
    const request = {
      applicationId: 'a1',
      interviewId: 'i1',
      question: {
        source: 'interview' as const,
        listId: 'list-1',
        questionId: 'q1',
      },
    };

    await expect(startPracticeTurn(request)).resolves.toEqual({
      turnId: 't1',
    });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'startPracticeTurn',
    );
    expect(callable).toHaveBeenCalledWith(request);
  });

  it.each([
    ['functions/resource-exhausted', 'quota', ProfileErrorCode.DailyLimit],
    [
      'functions/failed-precondition',
      'question-changed',
      ProfileErrorCode.QuestionChanged,
    ],
    [
      'functions/failed-precondition',
      'turn-limit',
      ProfileErrorCode.MaxPracticeTurns,
    ],
    [
      'functions/failed-precondition',
      'job-not-ready',
      ProfileErrorCode.Reading,
    ],
    ['functions/not-found', 'no-interview', ProfileErrorCode.NotFound],
    ['functions/permission-denied', 'flag', ProfileErrorCode.FlagOff],
    ['functions/deadline-exceeded', undefined, ProfileErrorCode.Network],
  ])('turns %s (%s) into %s', async (code, reason, expected) => {
    callable.mockRejectedValue(
      Object.assign(new Error('refused'), { code, details: { reason } }),
    );

    await expect(
      startPracticeTurn({
        applicationId: 'a1',
        question: { source: 'typed', text: 'Why us?' },
      }),
    ).rejects.toEqual(new ProfileError(expected));
  });

  it('removes one with removePracticeTurn', async () => {
    callable.mockResolvedValue({ data: { turnId: 't1' } });

    await removePracticeTurn('t1');

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'removePracticeTurn',
    );
    expect(callable).toHaveBeenCalledWith({ turnId: 't1' });
  });
});
