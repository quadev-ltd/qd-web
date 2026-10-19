import {
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
  PROFILE_UPLOAD_MAX_BYTES,
} from './contract';
import {
  CV_DAILY_VERSIONS,
  type CvEditVersion,
  type CvVersion,
  isWrittenVersion,
} from './cvVersions';
import { ProfileErrorCode } from './errors';
import { PREVIEW_CV_DETAILS, PREVIEW_FACTS } from './previewProfileData';
import {
  createPreviewProfileGateway,
  exposePreviewProfileControls,
  PREVIEW_BRIEF_MS,
  PREVIEW_CV_MS,
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

  describe('applications', () => {
    const job = {
      job: {
        source: 'text',
        text: 'Senior Backend Engineer\nNorthwind Logistics\nGo services in production.',
      },
    } as const;

    /** Adds an application and lets the fake read its job. */
    const added = async (
      gateway: Awaited<ReturnType<typeof setUp>>['gateway'],
      pass: (milliseconds: number) => void,
      request: Parameters<typeof gateway.createApplication>[0] = job,
    ) => {
      const { applicationId } = await gateway.createApplication(request);
      pass(PREVIEW_READ_MS);
      await gateway.getApplications(UID);
      return applicationId;
    };

    it('creates an application, and lists the most recently changed first', async () => {
      const { gateway, pass } = await setUp();

      const { applicationId: first } = await gateway.createApplication(job);
      pass(1000);
      const { applicationId: second } = await gateway.createApplication({
        ...job,
        title: '  Platform Engineer  ',
      });

      const applications = await gateway.getApplications(UID);
      expect(applications.map(({ id }) => id)).toEqual([second, first]);
      expect(applications[0]).toMatchObject({
        title: 'Platform Engineer',
        revision: 1,
      });
      await expect(gateway.getApplication(UID, first)).resolves.toMatchObject({
        id: first,
      });
      await expect(gateway.getApplication(UID, 'nope')).resolves.toBeNull();
    });

    it('refuses what the backend refuses: no text, a long job, a private address, another kind of file', async () => {
      const { gateway } = await setUp();
      const refused = (
        request: Parameters<typeof gateway.createApplication>[0],
      ) => codeOf(gateway.createApplication(request));

      expect(await refused({ job: { source: 'text', text: ' ' } })).toBe(
        ProfileErrorCode.Invalid,
      );
      expect(
        await refused({ job: { source: 'text', text: 'a'.repeat(20_001) } }),
      ).toBe(ProfileErrorCode.Invalid);
      expect(
        await refused({
          job: { source: 'link', url: 'http://intranet.local/job' },
        }),
      ).toBe(ProfileErrorCode.Invalid);
      expect(
        await refused({
          job: {
            source: 'file',
            contentType: 'image/png' as 'application/pdf',
            fileName: 'job.png',
          },
        }),
      ).toBe(ProfileErrorCode.Invalid);
    });

    it('reads a pasted job: being read, then ready, with its names from its first lines', async () => {
      const { gateway, pass } = await setUp();
      const { applicationId } = await gateway.createApplication(job);

      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ title: '', job: { status: 'reading' } });
      pass(PREVIEW_READ_MS);

      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({
        title: 'Senior Backend Engineer',
        company: 'Northwind Logistics',
        job: { source: 'text', status: 'ready' },
      });
    });

    it('keeps the names given, and reads a posting: its copy and names from its address, or "could not read"', async () => {
      const { gateway, pass } = await setUp();
      const read = await added(gateway, pass, {
        job: {
          source: 'link',
          url: 'https://careers.northwind.example/senior-backend-engineer',
        },
        title: 'My title',
      });
      const failed = await added(gateway, pass, {
        job: { source: 'link', url: 'https://jobs.invalid/1' },
      });

      await expect(gateway.getApplication(UID, read)).resolves.toMatchObject({
        title: 'My title',
        company: 'Northwind',
        postingUrl: 'https://careers.northwind.example/senior-backend-engineer',
        job: { source: 'link', status: 'ready' },
      });
      expect(
        (await gateway.getApplication(UID, read))?.jobDescription,
      ).toContain('Copy of the posting');
      await expect(gateway.getApplication(UID, failed)).resolves.toMatchObject({
        job: { status: 'failed', failure: 'link-unreadable' },
      });
    });

    it('reads a job given as a file once it is uploaded, with its title from the file’s name', async () => {
      const { gateway, pass } = await setUp();
      const { applicationId, upload } = await gateway.createApplication({
        job: {
          source: 'file',
          contentType: 'application/pdf',
          fileName: 'senior-backend-engineer.pdf',
        },
      });
      expect(upload?.path).toBe(
        `users/${UID}/application-docs/${applicationId}/job`,
      );
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'awaitingUpload' } });

      await gateway.uploadFile(upload!, pdf);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'reading' } });
      pass(PREVIEW_READ_MS);

      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({
        title: 'senior backend engineer',
        job: {
          source: 'file',
          status: 'ready',
          fileName: 'senior-backend-engineer.pdf',
        },
      });
    });

    it('fails the next reading on request; a text pasted after a failure makes the job ready', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.failNextJob('model');
      const applicationId = await added(gateway, pass);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'failed', failure: 'model' } });

      await gateway.updateApplication({
        applicationId,
        jobDescription: 'Go services in production.',
      });

      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'ready', edited: true } });
    });

    it('does not change the job, nor prepare a brief, while the job is being read (job-not-ready)', async () => {
      const { gateway } = await setUp();
      const { applicationId } = await gateway.createApplication(job);

      expect(
        await codeOf(
          gateway.updateApplication({ applicationId, jobDescription: 'New' }),
        ),
      ).toBe(ProfileErrorCode.Reading);
      expect(await codeOf(gateway.prepareBrief(applicationId))).toBe(
        ProfileErrorCode.Reading,
      );
    });

    it('counts a job read towards today’s limit', async () => {
      const { gateway } = await setUp();
      gateway.controls.setExtractionsToday(PROFILE_DAILY_EXTRACTIONS);

      expect(await codeOf(gateway.createApplication(job))).toBe(
        ProfileErrorCode.DailyLimit,
      );
    });

    it('holds 50 applications at most', async () => {
      const { gateway } = await setUp();
      for (let index = 0; index < 50; index += 1) {
        gateway.controls.setExtractionsToday(0);
        await gateway.createApplication({
          job: { source: 'text', text: `Job ${index}` },
        });
      }
      gateway.controls.setExtractionsToday(0);

      expect(await codeOf(gateway.createApplication(job))).toBe(
        ProfileErrorCode.MaxApplications,
      );
    });

    it('changes an application: a change the brief is built from moves its revision, the address does not', async () => {
      const { gateway, pass } = await setUp();
      const applicationId = await added(gateway, pass);

      await expect(
        gateway.updateApplication({
          applicationId,
          postingUrl: 'https://northwind.example/jobs/1',
        }),
      ).resolves.toEqual({ revision: 1 });
      await expect(
        gateway.updateApplication({ applicationId, company: 'Northwind' }),
      ).resolves.toEqual({ revision: 2 });
      await expect(
        gateway.updateApplication({ applicationId, company: null }),
      ).resolves.toEqual({ revision: 3 });

      const application = await gateway.getApplication(UID, applicationId);
      expect(application?.company).toBeUndefined();
      expect(application?.postingUrl).toBe('https://northwind.example/jobs/1');
    });

    it('does not empty the job description, and says when an application is gone', async () => {
      const { gateway, pass } = await setUp();
      const applicationId = await added(gateway, pass);

      expect(
        await codeOf(
          gateway.updateApplication({ applicationId, jobDescription: ' ' }),
        ),
      ).toBe(ProfileErrorCode.Invalid);
      expect(
        await codeOf(
          gateway.updateApplication({ applicationId: 'nope', title: 'Go' }),
        ),
      ).toBe(ProfileErrorCode.NotFound);
    });

    it('removes an application', async () => {
      const { gateway, pass } = await setUp();
      const applicationId = await added(gateway, pass);

      await gateway.removeApplication(applicationId);

      await expect(gateway.getApplications(UID)).resolves.toEqual([]);
      expect(await codeOf(gateway.removeApplication(applicationId))).toBe(
        ProfileErrorCode.NotFound,
      );
    });

    it('moves the profile’s revision with every change to the resources', async () => {
      const { gateway, pass } = await setUp();
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(0);

      const { resourceId } = await gateway.createResource(note);
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(1);
      pass(PREVIEW_READ_MS);
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(2);
      await gateway.removeResource(resourceId);
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(3);
    });

    it('prepares a brief: a requirement for each sentence of the job, the last two as gaps, and four questions', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.seed();
      const applicationId = await added(gateway, pass, {
        job: {
          source: 'text',
          text: 'You will run Go services. You will mentor engineers. You will lead incidents. You know Kafka.',
        },
      });

      await gateway.prepareBrief(applicationId);

      const brief = (await gateway.getApplication(UID, applicationId))?.brief;
      expect(
        brief?.requirements.map(({ itemIds }) => itemIds.length > 0),
      ).toEqual([true, true, false, false]);
      expect(brief?.requirements[0]?.evidence).toBe(
        'You will run Go services.',
      );
      expect(brief?.questions).toHaveLength(4);
      expect(brief?.applicationRevision).toBe(1);
      await expect(gateway.getBriefsToday(UID)).resolves.toBe(1);
      expect(PREVIEW_BRIEF_MS).toBeGreaterThan(0);
    });

    it('fails a brief on request, and stops at today’s limit of 10', async () => {
      const { gateway, pass } = await setUp();
      const applicationId = await added(gateway, pass);

      gateway.controls.failNextBrief('model');
      expect(await codeOf(gateway.prepareBrief(applicationId))).toBe(
        ProfileErrorCode.Unknown,
      );
      gateway.controls.failNextBrief('quota');
      expect(await codeOf(gateway.prepareBrief(applicationId))).toBe(
        ProfileErrorCode.DailyLimit,
      );
      gateway.controls.setBriefsToday(10);
      expect(await codeOf(gateway.prepareBrief(applicationId))).toBe(
        ProfileErrorCode.DailyLimit,
      );
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.not.toHaveProperty('brief');
    });

    it('seeds the three applications of the designs: a brief with two gaps, one the job changed since, none', async () => {
      const { gateway } = await setUp();
      gateway.controls.seed();

      gateway.controls.seedApplications();

      const applications = await gateway.getApplications(UID);
      expect(applications.map(({ title }) => title)).toEqual([
        'Senior Backend Engineer',
        'Engineering Manager',
        'Platform Engineer',
      ]);
      const [ready, changed, none] = applications;
      expect(
        ready?.brief?.requirements.filter(
          ({ itemIds }) => itemIds.length === 0,
        ),
      ).toHaveLength(2);
      expect(changed?.brief?.applicationRevision).toBeLessThan(
        changed?.revision ?? 0,
      );
      expect(none?.brief).toBeUndefined();
    });
  });

  describe('the texts kept of resources (D78)', () => {
    it('keeps a note as it was pasted once it is read, and nothing before', async () => {
      const { gateway, pass } = await setUp();
      const { resourceId } = await gateway.createResource(note);
      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toBeNull();

      pass(PREVIEW_READ_MS);

      const resource = await gateway.getResource(UID, resourceId);
      expect(resource?.textAt).toBe(1_000_000 + PREVIEW_READ_MS);
      expect(resource).not.toHaveProperty('pasted');
      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toMatchObject({
        text: 'Pushed back on a launch date.',
        kind: 'note',
        format: 'text',
      });
    });

    it('keeps the text of a file and the copy of a link’s page once they are read', async () => {
      const { gateway, pass } = await setUp();
      const { resourceId, upload } = await gateway.createResource(cvFile);
      await gateway.uploadFile(upload!, pdf);
      const { resourceId: link } = await gateway.createResource({
        source: 'link',
        type: 'link',
        title: 'Talk',
        url: 'https://talks.example/ledgers',
      });
      pass(PREVIEW_READ_MS);

      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toMatchObject({
        kind: 'file',
        format: 'pdf',
      });
      await expect(gateway.getResourceText(UID, link)).resolves.toMatchObject({
        text: expect.stringContaining('https://talks.example/ledgers'),
        kind: 'page',
        format: 'page',
      });
      expect((await gateway.getResource(UID, link))?.textAt).toEqual(
        expect.any(Number),
      );
    });

    it('keeps no text for a resource that could not be read', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.failNext('link-unreadable');
      const { resourceId } = await gateway.createResource({
        source: 'link',
        type: 'link',
        title: 'Talk',
        url: 'https://talks.example/ledgers',
      });
      pass(PREVIEW_READ_MS);

      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'failed',
      );
      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toBeNull();
    });

    it('removes the text with its resource', async () => {
      const { gateway, pass } = await setUp();
      const { resourceId } = await gateway.createResource(note);
      pass(PREVIEW_READ_MS);
      await gateway.getResources(UID);

      await gateway.removeResource(resourceId);

      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toBeNull();
    });

    it('gives the ready resources of the designs their texts', async () => {
      const { gateway } = await setUp();
      gateway.controls.seed();

      const cv = (await gateway.getResources(UID)).find(
        ({ title }) => title === 'Maya Okafor CV 2026',
      );
      expect(cv?.textAt).toEqual(expect.any(Number));
      await expect(gateway.getResourceText(UID, cv!.id)).resolves.toMatchObject(
        {
          kind: 'file',
        },
      );
    });
  });

  describe('a page read again (D78, research doc 17, slice 4)', () => {
    const link = {
      source: 'link',
      type: 'link',
      title: 'Talk',
      url: 'https://talks.example/ledgers',
    } as const;
    const posting = {
      job: { source: 'link', url: 'https://careers.northwind.example/sbe' },
    } as const;

    /** A link that was read, with its copy. */
    const readLink = async () => {
      const set = await setUp();
      const { resourceId } = await set.gateway.createResource(link);
      set.pass(PREVIEW_READ_MS);
      await set.gateway.getResources(UID);
      return { ...set, resourceId };
    };

    /** An application from a posting that was read. */
    const readPosting = async () => {
      const set = await setUp();
      const { applicationId } = await set.gateway.createApplication(posting);
      set.pass(PREVIEW_READ_MS);
      await set.gateway.getApplications(UID);
      return { ...set, applicationId };
    };

    it('reads a link again with its copy kept meanwhile; the same page only dates the copy', async () => {
      const { gateway, pass, clock, resourceId } = await readLink();
      const before = await gateway.getResourceText(UID, resourceId);
      const revision = await gateway.getProfileRevision(UID);

      await gateway.readLinkAgain(resourceId);
      await expect(gateway.getResource(UID, resourceId)).resolves.toMatchObject(
        {
          status: 'ready',
          refresh: { status: 'reading', startedAt: clock.time },
        },
      );
      await expect(gateway.getResourceText(UID, resourceId)).resolves.toEqual(
        before,
      );
      pass(PREVIEW_READ_MS);

      await expect(gateway.getResource(UID, resourceId)).resolves.toMatchObject(
        { refresh: { status: 'done', changed: false }, textAt: clock.time },
      );
      await expect(
        gateway.getResourceText(UID, resourceId),
      ).resolves.toMatchObject({ text: before?.text, takenAt: clock.time });
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(revision);
      await expect(gateway.getExtractionsToday(UID)).resolves.toBe(2);
    });

    it('replaces the copy of a page that changed, and moves the profile’s revision', async () => {
      const { gateway, pass, resourceId } = await readLink();
      const revision = await gateway.getProfileRevision(UID);
      gateway.controls.nextReread('changed');

      await gateway.readLinkAgain(resourceId);
      pass(PREVIEW_READ_MS);

      await expect(gateway.getResource(UID, resourceId)).resolves.toMatchObject(
        { refresh: { status: 'done', changed: true } },
      );
      expect((await gateway.getResourceText(UID, resourceId))?.text).toContain(
        'Read again: the page had changed.',
      );
      await expect(gateway.getProfileRevision(UID)).resolves.toBe(revision + 1);
    });

    it('keeps the copy of a page that cannot be read again, and says why', async () => {
      const { gateway, pass, resourceId } = await readLink();
      const before = await gateway.getResourceText(UID, resourceId);
      gateway.controls.nextReread('link-unreadable');

      await gateway.readLinkAgain(resourceId);
      pass(PREVIEW_READ_MS);

      await expect(gateway.getResource(UID, resourceId)).resolves.toMatchObject(
        {
          status: 'ready',
          refresh: { status: 'failed', failure: 'link-unreadable' },
        },
      );
      await expect(gateway.getResourceText(UID, resourceId)).resolves.toEqual(
        before,
      );
    });

    it('reads a link whose first reading failed from the start, without `refresh`', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.failNext('link-unreadable');
      const { resourceId } = await gateway.createResource(link);
      pass(PREVIEW_READ_MS);
      expect((await gateway.getResource(UID, resourceId))?.status).toBe(
        'failed',
      );

      await gateway.readLinkAgain(resourceId);
      const again = await gateway.getResource(UID, resourceId);
      expect(again).toMatchObject({ status: 'processing' });
      expect(again).not.toHaveProperty('failure');
      expect(again).not.toHaveProperty('refresh');
      pass(PREVIEW_READ_MS);

      await expect(gateway.getResource(UID, resourceId)).resolves.toMatchObject(
        { status: 'ready', textAt: expect.any(Number) },
      );
    });

    it('refuses what the backend refuses: a reading going on, today’s limit, no such resource', async () => {
      const { gateway, resourceId } = await readLink();

      await gateway.readLinkAgain(resourceId);
      expect(await codeOf(gateway.readLinkAgain(resourceId))).toBe(
        ProfileErrorCode.Reading,
      );
      expect(await codeOf(gateway.readLinkAgain('nope'))).toBe(
        ProfileErrorCode.NotFound,
      );

      const other = await readLink();
      other.gateway.controls.setExtractionsToday(PROFILE_DAILY_EXTRACTIONS);
      expect(await codeOf(other.gateway.readLinkAgain(other.resourceId))).toBe(
        ProfileErrorCode.DailyLimit,
      );
    });

    it('refuses to read a note again: it is not a link', async () => {
      const { gateway, pass } = await setUp();
      const { resourceId } = await gateway.createResource(note);
      pass(PREVIEW_READ_MS);

      expect(await codeOf(gateway.readLinkAgain(resourceId))).toBe(
        ProfileErrorCode.Invalid,
      );
    });

    it('reads a posting again: the same posting dates the copy, a changed one replaces the text and dates the brief', async () => {
      const { gateway, pass, clock, applicationId } = await readPosting();
      const read = await gateway.getApplication(UID, applicationId);

      await gateway.readPostingAgain(applicationId);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({
        job: { status: 'ready', refresh: { status: 'reading' } },
      });
      pass(PREVIEW_READ_MS);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({
        jobDescription: read?.jobDescription,
        revision: read?.revision,
        job: {
          takenAt: clock.time,
          refresh: { status: 'done', changed: false },
        },
      });

      gateway.controls.nextReread('changed');
      await gateway.readPostingAgain(applicationId);
      pass(PREVIEW_READ_MS);
      const changed = await gateway.getApplication(UID, applicationId);
      expect(changed).toMatchObject({
        revision: (read?.revision ?? 0) + 1,
        title: read?.title,
        job: { refresh: { status: 'done', changed: true } },
      });
      expect(changed?.jobDescription).toContain('read again');
    });

    it('asks before replacing a text the candidate edited, then replaces it', async () => {
      const { gateway, pass, applicationId } = await readPosting();
      await gateway.updateApplication({
        applicationId,
        jobDescription: 'My own notes on the job.',
      });

      expect(await codeOf(gateway.readPostingAgain(applicationId))).toBe(
        ProfileErrorCode.JobEdited,
      );
      await gateway.readPostingAgain(applicationId, { replaceEdited: true });
      expect(
        await codeOf(
          gateway.updateApplication({ applicationId, jobDescription: 'New' }),
        ),
      ).toBe(ProfileErrorCode.Reading);
      pass(PREVIEW_READ_MS);

      const replaced = await gateway.getApplication(UID, applicationId);
      expect(replaced?.job).toMatchObject({
        edited: false,
        refresh: { status: 'done', changed: true },
      });
      expect(replaced?.jobDescription).not.toBe('My own notes on the job.');
    });

    it('reads a posting whose first reading failed from the start', async () => {
      const { gateway, pass } = await setUp();
      gateway.controls.failNextJob('link-unreadable');
      const { applicationId } = await gateway.createApplication(posting);
      pass(PREVIEW_READ_MS);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'failed' } });

      await gateway.readPostingAgain(applicationId);
      await expect(
        gateway.getApplication(UID, applicationId),
      ).resolves.toMatchObject({ job: { status: 'reading' } });
      pass(PREVIEW_READ_MS);

      const ready = await gateway.getApplication(UID, applicationId);
      expect(ready?.job).toMatchObject({ status: 'ready' });
      expect(ready?.job).not.toHaveProperty('refresh');
      expect(ready?.jobDescription).toContain('Copy of the posting');
    });

    it('refuses to read again a job that is not from a link', async () => {
      const { gateway, pass } = await setUp();
      const { applicationId } = await gateway.createApplication({
        job: { source: 'text', text: 'Go services in production.' },
      });
      pass(PREVIEW_READ_MS);

      expect(await codeOf(gateway.readPostingAgain(applicationId))).toBe(
        ProfileErrorCode.Invalid,
      );
    });
  });
});

