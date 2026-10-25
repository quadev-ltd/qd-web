import { doc, getDoc, getDocs, Timestamp } from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import {
  answerCvQuestion,
  copyCvVersion,
  createCvVersion,
  decideCvChange,
  getCvVersion,
  getCvVersions,
  getCvVersionsToday,
  markCvVersionSent,
  removeCvVersion,
  reviseCvLine,
  rewriteCvVersion,
} from './cvVersions';

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
    query: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

const version = (more: Record<string, unknown> = {}) => ({
  target: { kind: 'general', role: 'Data engineer' },
  resourceId: 'r1',
  convention: 'uk',
  length: 'same',
  status: 'ready',
  cv: 'Maya Okafor\nBuilt the booking API for 40 depots',
  findings: [],
  changes: [],
  questions: [],
  unsupportedJobTerms: [],
  profileRevision: 3,
  claimedAt: at(2),
  createdAt: at(1),
  updatedAt: at(4),
  readyAt: at(4),
  ...more,
});

describe('reading CV versions', () => {
  it('reads them, the newest first, with every date in milliseconds', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('old', version({ createdAt: at(1) })),
        document('new', version({ createdAt: at(10), status: 'creating' })),
      ],
    } as never);

    const versions = await getCvVersions('uid-1');

    expect(versions.map(({ id }) => id)).toEqual(['new', 'old']);
    expect(versions[1]).toMatchObject({ createdAt: 1, readyAt: 4 });
  });

  it('leaves out a document it does not understand and counts it in the log, never its content', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [document('bad', { status: 'queued' }), document('v1', version())],
    } as never);

    await expect(getCvVersions('uid-1')).resolves.toHaveLength(1);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getCvVersions: 1 document(s) not understood'),
    );
  });

  it('leaves out, without a word in the log, a version made a way it does not show yet', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('unknown', version({ mode: 'translate' })),
        document('edit', version({ mode: 'edit', createdAt: at(3) })),
        document('before', version()),
      ],
    } as never);

    const versions = await getCvVersions('uid-1');

    expect(versions.map(({ id }) => id)).toEqual(['edit', 'before']);
    expect(mockLogger.logError).not.toHaveBeenCalled();

    vi.mocked(getDoc).mockResolvedValueOnce(
      document('unknown', version({ mode: 'translate' })) as never,
    );
    await expect(getCvVersion('uid-1', 'unknown')).resolves.toBeNull();
  });

  it('reads a written version (D83) with its document, notes and questions', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('w1', {
        mode: 'write',
        target: { kind: 'general' },
        convention: 'uk',
        pages: 1,
        status: 'ready',
        document: {
          summary: [
            {
              id: 'l1',
              text: 'Backend engineer.',
              sources: [{ kind: 'item', itemId: 'i1' }, { kind: 'cv' }],
              state: 'written',
              proposed: 'Backend engineer.',
            },
          ],
          experience: [],
          projects: [],
          skills: [],
          education: [],
          certifications: [],
          languages: [],
        },
        notes: ['Put the results first.'],
        questions: [
          { id: 'q1', lineId: 'l1', text: 'How many?', status: 'open' },
        ],
        unsupportedJobTerms: [],
        statements: [],
        dropped: { lines: 2, numbers: 0, names: 0 },
        profileRevision: 3,
        createdAt: at(1),
        updatedAt: at(2),
      }) as never,
    );

    const written = await getCvVersion('uid-1', 'w1');

    expect(written).toMatchObject({
      mode: 'write',
      pages: 1,
      notes: ['Put the results first.'],
      questions: [{ id: 'q1', lineId: 'l1' }],
      dropped: { lines: 2 },
    });
    // A source of a kind the website doesn't know is left out, not the line.
    expect(
      written && 'document' in written && written.document?.summary[0]?.sources,
    ).toEqual([{ kind: 'item', itemId: 'i1' }]);
  });

  it('reads one, or null when it is gone', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(document('v1', version()) as never);
    await expect(getCvVersion('uid-1', 'v1')).resolves.toMatchObject({
      id: 'v1',
      target: { kind: 'general', role: 'Data engineer' },
    });
    expect(doc).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/cvVersions/v1',
    );

    vi.mocked(getDoc).mockResolvedValueOnce(document('v1') as never);
    await expect(getCvVersion('uid-1', 'v1')).resolves.toBeNull();
  });

  it('counts today’s versions from the usage of the day, 0 when there is none', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('day', { services: { cvVersion: { calls: 2 } } }) as never,
    );
    await expect(getCvVersionsToday('uid-1')).resolves.toBe(2);

    vi.mocked(getDoc).mockResolvedValueOnce(document('day') as never);
    await expect(getCvVersionsToday('uid-1')).resolves.toBe(0);
  });
});

