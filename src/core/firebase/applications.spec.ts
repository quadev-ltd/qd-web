import { doc, getDoc, getDocs, Timestamp } from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import {
  createApplication,
  getApplication,
  getApplications,
  getBriefsToday,
  getProfileRevision,
  prepareBrief,
  removeApplication,
  updateApplication,
} from './applications';

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

describe('reading applications', () => {
  it('reads the user’s applications, the most recently changed first, with every date in milliseconds', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('old', {
          title: 'Platform Engineer',
          revision: 1,
          createdAt: at(1),
          updatedAt: at(2),
        }),
        document('new', {
          title: 'Senior Backend Engineer',
          revision: 2,
          brief: {
            requirements: [],
            questions: [],
            applicationRevision: 2,
            profileRevision: 4,
            builtAt: at(30),
          },
          createdAt: at(10),
          updatedAt: at(40),
        }),
      ],
    } as never);

    const applications = await getApplications('uid-1');

    expect(applications.map(({ id }) => id)).toEqual(['new', 'old']);
    expect(applications[0]?.brief?.builtAt).toBe(30);
    expect(applications[1]?.updatedAt).toBe(2);
  });

  it('leaves out a document it does not understand and counts it in the log, never its content', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('', { title: 'No id' }),
        document('a1', { title: 'Good', createdAt: at(1), updatedAt: at(1) }),
      ],
    } as never);

    const applications = await getApplications('uid-1');

    expect(applications.map(({ id }) => id)).toEqual(['a1']);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getApplications: 1 document(s) not understood'),
    );
  });

  it('reads one application, or null when it is gone', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('a1', { title: 'Good' }) as never,
    );
    await expect(getApplication('uid-1', 'a1')).resolves.toMatchObject({
      id: 'a1',
    });
    expect(doc).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/applications/a1',
    );

    vi.mocked(getDoc).mockResolvedValueOnce(document('a1') as never);
    await expect(getApplication('uid-1', 'a1')).resolves.toBeNull();
  });

  it('reads the profile’s revision, 0 when there is none yet', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('main', { revision: 12 }) as never,
    );
    await expect(getProfileRevision('uid-1')).resolves.toBe(12);
    expect(doc).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/interviewProfile/main',
    );

    vi.mocked(getDoc).mockResolvedValueOnce(document('main') as never);
    await expect(getProfileRevision('uid-1')).resolves.toBe(0);
  });
});

describe('changing applications', () => {
  it('creates one with createJobApplication', async () => {
    callable.mockResolvedValue({ data: { applicationId: 'a9' } });

    await expect(
      createApplication({ title: 'Go', jobDescription: 'Job' }),
    ).resolves.toEqual({ applicationId: 'a9' });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'createJobApplication',
    );
    expect(callable).toHaveBeenCalledWith({
      title: 'Go',
      jobDescription: 'Job',
    });
  });

  it('changes one with updateJobApplication, and resolves its new revision', async () => {
    callable.mockResolvedValue({ data: { applicationId: 'a9', revision: 3 } });

    await expect(
      updateApplication({ applicationId: 'a9', company: null }),
    ).resolves.toEqual({ revision: 3 });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'updateJobApplication',
    );
  });

  it('removes one with removeJobApplication', async () => {
    callable.mockResolvedValue({ data: { applicationId: 'a9' } });

    await removeApplication('a9');

    expect(callable).toHaveBeenCalledWith({ applicationId: 'a9' });
  });

  it('says so when the account already has the most applications it can hold', async () => {
    callable.mockRejectedValue(
      Object.assign(new Error('full'), {
        code: 'functions/failed-precondition',
        details: { reason: 'max-applications' },
      }),
    );

    await expect(createApplication({ title: 'Go' })).rejects.toEqual(
      new ProfileError(ProfileErrorCode.MaxApplications),
    );
  });
});

describe('the brief', () => {
  it('prepares it with prepareApplicationBrief', async () => {
    callable.mockResolvedValue({
      data: { applicationId: 'a9', requirements: 6, gaps: 2, questions: 4 },
    });

    await prepareBrief('a9');

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'prepareApplicationBrief',
    );
    expect(callable).toHaveBeenCalledWith({ applicationId: 'a9' });
  });

  it('says today’s limit was reached', async () => {
    callable.mockRejectedValue(
      Object.assign(new Error('quota'), {
        code: 'functions/resource-exhausted',
      }),
    );

    await expect(prepareBrief('a9')).rejects.toEqual(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
  });

  it('counts today’s briefs from the usage of the day, 0 when there is none', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('day', {
        services: { applicationBrief: { calls: 4 } },
      }) as never,
    );
    await expect(getBriefsToday('uid-1')).resolves.toBe(4);

    vi.mocked(getDoc).mockResolvedValueOnce(document('day') as never);
    await expect(getBriefsToday('uid-1')).resolves.toBe(0);
  });
});
