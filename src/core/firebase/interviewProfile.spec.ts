import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import {
  createResource,
  getExtractionsToday,
  getFileUrl,
  getItems,
  getResource,
  getResources,
  removeItem,
  removeResource,
  toProfileError,
  updateItem,
  uploadFile,
} from './interviewProfile';

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
    orderBy: vi.fn((field: string, direction: string) => ({
      field,
      direction,
    })),
    query: vi.fn((source: object, ...constraints: object[]) => ({
      ...source,
      constraints,
    })),
  };
});
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => callable),
}));
vi.mock('firebase/storage', () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn((_storage: unknown, path: string) => ({ ref: path })),
  uploadBytesResumable: vi.fn(),
}));

const at = (milliseconds: number) =>
  new (Timestamp as unknown as new (value: number) => Timestamp)(milliseconds);

const document = (id: string, data?: Record<string, unknown>) => ({
  id,
  exists: () => data !== undefined,
  data: () => data,
});

const resourceData = {
  type: 'cv',
  title: 'Maya Okafor CV 2026',
  source: 'file',
  contentType: 'application/pdf',
  storagePath: 'users/uid-1/interview-docs/r1/document.pdf',
  status: 'ready',
  itemCount: 31,
  skill: { id: 'profile-extract', version: '1.1.0' },
  createdAt: at(1_000),
  updatedAt: at(2_000),
  extractedAt: at(2_000),
};
const resource = {
  id: 'r1',
  type: 'cv',
  title: 'Maya Okafor CV 2026',
  source: 'file',
  contentType: 'application/pdf',
  storagePath: 'users/uid-1/interview-docs/r1/document.pdf',
  status: 'ready',
  itemCount: 31,
  createdAt: 1_000,
  updatedAt: 2_000,
};