/** A version the spec made as an edit (doc 18): its review's fields. */
const editOf = (version: CvVersion | null): CvEditVersion => {
  if (!version || isWrittenVersion(version)) {
    throw new Error('Not an edit version');
  }
  return version;
};

describe('previewProfileGateway, CV versions (delivery 2b)', () => {
  /** A profile of the designs, its CV with its text, and an application with its job. */
  const seeded = async () => {
    const set = await setUp();
    set.gateway.controls.seed();
    const cv = (await set.gateway.getResources(UID)).find(
      ({ type, textAt }) => type === 'cv' && textAt,
    )!;
    const { applicationId } = await set.gateway.createApplication({
      job: {
        source: 'text',
        text: 'Senior Backend Engineer\nNorthwind Logistics\nGo services in production.',
      },
    });
    set.pass(PREVIEW_READ_MS);
    await set.gateway.getApplications(UID);
    return { ...set, cv, applicationId };
  };

  it('makes a version in the background: creating at once, then ready with an answer that quotes the CV', async () => {
    const { gateway, pass, cv, applicationId } = await seeded();

    const { versionId, status } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'job', applicationId },
    });
    expect(status).toBe('creating');
    await expect(gateway.getCvVersion(UID, versionId)).resolves.toMatchObject({
      status: 'creating',
      length: 'same',
      changes: [],
    });
    pass(PREVIEW_CV_MS);

    const version = editOf(await gateway.getCvVersion(UID, versionId));
    expect(version.status).toBe('ready');
    for (const passage of [
      ...version.findings.map(({ passage: quoted }) => quoted),
      ...version.changes.map(({ original, after }) => original || after),
      ...version.questions.map(({ passage: quoted }) => quoted),
    ]) {
      expect(version.cv).toContain(passage);
    }
    expect(version.changes.map(({ action }) => action)).toEqual([
      'rewrite',
      'add',
    ]);
    expect(version.changes[1]?.sources[0]).toMatchObject({ kind: 'item' });
    expect(version.unsupportedJobTerms).toEqual([
      'Senior',
      'Backend',
      'Engineer',
    ]);
    await expect(gateway.getCvVersionsToday(UID)).resolves.toBe(1);
  });

  it('makes a general version with its role, and lists the newest first', async () => {
    const { gateway, pass, cv } = await seeded();
    const { versionId: first } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'general' },
    });
    pass(1000);
    const { versionId: second } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'general', role: '  Data engineer  ' },
      length: 'one-page',
    });

    const versions = await gateway.getCvVersions(UID);
    expect(versions.map(({ id }) => id)).toEqual([second, first]);
    expect(versions[0]).toMatchObject({
      target: { kind: 'general', role: 'Data engineer' },
      length: 'one-page',
      unsupportedJobTerms: [],
    });
  });

  it('fails a version on request, and removes one', async () => {
    const { gateway, pass, cv } = await seeded();
    gateway.controls.failNextCv('model');
    const { versionId } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'general' },
    });
    pass(PREVIEW_CV_MS);

    await expect(gateway.getCvVersion(UID, versionId)).resolves.toMatchObject({
      status: 'failed',
      failure: 'model',
    });
    await expect(gateway.getCvVersionsToday(UID)).resolves.toBe(0);
    await gateway.removeCvVersion(versionId);
    await expect(gateway.getCvVersion(UID, versionId)).resolves.toBeNull();
    expect(await codeOf(gateway.removeCvVersion(versionId))).toBe(
      ProfileErrorCode.NotFound,
    );
  });

  it('refuses what the backend refuses: not a CV, a CV without its text, no such job, today’s limit', async () => {
    const { gateway, cv } = await seeded();
    const note = (await gateway.getResources(UID)).find(
      ({ type }) => type === 'note',
    )!;
    const general = { kind: 'general' } as const;

    expect(
      await codeOf(
        gateway.createCvVersion({ resourceId: note.id, target: general }),
      ),
    ).toBe(ProfileErrorCode.Invalid);
    expect(
      await codeOf(
        gateway.createCvVersion({
          resourceId: cv.id,
          target: { kind: 'job', applicationId: 'nope' },
        }),
      ),
    ).toBe(ProfileErrorCode.NotFound);
    gateway.controls.setCvVersionsToday(CV_DAILY_VERSIONS);
    expect(
      await codeOf(
        gateway.createCvVersion({ resourceId: cv.id, target: general }),
      ),
    ).toBe(ProfileErrorCode.DailyLimit);

    const fresh = await setUp();
    const { resourceId } = await fresh.gateway.createResource(cvFile);
    expect(
      await codeOf(
        fresh.gateway.createCvVersion({ resourceId, target: general }),
      ),
    ).toBe(ProfileErrorCode.NoCvText);
  });

  it('keeps the candidate’s decisions, answers and the version sent, one per job', async () => {
    const { gateway, pass, cv, applicationId } = await seeded();
    const made = async () => {
      const { versionId } = await gateway.createCvVersion({
        resourceId: cv.id,
        target: { kind: 'job', applicationId },
      });
      pass(PREVIEW_CV_MS);
      return editOf(await gateway.getCvVersion(UID, versionId));
    };
    const first = await made();
    const [rewrite, add] = first.changes;

    expect(
      await codeOf(gateway.decideCvChange(first.id, rewrite!.id, 'edit')),
    ).toBe(ProfileErrorCode.Invalid);
    await gateway.decideCvChange(first.id, rewrite!.id, 'edit', ' Wrote it ');
    await expect(
      gateway.decideCvChange(first.id, add!.id, 'accept'),
    ).resolves.toEqual({ open: 1 });
    await expect(
      gateway.answerCvQuestion(first.id, first.questions[0]!.id, '12 people'),
    ).resolves.toEqual({ open: 0 });
    const reviewed = editOf(await gateway.getCvVersion(UID, first.id));
    expect(reviewed.changes[0]).toMatchObject({
      decision: 'edited',
      text: 'Wrote it',
    });
    expect(reviewed.questions[0]).toMatchObject({
      status: 'answered',
      answer: '12 people',
    });

    await gateway.decideCvChange(first.id, rewrite!.id, 'reopen');
    expect(
      editOf(await gateway.getCvVersion(UID, first.id)).changes[0],
    ).not.toHaveProperty('text');

    const second = await made();
    await gateway.markCvVersionSent(first.id, true);
    await gateway.markCvVersionSent(second.id, true);
    expect((await gateway.getCvVersion(UID, first.id))!.sentAt).toBeUndefined();
    expect((await gateway.getCvVersion(UID, second.id))!.sentAt).toEqual(
      expect.any(Number),
    );
  });

  it('refuses a review of a version that is not made, and "sent" for a general one', async () => {
    const { gateway, pass, cv } = await seeded();
    const { versionId } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'general' },
    });
    expect(
      await codeOf(gateway.decideCvChange(versionId, 'c1', 'accept')),
    ).toBe(ProfileErrorCode.Invalid);
    pass(PREVIEW_CV_MS);

    expect(await codeOf(gateway.markCvVersionSent(versionId, true))).toBe(
      ProfileErrorCode.Invalid,
    );
    expect(
      await codeOf(gateway.decideCvChange(versionId, 'nope', 'accept')),
    ).toBe(ProfileErrorCode.NotFound);
  });

  it('restores a version as a copy with its decisions, not sent, the newest', async () => {
    const { gateway, pass, cv, applicationId } = await seeded();
    const { versionId } = await gateway.createCvVersion({
      resourceId: cv.id,
      target: { kind: 'job', applicationId },
    });
    pass(PREVIEW_CV_MS);
    const made = editOf(await gateway.getCvVersion(UID, versionId));
    await gateway.decideCvChange(versionId, made.changes[0]!.id, 'accept');
    await gateway.markCvVersionSent(versionId, true);
    pass(1000);

    const { versionId: copyId } = await gateway.copyCvVersion(versionId);

    const [newest] = await gateway.getCvVersions(UID);
    expect(newest).toMatchObject({ id: copyId, copiedFrom: versionId });
    expect(editOf(newest ?? null).changes[0]!.decision).toBe('accepted');
    expect(newest!.sentAt).toBeUndefined();
    expect((await gateway.getCvVersion(UID, versionId))!.sentAt).toEqual(
      expect.any(Number),
    );
  });
});

