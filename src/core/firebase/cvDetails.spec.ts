import { doc, getDoc, Timestamp } from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';

import { getCvDetails, updateCvDetails } from './cvDetails';

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

const at = (milliseconds: number) =>
  new (Timestamp as unknown as new (value: number) => Timestamp)(milliseconds);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the CV details', () => {
  it('reads them from details/cv, with the date in milliseconds', async () => {
    vi.mocked(getDoc).mockResolvedValue({
      data: () => ({
        name: 'Maya Okafor',
        links: ['github.com/maya-okafor-example'],
        edited: ['phone'],
        sources: { name: 'r1', links: 'r1' },
        updatedAt: at(7),
      }),
    } as never);

    await expect(getCvDetails('uid-1')).resolves.toEqual({
      name: 'Maya Okafor',
      links: ['github.com/maya-okafor-example'],
      edited: ['phone'],
      sources: { name: 'r1', links: 'r1' },
      updatedAt: 7,
    });
    expect(doc).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/interviewProfile/main/details/cv',
    );
  });

  it('answers null while no field is filled', async () => {
    vi.mocked(getDoc).mockResolvedValue({ data: () => undefined } as never);

    await expect(getCvDetails('uid-1')).resolves.toBeNull();
  });

  it('saves the fields given with updateCvDetails', async () => {
    callable.mockResolvedValue({ data: { changed: ['phone'] } });

    await expect(
      updateCvDetails({ phone: '07700 900999', links: [] }),
    ).resolves.toEqual({ changed: ['phone'] });
    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'updateCvDetails',
    );
    expect(callable).toHaveBeenCalledWith({ phone: '07700 900999', links: [] });
  });
});
