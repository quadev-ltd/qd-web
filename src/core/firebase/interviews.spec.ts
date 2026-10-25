import {
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import { getApplication } from './applications';
import {
  createInterview,
  getInterview,
  getInterviews,
  removeInterview,
  updateInterview,
} from './interviews';

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

const stored = (startsAt: number) => ({
  date: '2026-10-28',
  startTime: '14:00',
  timeZone: 'Europe/London',
  startsAt: at(startsAt),
  description: '',
  revision: 1,
  createdAt: at(1),
  updatedAt: at(2),
});

describe('reading interviews', () => {
  it('reads an application’s interviews ordered by when they start, with every date in milliseconds', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('i1', {
          ...stored(100),
          name: 'Technical interview',
          lengthMinutes: 60,
          type: 'technical',
          description: 'Two engineers.',
        }),
      ],
    } as never);

    await expect(getInterviews('uid-1', 'a1')).resolves.toEqual([
      {
        id: 'i1',
        name: 'Technical interview',
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
        startsAt: 100,
        lengthMinutes: 60,
        type: 'technical',
        description: 'Two engineers.',
        revision: 1,
        createdAt: 1,
        updatedAt: 2,
      },
    ]);
    expect(orderBy).toHaveBeenCalledWith('startsAt');
    expect(query).toHaveBeenCalledWith(
      { collection: 'users/uid-1/applications/a1/interviews' },
      undefined,
    );
  });

  it('leaves out an interview without its start, and counts it in the log', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('i1', stored(100)),
        document('i2', { ...stored(100), startsAt: undefined }),
      ],
    } as never);

    const interviews = await getInterviews('uid-1', 'a1');

    expect(interviews.map(({ id }) => id)).toEqual(['i1']);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getInterviews: 1 document(s) not understood'),
    );
  });

  it('reads past a type or a length it does not know', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('i1', { ...stored(100), type: 'panel', lengthMinutes: 600 }),
      ],
    } as never);

    const [interview] = await getInterviews('uid-1', 'a1');

    expect(interview.type).toBeUndefined();
    expect(interview.lengthMinutes).toBeUndefined();
  });

  it('reads one interview, or null when it is gone', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(
      document('i1', stored(100)) as never,
    );
    await expect(getInterview('uid-1', 'a1', 'i1')).resolves.toMatchObject({
      id: 'i1',
      startsAt: 100,
    });

    vi.mocked(getDoc).mockResolvedValueOnce(document('i2') as never);
    await expect(getInterview('uid-1', 'a1', 'i2')).resolves.toBeNull();
  });

  it('reads the times of an application’s interviews with the application', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      document('a1', {
        title: 'Senior Backend Engineer',
        revision: 1,
        interviewTimes: [
          {
            interviewId: 'i1',
            startsAt: at(100),
            date: '2026-10-28',
            startTime: '14:00',
            timeZone: 'Europe/London',
            name: 'Technical interview',
          },
        ],
      }) as never,
    );

    const application = await getApplication('uid-1', 'a1');

    expect(application?.interviewTimes).toEqual([
      {
        interviewId: 'i1',
        startsAt: 100,
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
        name: 'Technical interview',
      },
    ]);
  });
});

describe('changing interviews', () => {
  it('adds one with createApplicationInterview', async () => {
    callable.mockResolvedValue({
      data: { applicationId: 'a1', interviewId: 'i9' },
    });

    await expect(
      createInterview({
        applicationId: 'a1',
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
      }),
    ).resolves.toEqual({ interviewId: 'i9' });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'createApplicationInterview',
    );
    expect(callable).toHaveBeenCalledWith({
      applicationId: 'a1',
      date: '2026-10-28',
      startTime: '14:00',
      timeZone: 'Europe/London',
    });
  });

  it('changes one with updateApplicationInterview, and resolves its revision', async () => {
    callable.mockResolvedValue({
      data: { applicationId: 'a1', interviewId: 'i9', revision: 3 },
    });

    await expect(
      updateInterview({ applicationId: 'a1', interviewId: 'i9', type: null }),
    ).resolves.toEqual({ revision: 3 });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'updateApplicationInterview',
    );
  });

  it('removes one with removeApplicationInterview', async () => {
    callable.mockResolvedValue({
      data: { applicationId: 'a1', interviewId: 'i9' },
    });

    await removeInterview('a1', 'i9');

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'removeApplicationInterview',
    );
    expect(callable).toHaveBeenCalledWith({
      applicationId: 'a1',
      interviewId: 'i9',
    });
  });

  it('says so when the application already has the most interviews it can hold', async () => {
    callable.mockRejectedValue(
      Object.assign(new Error('full'), {
        code: 'functions/failed-precondition',
        details: { reason: 'interview-limit' },
      }),
    );

    await expect(
      createInterview({
        applicationId: 'a1',
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
      }),
    ).rejects.toEqual(new ProfileError(ProfileErrorCode.MaxInterviews));
  });

  it('says the interview or its application is gone, whichever it is', async () => {
    for (const reason of ['no-application', 'no-interview']) {
      callable.mockRejectedValueOnce(
        Object.assign(new Error('gone'), {
          code: 'functions/not-found',
          details: { reason },
        }),
      );
      await expect(removeInterview('a1', 'i9')).rejects.toEqual(
        new ProfileError(ProfileErrorCode.NotFound),
      );
    }
  });
});
