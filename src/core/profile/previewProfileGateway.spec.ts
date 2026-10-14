import {
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
  PROFILE_UPLOAD_MAX_BYTES,
} from './contract';
import { ProfileErrorCode } from './errors';
import { PREVIEW_FACTS } from './previewProfileData';
import {
  createPreviewProfileGateway,
  exposePreviewProfileControls,
  PREVIEW_READ_MS,
  type PreviewProfileStorage,
} from './previewProfileGateway';

import { PREVIEW_GATEWAY_MARKER } from '@/core/auth/previewGateway';

const UID = 'preview-user';

const memoryStorage = (): PreviewProfileStorage & {
  values: Map<string, string>;
} => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

const codeOf = (action: Promise<unknown>) =>
  action.then(
    () => undefined,
    (error: { code?: string }) => error.code,
  );

/** A gateway with a clock the spec moves, for an account whose profile was read once. */
const setUp = async (storage: PreviewProfileStorage | null = null) => {
  const clock = { time: 1_000_000 };
  const gateway = createPreviewProfileGateway({
    storage,
    now: () => clock.time,
    wait: () => Promise.resolve(),
  });
  await gateway.getResources(UID);
  const pass = (milliseconds: number) => {
    clock.time += milliseconds;
  };
  return { gateway, clock, pass };
};

const note = {
  source: 'text',
  type: 'note',
  title: 'Stories for interviews',
  text: 'Pushed back on a launch date.',
} as const;
const cvFile = {
  source: 'file',
  type: 'cv',
  title: 'Maya Okafor CV 2026',
  contentType: 'application/pdf',
} as const;
const pdf = new Blob(['%PDF-1.7 fictional'], { type: 'application/pdf' });