describe('previewProfileGateway, the CV details (doc 19 §3.1)', () => {
  /** Adds the CV as a file and lets it be read. */
  const addCv = async (set: Awaited<ReturnType<typeof setUp>>) => {
    const { resourceId, upload } = await set.gateway.createResource(cvFile);
    await set.gateway.uploadFile(upload!, pdf, { onProgress: () => {} });
    set.pass(PREVIEW_READ_MS);
    await set.gateway.getResources(UID);
    return resourceId;
  };

  it('has none until a CV is read, which fills every field from it', async () => {
    const set = await setUp();
    await expect(set.gateway.getCvDetails(UID)).resolves.toBeNull();

    const resourceId = await addCv(set);

    await expect(set.gateway.getCvDetails(UID)).resolves.toMatchObject({
      name: PREVIEW_CV_DETAILS.name,
      links: PREVIEW_CV_DETAILS.links,
      edited: [],
      sources: { name: resourceId, links: resourceId },
    });
  });

  it('keeps what the candidate set or cleared from a CV read later, and says what changed', async () => {
    const set = await setUp();

    await expect(
      set.gateway.updateCvDetails({ phone: ' 07700 900999 ', headline: '' }),
    ).resolves.toEqual({ changed: ['phone'] });
    await addCv(set);

    const details = (await set.gateway.getCvDetails(UID))!;
    expect(details.phone).toBe('07700 900999');
    expect(details.headline).toBeUndefined();
    expect(details.name).toBe(PREVIEW_CV_DETAILS.name);
    expect(details.edited).toEqual(['phone', 'headline']);
  });

  it('clears what a removed CV filled, but not what the candidate set since', async () => {
    const set = await setUp();
    const resourceId = await addCv(set);
    await set.gateway.updateCvDetails({ email: 'maya@example.com' });

    await set.gateway.removeResource(resourceId);

    const details = (await set.gateway.getCvDetails(UID))!;
    expect(details.email).toBe('maya@example.com');
    expect(details.name).toBeUndefined();
    expect(details.links).toBeUndefined();
    expect(details.sources).toEqual({});
  });

  it('refuses what the backend refuses: no field, a field too long, a fifth link', async () => {
    const { gateway } = await setUp();

    for (const request of [
      {},
      { name: 'x'.repeat(201) },
      { links: ['a', 'b', 'c', 'd', 'e'] },
      { links: ['  '] },
    ]) {
      expect(await codeOf(gateway.updateCvDetails(request))).toBe(
        ProfileErrorCode.Invalid,
      );
    }
  });
});

