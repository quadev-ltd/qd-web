import { doc, getDoc } from 'firebase/firestore/lite';

import { getUsageLimits } from './usageLimits';

import {
  CV_VERSION_DAILY_LIMIT,
  effectiveLimits,
  serviceOverride,
} from '@/core/profile/usageLimits';

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
    collection: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the usage limits', () => {
  it('reads the overrides from usageLimits/{uid}', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        services: { cvVersion: { maxCallsPerDay: 20, maxCostUsdPerDay: 2 } },
        note: 'Tester',
        updatedBy: 'set-limit',
      }),
    } as never);

    await expect(getUsageLimits('uid-1')).resolves.toEqual({
      services: { cvVersion: { maxCallsPerDay: 20, maxCostUsdPerDay: 2 } },
    });
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'usageLimits/uid-1');
  });

  it('keeps a malformed entry as stored, so it gives only its own service the defaults', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        services: {
          cvVersion: { maxCallsPerDay: 20 },
          jobReading: { maxCallsPerDay: 2.5 },
        },
      }),
    } as never);

    const limits = await getUsageLimits('uid-1');

    expect(
      effectiveLimits(
        CV_VERSION_DAILY_LIMIT,
        serviceOverride(limits, 'cvVersion'),
      ).maxCallsPerDay,
    ).toBe(20);
    expect(
      effectiveLimits(
        CV_VERSION_DAILY_LIMIT,
        serviceOverride(limits, 'jobReading'),
      ),
    ).toEqual(CV_VERSION_DAILY_LIMIT);
  });

  it('answers null when there are none: the defaults apply', async () => {
    vi.mocked(getDoc).mockResolvedValue({ data: () => undefined } as never);

    await expect(getUsageLimits('uid-1')).resolves.toBeNull();
  });
});