describe('previewProfileGateway', () => {
  it('starts with an empty profile', async () => {
    const { gateway } = await setUp();

    await expect(gateway.getResources(UID)).resolves.toEqual([]);
    await expect(gateway.getItems(UID)).resolves.toEqual([]);
    await expect(gateway.getExtractionsToday(UID)).resolves.toBe(0);
    await expect(gateway.getResource(UID, 'nope')).resolves.toBeNull();
  });

  it('carries the marker the bundle check looks for', async () => {
    const storage = memoryStorage();
    const { gateway } = await setUp(storage);

    await gateway.createResource(note);

    expect([...storage.values.keys()]).toEqual([
      `${PREVIEW_GATEWAY_MARKER}-profile`,
    ]);
  });

  describe('a resource that is added', () => {
    it('reads pasted text straight away, and is ready a moment later', async () => {
      const { gateway, pass } = await setUp();

      const { resourceId, upload } = await gateway.createResource(note);

      expect(upload).toBeUndefined();
      expect(await gateway.getResource(UID, resourceId)).toMatchObject({
        id: resourceId,
        type: 'note',
        title: 'Stories for interviews',
        source: 'text',
        status: 'processing',
        itemCount: 0,
      });

      pass(PREVIEW_READ_MS - 1);
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'processing',
      );
      await expect(gateway.getItems(UID)).resolves.toEqual([]);

      pass(1);
      expect(await gateway.getResource(UID, resourceId)).toMatchObject({
        status: 'ready',
        itemCount: PREVIEW_FACTS.note.length,
      });
      const items = await gateway.getItems(UID);
      expect(items.map(item => item.text)).toEqual(
        PREVIEW_FACTS.note.map(entry => entry.text),
      );
      expect(items.every(item => item.resourceId === resourceId)).toBe(true);
      expect(items[0]).toMatchObject({
        starred: false,
        hidden: false,
        edited: false,
      });
    });

    it('waits for the file, reports the upload as it goes, then reads it', async () => {
      const { gateway, pass } = await setUp();
      const progress: number[] = [];

      const { resourceId, upload } = await gateway.createResource(cvFile);

      expect(upload).toEqual({
        path: expect.stringContaining(resourceId),
        contentType: 'application/pdf',
        maxBytes: PROFILE_UPLOAD_MAX_BYTES,
      });
      // Nothing happens until the file arrives, however long that takes.
      pass(10 * PREVIEW_READ_MS);
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'awaitingUpload',
      );

      await gateway.uploadFile(upload!, pdf, {
        onProgress: fraction => progress.push(fraction),
      });

      expect(progress).toEqual([0.25, 0.5, 0.75, 1]);
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'processing',
      );
      pass(PREVIEW_READ_MS);
      expect(await gateway.getResource(UID, resourceId)).toMatchObject({
        status: 'ready',
        itemCount: PREVIEW_FACTS.cv.length,
      });
    });

    it('cannot read a link to a host ending in .invalid, like the backend’s fake model', async () => {
      const { gateway, pass } = await setUp();

      const { resourceId } = await gateway.createResource({
        source: 'link',
        type: 'link',
        title: 'Portfolio',
        url: 'https://portfolio.invalid/maya#top',
      });
      pass(PREVIEW_READ_MS);

      expect(await gateway.getResource(UID, resourceId)).toMatchObject({
        status: 'failed',
        failure: 'link-unreadable',
        url: 'https://portfolio.invalid/maya',
        itemCount: 0,
      });
      await expect(gateway.getItems(UID)).resolves.toEqual([]);
    });

    it('reads another link', async () => {
      const { gateway, pass } = await setUp();

      const { resourceId } = await gateway.createResource({
        source: 'link',
        type: 'link',
        title: 'Conference talk',
        url: 'https://talks.example/ledgers',
      });
      pass(PREVIEW_READ_MS);

      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'ready',
      );
    });

    it('does not add twice what the profile already has: "nothing new found"', async () => {
      const { gateway, pass } = await setUp();
      await gateway.createResource(note);
      pass(PREVIEW_READ_MS);
      await gateway.getResources(UID);

      const { resourceId } = await gateway.createResource({
        ...note,
        title: 'The same stories again',
      });
      pass(PREVIEW_READ_MS);

      expect(await gateway.getResource(UID, resourceId)).toMatchObject({
        status: 'ready',
        itemCount: 0,
      });
      await expect(gateway.getItems(UID)).resolves.toHaveLength(
        PREVIEW_FACTS.note.length,
      );
    });

    it('lists the resources newest first', async () => {
      const { gateway, pass } = await setUp();
      await gateway.createResource({ ...note, title: 'First' });
      pass(10);
      await gateway.createResource({ ...note, title: 'Second' });
      pass(10);
      await gateway.createResource({ ...note, title: 'Third' });

      const titles = (await gateway.getResources(UID)).map(
        ({ title }) => title,
      );

      expect(titles).toEqual(['Third', 'Second', 'First']);
    });

    it('counts it against today’s limit', async () => {
      const { gateway } = await setUp();

      await gateway.createResource(note);
      await gateway.createResource(cvFile);

      await expect(gateway.getExtractionsToday(UID)).resolves.toBe(2);
    });
  });

  describe('what the backend refuses', () => {
    it.each([
      ['an empty title', { ...note, title: '   ' }],
      ['a title that is too long', { ...note, title: 'a'.repeat(101) }],
      ['no text', { ...note, text: '  ' }],
      ['a text that is too long', { ...note, text: 'a'.repeat(50_001) }],
      ['a file given as a note', { ...cvFile, type: 'note' }],
      ['a file of another type', { ...cvFile, contentType: 'image/png' }],
      [
        'an address that is not https',
        {
          source: 'link',
          type: 'link',
          title: 'Site',
          url: 'http://a.example',
        },
      ],
      [
        'a link given as a CV',
        { source: 'link', type: 'cv', title: 'Site', url: 'https://a.example' },
      ],
    ])('refuses %s', async (_name, request) => {
      const { gateway } = await setUp();

      expect(await codeOf(gateway.createResource(request as never))).toBe(
        ProfileErrorCode.Invalid,
      );
      await expect(gateway.getResources(UID)).resolves.toEqual([]);
    });

    it('refuses the twenty-first resource', async () => {
      const { gateway } = await setUp();
      for (let index = 0; index < PROFILE_MAX_RESOURCES; index += 1) {
        await gateway.createResource({ ...note, title: `Note ${index}` });
      }
      gateway.controls.setExtractionsToday(0);

      expect(await codeOf(gateway.createResource(note))).toBe(
        ProfileErrorCode.MaxResources,
      );
      await expect(gateway.getResources(UID)).resolves.toHaveLength(
        PROFILE_MAX_RESOURCES,
      );
    });

    it('refuses a resource once today’s limit is reached', async () => {
      const { gateway } = await setUp();
      gateway.controls.setExtractionsToday(PROFILE_DAILY_EXTRACTIONS);

      expect(await codeOf(gateway.createResource(note))).toBe(
        ProfileErrorCode.DailyLimit,
      );
      await expect(gateway.getResources(UID)).resolves.toEqual([]);
    });

    it('acts for nobody while nobody is signed in and no profile was read', async () => {
      const gateway = createPreviewProfileGateway({ storage: null });

      expect(await codeOf(gateway.createResource(note))).toBe(
        ProfileErrorCode.SignedOut,
      );
      expect(() => gateway.controls.seed()).toThrow();
    });

    it('acts for whoever the preview auth gateway has signed in, before any read', async () => {
      const storage = memoryStorage();
      storage.setItem(
        PREVIEW_GATEWAY_MARKER,
        JSON.stringify({ accounts: [], currentUid: UID }),
      );
      // A second gateway of the same page: the home read the profile through another.
      const gateway = createPreviewProfileGateway({ storage });

      const { resourceId } = await gateway.createResource(note);

      expect((await gateway.getResource(UID, resourceId))?.title).toBe(
        'Stories for interviews',
      );
      expect(() => gateway.controls.seed()).not.toThrow();
      await expect(gateway.getResources('another-user')).resolves.toEqual([]);
    });

    it('goes by the last profile read when the session cannot be told', async () => {
      const storage = memoryStorage();
      storage.setItem(PREVIEW_GATEWAY_MARKER, 'not json');
      const gateway = createPreviewProfileGateway({ storage });
      await gateway.getResources(UID);

      await expect(gateway.createResource(note)).resolves.toMatchObject({
        resourceId: expect.any(String),
      });
    });
  });

  describe('the upload', () => {
    it('is accepted once: a second one to the same place is refused', async () => {
      const { gateway } = await setUp();
      const { upload } = await gateway.createResource(cvFile);
      await gateway.uploadFile(upload!, pdf);

      expect(await codeOf(gateway.uploadFile(upload!, pdf))).toBe(
        ProfileErrorCode.UploadRefused,
      );
    });

    it.each([
      ['an empty file', new Blob([])],
      ['a file over the limit', { size: PROFILE_UPLOAD_MAX_BYTES + 1 } as Blob],
    ])('refuses %s', async (_name, file) => {
      const { gateway } = await setUp();
      const { resourceId, upload } = await gateway.createResource(cvFile);

      expect(await codeOf(gateway.uploadFile(upload!, file))).toBe(
        ProfileErrorCode.UploadRefused,
      );
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'awaitingUpload',
      );
    });

    it('refuses a place no resource is waiting at', async () => {
      const { gateway } = await setUp();

      expect(
        await codeOf(
          gateway.uploadFile(
            {
              path: 'users/someone-else/interview-docs/r1/document.pdf',
              contentType: 'application/pdf',
              maxBytes: PROFILE_UPLOAD_MAX_BYTES,
            },
            pdf,
          ),
        ),
      ).toBe(ProfileErrorCode.UploadRefused);
    });

    it('can be stopped, and the resource keeps waiting', async () => {
      const { gateway } = await setUp();
      const { resourceId, upload } = await gateway.createResource(cvFile);
      const controller = new AbortController();
      const progress: number[] = [];

      const uploading = gateway.uploadFile(upload!, pdf, {
        signal: controller.signal,
        onProgress: fraction => {
          progress.push(fraction);
          controller.abort();
        },
      });

      expect(await codeOf(uploading)).toBe(ProfileErrorCode.UploadCancelled);
      expect(progress).toEqual([0.25]);
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'awaitingUpload',
      );
    });

    it('does not start when it was stopped before', async () => {
      const { gateway } = await setUp();
      const { upload } = await gateway.createResource(cvFile);
      const controller = new AbortController();
      controller.abort();
      const onProgress = vi.fn();

      expect(
        await codeOf(
          gateway.uploadFile(upload!, pdf, {
            signal: controller.signal,
            onProgress,
          }),
        ),
      ).toBe(ProfileErrorCode.UploadCancelled);
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  describe('the skill map', () => {
    const withItems = async () => {
      const context = await setUp();
      const { resourceId } = await context.gateway.createResource(note);
      context.pass(PREVIEW_READ_MS);
      const items = await context.gateway.getItems(UID);
      return { ...context, resourceId, items };
    };

    it('stars and hides an item without marking it as edited', async () => {
      const { gateway, items } = await withItems();

      await gateway.updateItem(items[0].id, { starred: true, hidden: true });

      expect((await gateway.getItems(UID))[0]).toMatchObject({
        starred: true,
        hidden: true,
        edited: false,
        text: items[0].text,
      });
    });

    it('changes the text of an item and marks it as edited', async () => {
      const { gateway, items } = await withItems();

      await gateway.updateItem(items[0].id, {
        text: '  Asked for two more weeks after a failed load test.  ',
      });

      expect((await gateway.getItems(UID))[0]).toMatchObject({
        text: 'Asked for two more weeks after a failed load test.',
        edited: true,
        evidence: items[0].evidence,
      });
    });

    it('does not mark an item as edited when the text is the same', async () => {
      const { gateway, items } = await withItems();

      await gateway.updateItem(items[0].id, { text: items[0].text });

      expect((await gateway.getItems(UID))[0].edited).toBe(false);
    });

    it.each([
      ['no change at all', {}],
      ['an empty text', { text: '   ' }],
      ['a text that is too long', { text: 'a'.repeat(601) }],
    ])('refuses %s', async (_name, change) => {
      const { gateway, items } = await withItems();

      expect(await codeOf(gateway.updateItem(items[0].id, change))).toBe(
        ProfileErrorCode.Invalid,
      );
    });

    it('removes one item, and the resource counts one less', async () => {
      const { gateway, items, resourceId } = await withItems();

      await gateway.removeItem(items[0].id);

      expect((await gateway.getItems(UID)).map(({ id }) => id)).toEqual(
        items.slice(1).map(({ id }) => id),
      );
      expect((await gateway.getResource(UID, resourceId))?.itemCount).toBe(
        items.length - 1,
      );
    });

    it('does not know an item that is not there', async () => {
      const { gateway } = await withItems();

      expect(await codeOf(gateway.updateItem('nope', { starred: true }))).toBe(
        ProfileErrorCode.NotFound,
      );
      expect(await codeOf(gateway.removeItem('nope'))).toBe(
        ProfileErrorCode.NotFound,
      );
    });

    it('removes a resource with every item that came from it', async () => {
      const { gateway, pass, resourceId, items } = await withItems();
      const other = await gateway.createResource({
        source: 'link',
        type: 'link',
        title: 'Conference talk',
        url: 'https://talks.example/ledgers',
      });
      pass(PREVIEW_READ_MS);
      await gateway.getResources(UID);

      await expect(gateway.removeResource(resourceId)).resolves.toEqual({
        itemsRemoved: items.length,
      });

      expect((await gateway.getResources(UID)).map(({ id }) => id)).toEqual([
        other.resourceId,
      ]);
      expect(
        (await gateway.getItems(UID)).every(
          item => item.resourceId === other.resourceId,
        ),
      ).toBe(true);
      expect(await codeOf(gateway.removeResource(resourceId))).toBe(
        ProfileErrorCode.NotFound,
      );
    });
  });

  describe('the controls', () => {
    it('can make the next reading fail, once', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.failNext('too-long');

      const failed = await gateway.createResource(note);
      const fine = await gateway.createResource({ ...note, title: 'Again' });
      pass(PREVIEW_READ_MS);

      expect(await gateway.getResource(UID, failed.resourceId)).toMatchObject({
        status: 'failed',
        failure: 'too-long',
      });
      expect((await gateway.getResource(UID, fine.resourceId))?.status).toBe(
        'ready',
      );
    });

    it('can make the next reading never end, once', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.stallNext();

      const stuck = await gateway.createResource(note);
      const fine = await gateway.createResource({ ...note, title: 'Again' });
      pass(60 * 60 * 1000);

      expect((await gateway.getResource(UID, stuck.resourceId))?.status).toBe(
        'processing',
      );
      expect((await gateway.getResource(UID, fine.resourceId))?.status).toBe(
        'ready',
      );
    });

    it('can load the profile of the designs: six resources, one in each state', async () => {
      const { gateway, pass } = await setUp();
      await gateway.createResource(note);

      gateway.controls.seed();
      pass(60 * 60 * 1000);

      const resources = await gateway.getResources(UID);
      expect(
        resources.map(({ type, title, status, failure, itemCount }) => ({
          type,
          title,
          status,
          failure,
          itemCount,
        })),
      ).toEqual([
        {
          type: 'cv',
          title: 'Maya Okafor CV 2026',
          status: 'ready',
          failure: undefined,
          itemCount: PREVIEW_FACTS.cv.length,
        },
        {
          type: 'document',
          title: 'Performance review 2025',
          status: 'ready',
          failure: undefined,
          itemCount: PREVIEW_FACTS.document.length,
        },
        {
          type: 'note',
          title: 'Stories for interviews',
          status: 'processing',
          failure: undefined,
          itemCount: 0,
        },
        {
          type: 'document',
          title: 'Portfolio case study',
          status: 'awaitingUpload',
          failure: undefined,
          itemCount: 0,
        },
        {
          type: 'cv',
          title: 'LinkedIn profile export',
          status: 'ready',
          failure: undefined,
          itemCount: 0,
        },
        {
          type: 'link',
          title: 'Conference talk: Ledgers without tears',
          status: 'failed',
          failure: 'link-unreadable',
          itemCount: 0,
        },
      ]);
      await expect(gateway.getItems(UID)).resolves.toHaveLength(
        PREVIEW_FACTS.cv.length + PREVIEW_FACTS.document.length,
      );
    });

    it('are put on window.qdPreviewProfile', () => {
      const gateway = createPreviewProfileGateway({ storage: null });

      expect(exposePreviewProfileControls(gateway)).toBe(gateway);
      expect(window.qdPreviewProfile).toBe(gateway.controls);

      delete window.qdPreviewProfile;
    });
  });

  describe('where it keeps things', () => {
    it('keeps a profile across a reload (same storage), per account', async () => {
      const storage = memoryStorage();
      const first = await setUp(storage);
      const { resourceId } = await first.gateway.createResource(note);
      first.pass(PREVIEW_READ_MS);
      await first.gateway.getResources(UID);

      const second = createPreviewProfileGateway({
        storage,
        now: () => first.clock.time,
      });

      expect(await second.getResource(UID, resourceId)).toMatchObject({
        status: 'ready',
      });
      await expect(second.getItems(UID)).resolves.toHaveLength(
        PREVIEW_FACTS.note.length,
      );
      await expect(second.getResources('another-user')).resolves.toEqual([]);
    });

    it('never hands out its own records: a change to an answer changes nothing', async () => {
      const { gateway, pass } = await setUp();
      await gateway.createResource(note);
      pass(PREVIEW_READ_MS);

      const [item] = await gateway.getItems(UID);
      item.text = 'changed outside';
      const [resource] = await gateway.getResources(UID);
      resource.title = 'changed outside';

      expect((await gateway.getItems(UID))[0].text).not.toBe('changed outside');
      expect((await gateway.getResources(UID))[0].title).toBe(
        'Stories for interviews',
      );
      expect(resource).not.toHaveProperty('settlesAt');
      expect(resource).not.toHaveProperty('outcome');
    });

    it.each([
      ['missing', null],
      [
        'broken',
        {
          getItem: () => {
            throw new Error('blocked');
          },
          setItem: () => {
            throw new Error('blocked');
          },
        },
      ],
      [
        'holding something else',
        { getItem: () => 'not json', setItem: vi.fn() },
      ],
      [
        'holding another shape',
        { getItem: () => '{"profiles":3}', setItem: vi.fn() },
      ],
    ])('works in memory when storage is %s', async (_name, storage) => {
      const { gateway } = await setUp(storage);

      const { resourceId } = await gateway.createResource(note);

      expect((await gateway.getResource(UID, resourceId))?.title).toBe(
        'Stories for interviews',
      );
    });
  });
});