describe('making and removing CV versions', () => {
  it('asks for one with createCvVersion, which answers at once that it is being made', async () => {
    callable.mockResolvedValue({
      data: { versionId: 'v9', status: 'creating' },
    });
    const request = {
      resourceId: 'r1',
      target: { kind: 'job' as const, applicationId: 'a1' },
      length: 'one-page' as const,
    };

    await expect(createCvVersion(request)).resolves.toEqual({
      versionId: 'v9',
      status: 'creating',
    });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'createCvVersion',
    );
    expect(callable).toHaveBeenCalledWith(request);
  });

  it.each([
    ['max-versions', ProfileErrorCode.MaxCvVersions],
    ['no-cv-text', ProfileErrorCode.NoCvText],
    ['not-a-cv', ProfileErrorCode.Invalid],
    ['no-job-description', ProfileErrorCode.NoJobDescription],
    ['job-not-ready', ProfileErrorCode.Reading],
  ])('says why a version was refused (%s)', async (reason, code) => {
    callable.mockRejectedValue(
      Object.assign(new Error('refused'), {
        code: 'functions/failed-precondition',
        details: { reason },
      }),
    );

    await expect(
      createCvVersion({ resourceId: 'r1', target: { kind: 'general' } }),
    ).rejects.toEqual(new ProfileError(code));
  });

  it('removes one with removeCvVersion', async () => {
    callable.mockResolvedValue({ data: { versionId: 'v9' } });

    await removeCvVersion('v9');

    expect(callable).toHaveBeenCalledWith({ versionId: 'v9' });
  });
});

describe('the review', () => {
  it('decides a change, with the candidate’s text only for an edit', async () => {
    callable.mockResolvedValue({ data: { versionId: 'v1', open: 2 } });

    await expect(decideCvChange('v1', 'c1', 'accept')).resolves.toEqual({
      open: 2,
    });
    await decideCvChange('v1', 'c1', 'edit', 'Wrote it');
    await decideCvChange('v1', 'c1', 'keep', 'ignored');

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'decideCvChange',
    );
    expect(callable.mock.calls.map(([data]) => data)).toEqual([
      { versionId: 'v1', changeId: 'c1', decision: 'accept' },
      { versionId: 'v1', changeId: 'c1', decision: 'edit', text: 'Wrote it' },
      { versionId: 'v1', changeId: 'c1', decision: 'keep' },
    ]);
  });

  it('answers a question, or skips it with no answer', async () => {
    callable.mockResolvedValue({ data: { versionId: 'v1', open: 0 } });

    await answerCvQuestion('v1', 'q1', '40 depots');
    await answerCvQuestion('v1', 'q1');

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'answerCvQuestion',
    );
    expect(callable.mock.calls.map(([data]) => data)).toEqual([
      { versionId: 'v1', questionId: 'q1', answer: '40 depots' },
      { versionId: 'v1', questionId: 'q1' },
    ]);
  });

  it('marks a version as sent, or not', async () => {
    callable.mockResolvedValue({ data: { versionId: 'v1', unmarked: 1 } });

    await markCvVersionSent('v1', true);

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'markCvVersionSent',
    );
    expect(callable).toHaveBeenCalledWith({ versionId: 'v1', sent: true });
  });

  it('restores a version with copyCvVersion, and resolves the copy', async () => {
    callable.mockResolvedValue({ data: { versionId: 'v2', copiedFrom: 'v1' } });

    await expect(copyCvVersion('v1')).resolves.toEqual({ versionId: 'v2' });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'copyCvVersion',
    );
    expect(callable).toHaveBeenCalledWith({ versionId: 'v1' });
  });
});

describe('a written CV revised (D83)', () => {
  it('revises a line or a role with reviseCvLine', async () => {
    callable.mockResolvedValue({ data: { versionId: 'w1' } });

    await reviseCvLine('w1', {
      lineId: 'e1',
      action: 'edit',
      fields: { end: 'Present' },
    });

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'reviseCvLine',
    );
    expect(callable).toHaveBeenCalledWith({
      versionId: 'w1',
      lineId: 'e1',
      action: 'edit',
      fields: { end: 'Present' },
    });
  });

  it('writes one again with rewriteCvVersion, and resolves the new one', async () => {
    callable.mockResolvedValue({
      data: { versionId: 'w2', status: 'creating' },
    });

    await expect(rewriteCvVersion('w1')).resolves.toEqual({ versionId: 'w2' });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'rewriteCvVersion',
    );
    expect(callable).toHaveBeenCalledWith({ versionId: 'w1' });
  });
});
