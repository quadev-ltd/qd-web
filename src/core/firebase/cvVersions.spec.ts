import { doc, getDoc, getDocs, Timestamp } from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import {
  createCvVersion,
  getCvVersion,
  getCvVersions,
  getCvVersionsToday,
  removeCvVersion,
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
    ['no-job-description', ProfileErrorCode.Invalid],
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