const codeOf = (action: Promise<unknown>) =>
  action.then(
    () => undefined,
    (error: unknown) =>
      error instanceof ProfileError ? error.code : 'not a ProfileError',
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reading the profile', () => {
  it('lists the resources newest first, as plain values', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [document('r1', resourceData)],
    } as never);

    await expect(getResources('uid-1')).resolves.toEqual([resource]);

    expect(collection).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/interviewProfile/main/resources',
    );
    expect(orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(query).toHaveBeenCalledWith(
      { collection: 'users/uid-1/interviewProfile/main/resources' },
      { field: 'createdAt', direction: 'desc' },
    );
  });

  it('leaves out a document it does not understand, and logs how many, never what', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('r1', resourceData),
        document('r2', { ...resourceData, status: 'archived' }),
        document('r3', { title: 'Zebra-quartz notes' }),
      ],
    } as never);

    await expect(getResources('uid-1')).resolves.toEqual([resource]);

    expect(mockLogger.logError).toHaveBeenCalledTimes(1);
    expect(mockLogger.logError).toHaveBeenCalledWith(
      new Error('getResources: 2 document(s) not understood'),
    );
    expect(JSON.stringify(mockLogger.logError.mock.calls)).not.toContain(
      'Zebra',
    );
  });

  it('reads one resource', async () => {
    vi.mocked(getDoc).mockResolvedValue(document('r1', resourceData) as never);

    await expect(getResource('uid-1', 'r1')).resolves.toEqual(resource);
    expect(doc).toHaveBeenCalledWith(
      { name: 'db' },
      'users/uid-1/interviewProfile/main/resources/r1',
    );
  });

  it('answers null for a resource that is not there, or not understood', async () => {
    vi.mocked(getDoc).mockResolvedValueOnce(document('r1') as never);
    await expect(getResource('uid-1', 'r1')).resolves.toBeNull();

    vi.mocked(getDoc).mockResolvedValueOnce(
      document('r1', { title: 'No status' }) as never,
    );
    await expect(getResource('uid-1', 'r1')).resolves.toBeNull();
  });

  it('lists the items in no order: the pages sort them', async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        document('i1', {
          kind: 'achievement',
          text: 'Cut payment incidents by 40%.',
          evidence: 'Reduced incidents 40%.',
          resourceId: 'r1',
          starred: true,
          hidden: false,
          edited: false,
          skill: { id: 'profile-extract', version: '1.1.0' },
          createdAt: at(5_000),
          updatedAt: at(6_000),
        }),
      ],
    } as never);

    await expect(getItems('uid-1')).resolves.toEqual([
      {
        id: 'i1',
        kind: 'achievement',
        text: 'Cut payment incidents by 40%.',
        evidence: 'Reduced incidents 40%.',
        resourceId: 'r1',
        starred: true,
        hidden: false,
        edited: false,
        createdAt: 5_000,
        updatedAt: 6_000,
      },
    ]);
    expect(getDocs).toHaveBeenCalledWith({
      collection: 'users/uid-1/interviewProfile/main/items',
    });
    expect(orderBy).not.toHaveBeenCalled();
  });

  describe('what was read today', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-13T23:30:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('counts the calls of the profile service in today’s usage document (UTC)', async () => {
      vi.mocked(getDoc).mockResolvedValue(
        document('2026-10-13', {
          calls: 9,
          services: {
            profileExtraction: { calls: 7 },
            applicationBrief: { calls: 2 },
          },
        }) as never,
      );

      await expect(getExtractionsToday('uid-1')).resolves.toBe(7);
      expect(doc).toHaveBeenCalledWith(
        { name: 'db' },
        'usage/uid-1/days/2026-10-13',
      );
    });

    it.each([
      ['no document yet', undefined],
      ['no call of this service', { calls: 2, services: {} }],
      [
        'something that is not a number',
        { services: { profileExtraction: { calls: 'many' } } },
      ],
    ])('is zero with %s', async (_name, data) => {
      vi.mocked(getDoc).mockResolvedValue(
        document('2026-10-13', data) as never,
      );

      await expect(getExtractionsToday('uid-1')).resolves.toBe(0);
    });
  });

  it.each([
    ['permission-denied', ProfileErrorCode.SignedOut],
    ['unauthenticated', ProfileErrorCode.SignedOut],
    ['unavailable', ProfileErrorCode.Network],
    ['deadline-exceeded', ProfileErrorCode.Network],
    ['internal', ProfileErrorCode.Unknown],
  ])(
    'turns a failed read (%s) into a profile error',
    async (code, expected) => {
      vi.mocked(getDocs).mockRejectedValue({ code });
      vi.mocked(getDoc).mockRejectedValue({ code });

      expect(await codeOf(getResources('uid-1'))).toBe(expected);
      expect(await codeOf(getResource('uid-1', 'r1'))).toBe(expected);
      expect(await codeOf(getItems('uid-1'))).toBe(expected);
      expect(await codeOf(getExtractionsToday('uid-1'))).toBe(expected);
    },
  );
});