describe('previewProfileGateway, written CVs (D83)', () => {
  const writtenOf = (version: CvVersion | null) => {
    if (!version || !isWrittenVersion(version)) {
      throw new Error('Not a written version');
    }
    return version;
  };

  it('writes one in the background from the visible items, each line citing the item it comes from', async () => {
    const { gateway, pass } = await setUp();
    gateway.controls.seed();

    const { versionId, status } = await gateway.createCvVersion({
      mode: 'write',
      target: { kind: 'general' },
    });
    expect(status).toBe('creating');
    expect(writtenOf(await gateway.getCvVersion(UID, versionId))).toMatchObject(
      { status: 'creating', pages: 2 },
    );
    pass(PREVIEW_CV_MS);

    const version = writtenOf(await gateway.getCvVersion(UID, versionId));
    const items = new Set((await gateway.getItems(UID)).map(({ id }) => id));
    const document = version.document!;
    expect(version.status).toBe('ready');
    expect(document.experience[0]).toMatchObject({
      title: 'Senior Backend Engineer',
      organisation: 'Fenwick Pay',
      start: '2021',
      end: '2026',
    });
    expect(document.experience[0]!.bullets.length).toBeGreaterThan(0);
    for (const line of [
      ...document.summary,
      ...document.experience.flatMap(({ bullets }) => bullets),
      ...document.skills,
    ]) {
      expect(line.sources).toHaveLength(1);
      expect(
        line.sources[0]!.kind === 'item' && items.has(line.sources[0]!.itemId),
      ).toBe(true);
    }
    expect(version.notes.length).toBeGreaterThan(0);
    expect(version.questions[0]?.lineId).toBeDefined();
    await expect(gateway.getCvVersionsToday(UID)).resolves.toBe(1);
  });

  it('refuses a written CV with nothing in the profile, and a change decided on one', async () => {
    const { gateway, pass } = await setUp();
    expect(
      await codeOf(
        gateway.createCvVersion({ mode: 'write', target: { kind: 'general' } }),
      ),
    ).toBe(ProfileErrorCode.NoItems);

    gateway.controls.seed();
    const { versionId } = await gateway.createCvVersion({
      mode: 'write',
      target: { kind: 'general' },
      pages: 1,
    });
    pass(PREVIEW_CV_MS);
    expect(
      await codeOf(gateway.decideCvChange(versionId, 'c1', 'accept')),
    ).toBe(ProfileErrorCode.Invalid);
    await expect(
      gateway.answerCvQuestion(versionId, 'q1', 'Nine engineers.'),
    ).resolves.toEqual({ open: 0 });
  });
});
