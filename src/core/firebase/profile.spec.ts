import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';

import {
  createProfile,
  createProfileIfMissing,
  getProfile,
  PROFILE_READ_RETRY_DELAYS_MS,
  resetProfileWatchersForTests,
  saveProfile,
  updateProfile,
  watchProfile,
} from './profile';

const logError = vi.hoisted(() => vi.fn());

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError, logMessage: vi.fn() })),
}));
vi.mock('./app', () => ({ db: () => ({ name: 'db' }) }));
vi.mock('firebase/firestore/lite', () => ({
  doc: vi.fn((_db: unknown, collection: string, id: string) => ({
    path: `${collection}/${id}`,
  })),
  getDoc: vi.fn(),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
  deleteField: vi.fn(() => 'DELETE_FIELD'),
}));

const found = (data: Record<string, unknown>) =>
  ({ exists: () => true, data: () => data }) as never;
const missing = { exists: () => false, data: () => undefined } as never;

const ada = { firstName: 'Ada', lastName: 'Lovelace' };
const userDoc = { path: 'users/uid-1' };

/** Lets the promises that are already settled run their callbacks. */
const settle = async () => {
  for (let turn = 0; turn < 10; turn += 1) {
    await Promise.resolve();
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  resetProfileWatchersForTests();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getProfile', () => {
  it('reads users/{uid} and keeps the profile fields only', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      found({ ...ada, dateOfBirth: '1990-12-10', createdAt: 'a timestamp' }),
    );

    await expect(getProfile('uid-1')).resolves.toEqual({
      ...ada,
      dateOfBirth: '1990-12-10',
    });
    expect(doc).toHaveBeenCalledWith({ name: 'db' }, 'users', 'uid-1');
  });

  it('gives null when the document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);

    await expect(getProfile('uid-1')).resolves.toBeNull();
  });

  it('turns fields of the wrong type into empty names', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      found({ firstName: 1, dateOfBirth: 2 }),
    );

    await expect(getProfile('uid-1')).resolves.toEqual({
      firstName: '',
      lastName: '',
    });
  });
});

describe('createProfile', () => {
  it('writes the fields the rules accept, with the server time', async () => {
    await createProfile('uid-1', { ...ada, dateOfBirth: '1990-12-10' });

    expect(setDoc).toHaveBeenCalledWith(userDoc, {
      ...ada,
      dateOfBirth: '1990-12-10',
      createdAt: 'SERVER_TIMESTAMP',
    });
    expect(serverTimestamp).toHaveBeenCalledTimes(1);
  });

  it('leaves the date of birth out when there is none', async () => {
    await createProfile('uid-1', { ...ada, dateOfBirth: '' });

    expect(setDoc).toHaveBeenCalledWith(userDoc, {
      ...ada,
      createdAt: 'SERVER_TIMESTAMP',
    });
  });
});

describe('updateProfile', () => {
  it('changes only what it is given', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      found({ ...ada, firstName: 'Augusta' }),
    );

    await updateProfile('uid-1', { firstName: 'Augusta' });

    expect(updateDoc).toHaveBeenCalledWith(userDoc, { firstName: 'Augusta' });
  });

  it('removes the date of birth when it is null', async () => {
    vi.mocked(getDoc).mockResolvedValue(found(ada));

    await updateProfile('uid-1', { dateOfBirth: null });

    expect(deleteField).toHaveBeenCalledTimes(1);
    expect(updateDoc).toHaveBeenCalledWith(userDoc, {
      dateOfBirth: 'DELETE_FIELD',
    });
  });

  it('succeeds when the profile cannot be read back for the watchers', async () => {
    vi.mocked(getDoc).mockRejectedValue({ code: 'unavailable' });

    await expect(
      updateProfile('uid-1', { firstName: 'Augusta' }),
    ).resolves.toBeUndefined();
    expect(updateDoc).toHaveBeenCalledTimes(1);
  });
});

describe('saveProfile', () => {
  it('creates the profile when there is none', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);

    await saveProfile('uid-1', ada);

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('completes the profile when a document exists', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      found({ firstName: 'A', lastName: '' }),
    );

    await saveProfile('uid-1', { ...ada, dateOfBirth: '1990-12-10' });

    expect(setDoc).not.toHaveBeenCalled();
    expect(updateDoc).toHaveBeenCalledWith(userDoc, {
      ...ada,
      dateOfBirth: '1990-12-10',
    });
  });
});