describe('the callables', () => {
  it('adds a file resource and answers where to upload it', async () => {
    const answer = {
      resourceId: 'r1',
      upload: {
        path: 'users/uid-1/interview-docs/r1/document.pdf',
        contentType: 'application/pdf',
        maxBytes: 10_485_760,
      },
    };
    callable.mockResolvedValue({ data: answer });
    const request = {
      source: 'file',
      type: 'cv',
      title: 'Maya Okafor CV 2026',
      contentType: 'application/pdf',
    } as const;

    await expect(createResource(request)).resolves.toEqual(answer);

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'createProfileResource',
    );
    expect(callable).toHaveBeenCalledWith(request);
  });

  it('adds text and links with no upload', async () => {
    callable.mockResolvedValue({ data: { resourceId: 'r2' } });

    await expect(
      createResource({
        source: 'link',
        type: 'link',
        title: 'Portfolio',
        url: 'https://portfolio.example/',
      }),
    ).resolves.toEqual({ resourceId: 'r2' });
  });

  it('changes an item: its text, its star, whether it is hidden', async () => {
    callable.mockResolvedValue({ data: { itemId: 'i1', removed: false } });

    await expect(
      updateItem('i1', { text: 'New text', starred: true }),
    ).resolves.toBeUndefined();

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'updateSkillMapItem',
    );
    expect(callable).toHaveBeenCalledWith({
      itemId: 'i1',
      text: 'New text',
      starred: true,
    });
  });

  it('removes an item with `remove` alone, as the backend asks', async () => {
    callable.mockResolvedValue({ data: { itemId: 'i1', removed: true } });

    await expect(removeItem('i1')).resolves.toBeUndefined();

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'updateSkillMapItem',
    );
    expect(callable).toHaveBeenCalledWith({ itemId: 'i1', remove: true });
  });

  it('removes a resource and says how many items went with it', async () => {
    callable.mockResolvedValue({
      data: { resourceId: 'r1', itemsRemoved: 31 },
    });

    await expect(removeResource('r1')).resolves.toEqual({ itemsRemoved: 31 });

    expect(httpsCallable).toHaveBeenCalledWith(
      { name: 'functions' },
      'removeProfileResource',
    );
    expect(callable).toHaveBeenCalledWith({ resourceId: 'r1' });
  });

  it.each([
    [
      'createResource',
      () =>
        createResource({
          source: 'text',
          type: 'note',
          title: 'N',
          text: 'Go',
        }),
      { upload: {} },
    ],
    ['updateItem', () => updateItem('i1', { starred: true }), { itemId: 'i1' }],
    ['removeResource', () => removeResource('r1'), { resourceId: 'r1' }],
  ])(
    'does not trust an answer of %s that is not what the contract says',
    async (_name, run, data) => {
      callable.mockResolvedValue({ data });

      expect(await codeOf(run())).toBe(ProfileErrorCode.Unknown);
    },
  );

  it.each([
    [
      { code: 'functions/permission-denied', details: { reason: 'flag' } },
      ProfileErrorCode.FlagOff,
    ],
    [
      { code: 'functions/permission-denied', details: { reason: 'admin' } },
      ProfileErrorCode.SignedOut,
    ],
    [{ code: 'functions/permission-denied' }, ProfileErrorCode.SignedOut],
    [{ code: 'functions/resource-exhausted' }, ProfileErrorCode.DailyLimit],
    [
      {
        code: 'functions/failed-precondition',
        details: { reason: 'max-resources' },
      },
      ProfileErrorCode.MaxResources,
    ],
    [
      { code: 'functions/failed-precondition', details: null },
      ProfileErrorCode.Unknown,
    ],
    [{ code: 'functions/not-found' }, ProfileErrorCode.NotFound],
    [{ code: 'functions/invalid-argument' }, ProfileErrorCode.Invalid],
    [{ code: 'functions/unauthenticated' }, ProfileErrorCode.SignedOut],
    [{ code: 'functions/unavailable' }, ProfileErrorCode.Network],
    [{ code: 'functions/deadline-exceeded' }, ProfileErrorCode.Network],
    [{ code: 'functions/internal' }, ProfileErrorCode.Unknown],
    [{ code: 42 }, ProfileErrorCode.Unknown],
    [new Error('boom'), ProfileErrorCode.Unknown],
    [undefined, ProfileErrorCode.Unknown],
  ])('turns the refusal %j into %s', async (error, expected) => {
    callable.mockRejectedValue(error);

    expect(
      await codeOf(
        createResource({
          source: 'text',
          type: 'note',
          title: 'N',
          text: 'Go',
        }),
      ),
    ).toBe(expected);
  });

  it('reads "internal" as a network failure when the browser is offline', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

    expect(toProfileError({ code: 'functions/internal' }).code).toBe(
      ProfileErrorCode.Network,
    );

    online.mockRestore();
  });

  it('keeps a profile error as it is', () => {
    const error = new ProfileError(ProfileErrorCode.NotFound);

    expect(toProfileError(error)).toBe(error);
  });
});

