import {
  collection,
  getDoc,
  getDocs,
  Timestamp,
  where,
} from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import {
  createCoverLetter,
  getApplicationLetters,
  getCoverLetter,
  getCoverLettersToday,
  markCoverLetterSent,
  removeCoverLetter,
} from './coverLetters';

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

/** A letter as the backend stores it (quadev-backend #60). */
const stored = (overrides: Record<string, unknown> = {}) => ({
  applicationId: 'a1',
  cvVersionId: 'v1',
  convention: 'uk',
  length: { kind: 'page' },
  job: { role: 'Senior Backend Engineer', company: 'Northwind' },
  status: 'ready',
  paragraphs: [
    {
      sentences: [
        {
          id: 's1',
          text: 'I led the ledger move.',
          kind: 'fact',
          sources: [{ kind: 'item', itemId: 'i1' }, { kind: 'cv' }],
          state: 'written',
          proposed: 'I led the ledger move.',
        },
      ],
    },
  ],
  notes: ['Led with your ledger move.'],
  outcomes: [],
  questions: [],
  statements: [],
  applicationRevision: 1,
  profileRevision: 3,
  createdAt: at(100),
  updatedAt: at(200),
  readyAt: at(150),
  sentAt: at(300),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reading cover letters (D98)', () => {
  it('reads one letter with its dates in milliseconds, or null when it is gone', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(document('l1', stored()) as never);

    await expect(getCoverLetter('uid-1', 'l1')).resolves.toMatchObject({
      id: 'l1',
      applicationId: 'a1',
      cvVersionId: 'v1',
      createdAt: 100,
      updatedAt: 200,
      readyAt: 150,
      sentAt: 300,
    });

    vi.mocked(getDoc).mockResolvedValueOnce(document('l2') as never);
    await expect(getCoverLetter('uid-1', 'l2')).resolves.toBeNull();
  });

  it('reads an application’s letters by its id, leaving out one it can’t read', async () => {
    vi.mocked(getDocs).mockResolvedValueOnce({
      docs: [document('l1', stored()), document('l2', { applicationId: 'a1' })],
    } as never);

    const letters = await getApplicationLetters('uid-1', 'a1');

    expect(letters.map(({ id }) => id)).toEqual(['l1']);
    expect(collection).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/coverLetters',
    );
    expect(where).toHaveBeenCalledWith('applicationId', '==', 'a1');
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getApplicationLetters: 1 document(s) not understood'),
    );
  });

  it('reads how many letters were written today, 0 when none', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      data: () => ({ services: { coverLetter: { calls: 2 } } }),
    } as never);
    await expect(getCoverLettersToday('uid-1')).resolves.toBe(2);

    vi.mocked(getDoc).mockResolvedValueOnce({ data: () => undefined } as never);
    await expect(getCoverLettersToday('uid-1')).resolves.toBe(0);
  });
});

describe('asking for a letter, marking it and removing it (D98)', () => {
  it('asks with createCoverLetter, and resolves the letter being written', async () => {
    callable.mockResolvedValue({
      data: { letterId: 'l1', status: 'creating' },
    });
    const request = {
      applicationId: 'a1',
      convention: 'international' as const,
      length: { kind: 'box' as const, maxChars: 1500 },
      draft: { text: 'hi! saw the role', mode: 'polish' as const },
    };

    await expect(createCoverLetter(request)).resolves.toEqual({
      letterId: 'l1',
    });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'createCoverLetter',
    );
    expect(callable).toHaveBeenCalledWith(request);
  });

  it.each([
    ['functions/resource-exhausted', 'quota', ProfileErrorCode.DailyLimit],
    [
      'functions/failed-precondition',
      'max-letters',
      ProfileErrorCode.MaxLetters,
    ],
    [
      'functions/failed-precondition',
      'cv-not-ready',
      ProfileErrorCode.CvNotReady,
    ],
    ['functions/failed-precondition', 'no-items', ProfileErrorCode.NoItems],
    [
      'functions/failed-precondition',
      'no-job-description',
      ProfileErrorCode.NoJobDescription,
    ],
    [
      'functions/failed-precondition',
      'job-not-ready',
      ProfileErrorCode.Reading,
    ],
    ['functions/not-found', undefined, ProfileErrorCode.NotFound],
    ['functions/permission-denied', 'flag', ProfileErrorCode.FlagOff],
  ])('turns %s (%s) into %s', async (code, reason, expected) => {
    callable.mockRejectedValue(
      Object.assign(new Error('refused'), { code, details: { reason } }),
    );

    await expect(createCoverLetter({ applicationId: 'a1' })).rejects.toEqual(
      new ProfileError(expected),
    );
  });

  it('marks one as sent, or not, and removes one', async () => {
    callable.mockResolvedValueOnce({ data: { letterId: 'l1', unmarked: 1 } });
    await markCoverLetterSent('l1', true);
    expect(callable).toHaveBeenLastCalledWith({ letterId: 'l1', sent: true });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'markCoverLetterSent',
    );

    callable.mockResolvedValueOnce({ data: { letterId: 'l1' } });
    await removeCoverLetter('l1');
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'removeCoverLetter',
    );
    expect(callable).toHaveBeenLastCalledWith({ letterId: 'l1' });
  });
});