describe('createProfileIfMissing', () => {
  it('leaves an existing profile alone', async () => {
    vi.mocked(getDoc).mockResolvedValue(found(ada));

    await expect(createProfileIfMissing('uid-1', {})).resolves.toBe(true);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("creates the profile from the provider's names, trimmed and cut to 30 characters", async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);

    await expect(
      createProfileIfMissing('uid-1', {
        firstName: '  Ada ',
        lastName: 'L'.repeat(40),
      }),
    ).resolves.toBe(true);
    expect(setDoc).toHaveBeenCalledWith(userDoc, {
      firstName: 'Ada',
      lastName: 'L'.repeat(30),
      createdAt: 'SERVER_TIMESTAMP',
    });
  });

  it('writes nothing and says so when a name is missing', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);

    await expect(
      createProfileIfMissing('uid-1', { firstName: 'Ada' }),
    ).resolves.toBe(false);
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('watchProfile', () => {
  it('reports the profile on the server', async () => {
    vi.mocked(getDoc).mockResolvedValue(found(ada));
    const onNext = vi.fn();
    const onError = vi.fn();

    watchProfile('uid-1', onNext, onError);
    await settle();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(ada);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports null when the document does not exist', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);
    const onNext = vi.fn();

    watchProfile('uid-1', onNext, vi.fn());
    await settle();

    expect(onNext).toHaveBeenCalledWith(null);
  });

  it('reports a profile created from this page afterwards (sign-up, Google sign-in)', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);
    const onNext = vi.fn();
    watchProfile('uid-1', onNext, vi.fn());
    await settle();

    await createProfile('uid-1', ada);

    expect(onNext).toHaveBeenLastCalledWith(ada);
  });

  it('reports a completed profile without reading it again', async () => {
    vi.mocked(getDoc).mockResolvedValue(
      found({ firstName: 'A', lastName: '', dateOfBirth: '1990-12-10' }),
    );
    const onNext = vi.fn();
    watchProfile('uid-1', onNext, vi.fn());
    await settle();
    vi.mocked(getDoc).mockClear();

    await saveProfile('uid-1', ada);

    expect(getDoc).toHaveBeenCalledTimes(1); // saveProfile's own check, nothing after the write
    expect(onNext).toHaveBeenLastCalledWith({
      ...ada,
      dateOfBirth: '1990-12-10',
    });
  });

  it('drops a read that a write from this page has overtaken', async () => {
    let answer: (snapshot: never) => void = () => undefined;
    vi.mocked(getDoc).mockReturnValue(
      new Promise(resolve => {
        answer = resolve;
      }) as never,
    );
    const onNext = vi.fn();
    watchProfile('uid-1', onNext, vi.fn());

    await createProfile('uid-1', ada); // the profile is written while the read is on its way
    answer(missing); // and the read still says "missing"
    await settle();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledWith(ada);
  });

  it('only tells the watchers of that user', async () => {
    vi.mocked(getDoc).mockResolvedValue(missing);
    const other = vi.fn();
    watchProfile('uid-2', other, vi.fn());
    await settle();
    other.mockClear();

    await createProfile('uid-1', ada);

    expect(other).not.toHaveBeenCalled();
  });

  it('tries again after a failure, then reports the profile', async () => {
    vi.useFakeTimers();
    vi.mocked(getDoc)
      .mockRejectedValueOnce({ code: 'unavailable' })
      .mockResolvedValueOnce(found(ada));
    const onNext = vi.fn();
    const onError = vi.fn();

    watchProfile('uid-1', onNext, onError);
    await vi.advanceTimersByTimeAsync(PROFILE_READ_RETRY_DELAYS_MS[0]);

    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(onNext).toHaveBeenCalledWith(ada);
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports the error when every attempt failed, with the code and the uid only', async () => {
    vi.useFakeTimers();
    const failure = { code: 'permission-denied', message: 'ada@example.com' };
    vi.mocked(getDoc).mockRejectedValue(failure);
    const onNext = vi.fn();
    const onError = vi.fn();

    watchProfile('uid-1', onNext, onError);
    await vi.runAllTimersAsync();

    expect(getDoc).toHaveBeenCalledTimes(
      PROFILE_READ_RETRY_DELAYS_MS.length + 1,
    );
    expect(onNext).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(failure);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0][0].message).toBe(
      'watchProfile failed: code=permission-denied uid=uid-1',
    );
  });

  it('says nothing after it is stopped', async () => {
    vi.useFakeTimers();
    vi.mocked(getDoc).mockRejectedValue({ code: 'unavailable' });
    const onNext = vi.fn();
    const onError = vi.fn();

    const stop = watchProfile('uid-1', onNext, onError);
    stop();
    await vi.runAllTimersAsync();
    await createProfile('uid-1', ada);

    expect(onNext).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(getDoc).toHaveBeenCalledTimes(1);
  });
});