describe('the file', () => {
  const target = {
    path: 'users/uid-1/interview-docs/r1/document.pdf',
    contentType: 'application/pdf',
    maxBytes: 10_485_760,
  } as const;
  const file = new Blob(['%PDF-1.7 fictional'], { type: 'application/pdf' });

  type Observer = [
    event: string,
    next: (snapshot: { bytesTransferred: number; totalBytes: number }) => void,
    error: (error: unknown) => void,
    complete: () => void,
  ];
  const startUpload = () => {
    const task = { on: vi.fn(), cancel: vi.fn() };
    vi.mocked(uploadBytesResumable).mockReturnValue(task as never);
    return {
      task,
      observer: (): Observer => task.on.mock.calls[0] as Observer,
    };
  };

  it('uploads to the path the backend answered, with its content type', async () => {
    const { task, observer } = startUpload();
    const onProgress = vi.fn();

    const uploading = uploadFile(target, file, { onProgress });
    const [event, next, , complete] = observer();
    next({ bytesTransferred: 0, totalBytes: 200 });
    next({ bytesTransferred: 50, totalBytes: 200 });
    next({ bytesTransferred: 200, totalBytes: 200 });
    complete();

    await expect(uploading).resolves.toBeUndefined();
    expect(ref).toHaveBeenCalledWith({ name: 'storage' }, target.path);
    expect(uploadBytesResumable).toHaveBeenCalledWith(
      { ref: target.path },
      file,
      { contentType: 'application/pdf' },
    );
    expect(event).toBe('state_changed');
    expect(onProgress.mock.calls).toEqual([[0], [0.25], [1]]);
    expect(task.cancel).not.toHaveBeenCalled();
  });

  it('reports no progress before the size is known', async () => {
    const { observer } = startUpload();
    const onProgress = vi.fn();

    const uploading = uploadFile(target, file, { onProgress });
    const [, next, , complete] = observer();
    next({ bytesTransferred: 0, totalBytes: 0 });
    complete();
    await uploading;

    expect(onProgress).not.toHaveBeenCalled();
  });

  it.each([
    ['storage/unauthorized', ProfileErrorCode.UploadRefused],
    ['storage/canceled', ProfileErrorCode.UploadCancelled],
    ['storage/retry-limit-exceeded', ProfileErrorCode.Network],
    ['storage/unauthenticated', ProfileErrorCode.SignedOut],
    ['storage/unknown', ProfileErrorCode.Unknown],
  ])('turns the failure %s into a profile error', async (code, expected) => {
    const { observer } = startUpload();

    const uploading = uploadFile(target, file);
    observer()[2]({ code });

    expect(await codeOf(uploading)).toBe(expected);
  });

  it('stops when asked to, and reports it as cancelled', async () => {
    const { task, observer } = startUpload();
    const controller = new AbortController();

    const uploading = uploadFile(target, file, { signal: controller.signal });
    controller.abort();

    expect(task.cancel).toHaveBeenCalledTimes(1);
    // The SDK then reports the cancellation as an error of its own.
    observer()[2]({ code: 'storage/canceled' });
    expect(await codeOf(uploading)).toBe(ProfileErrorCode.UploadCancelled);
  });

  it('does not start an upload that was stopped before', async () => {
    const controller = new AbortController();
    controller.abort();

    expect(
      await codeOf(uploadFile(target, file, { signal: controller.signal })),
    ).toBe(ProfileErrorCode.UploadCancelled);
    expect(uploadBytesResumable).not.toHaveBeenCalled();
  });

  it('no longer listens for a stop once the upload has ended', async () => {
    const { task, observer } = startUpload();
    const controller = new AbortController();

    const uploading = uploadFile(target, file, { signal: controller.signal });
    observer()[3]();
    await uploading;
    controller.abort();

    expect(task.cancel).not.toHaveBeenCalled();
  });

  it('gives the address that downloads the stored file', async () => {
    vi.mocked(getDownloadURL).mockResolvedValue(
      'https://firebasestorage.googleapis.com/v0/b/demo/o/file?alt=media',
    );

    await expect(getFileUrl({ storagePath: target.path })).resolves.toBe(
      'https://firebasestorage.googleapis.com/v0/b/demo/o/file?alt=media',
    );
    expect(ref).toHaveBeenCalledWith({ name: 'storage' }, target.path);
  });

  it('says when the stored file is not there', async () => {
    vi.mocked(getDownloadURL).mockRejectedValue({
      code: 'storage/object-not-found',
    });

    expect(await codeOf(getFileUrl({ storagePath: target.path }))).toBe(
      ProfileErrorCode.NotFound,
    );
  });
});
