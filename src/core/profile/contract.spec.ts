import {
  CreateProfileResourceResponseSchema,
  interviewProfilePath,
  isRereading,
  PAGE_READING_STALE_MS,
  type PageRefresh,
  parseProfileLink,
  PROFILE_LINK_MAX_CHARS,
  PROFILE_UPLOAD_MAX_BYTES,
  ProfileResourceSchema,
  profileResourcesPath,
  REREAD_OUTCOME_SHOWN_MS,
  rereadOutcomeOf,
  RESOURCE_TYPES_BY_SOURCE,
  SkillMapItemSchema,
  skillMapItemsPath,
  usageDayPath,
} from './contract';

describe('the profile contract', () => {
  it('names the documents the backend writes', () => {
    expect(interviewProfilePath('uid-1')).toBe(
      'users/uid-1/interviewProfile/main',
    );
    expect(profileResourcesPath('uid-1')).toBe(
      'users/uid-1/interviewProfile/main/resources',
    );
    expect(profileResourcesPath('uid-1', 'r1')).toBe(
      'users/uid-1/interviewProfile/main/resources/r1',
    );
    expect(skillMapItemsPath('uid-1')).toBe(
      'users/uid-1/interviewProfile/main/items',
    );
    expect(skillMapItemsPath('uid-1', 'i1')).toBe(
      'users/uid-1/interviewProfile/main/items/i1',
    );
  });

  it('names the usage document by its UTC day', () => {
    expect(usageDayPath('uid-1', new Date('2026-10-13T23:59:59Z'))).toBe(
      'usage/uid-1/days/2026-10-13',
    );
    // One second later it is the next day in UTC, whatever the visitor's clock says.
    expect(usageDayPath('uid-1', new Date('2026-10-14T00:00:00Z'))).toBe(
      'usage/uid-1/days/2026-10-14',
    );
  });

  it('ties the type of a resource to its source, as the backend does', () => {
    expect(RESOURCE_TYPES_BY_SOURCE).toEqual({
      file: ['cv', 'document'],
      text: ['cv', 'document', 'note'],
      link: ['link'],
    });
  });

  it('allows files up to 10 MB', () => {
    expect(PROFILE_UPLOAD_MAX_BYTES).toBe(10 * 1024 * 1024);
  });
});

describe('parseProfileLink', () => {
  it.each([
    ['https://example.com', 'https://example.com/'],
    ['  https://example.com/cv  ', 'https://example.com/cv'],
    ['https://Example.COM/Path?q=1', 'https://example.com/Path?q=1'],
    ['https://example.com/talk#slides', 'https://example.com/talk'],
    [
      'https://sub.domain.example.co.uk/a/b',
      'https://sub.domain.example.co.uk/a/b',
    ],
    ['https://example.com:443/', 'https://example.com/'],
  ])('accepts %s', (value, normal) => {
    expect(parseProfileLink(value)).toBe(normal);
  });

  it.each([
    ['nothing', ''],
    ['spaces only', '   '],
    ['no scheme', 'example.com/cv'],
    ['http', 'http://example.com/'],
    ['another scheme', 'ftp://example.com/'],
    ['another port', 'https://example.com:8443/'],
    ['a user name', 'https://maya@example.com/'],
    ['a password', 'https://maya:secret@example.com/'],
    ['an IP address', 'https://169.254.169.254/computeMetadata/v1/'],
    ['an IPv6 address', 'https://[::1]/'],
    ['a single-word host', 'https://localhost/'],
    ['a private ending', 'https://printer.local/'],
    ['an internal ending', 'https://wiki.internal/'],
    ['a space inside', 'https://example.com/my cv'],
    ['a character that is never in an address', 'https://example.com/<cv>'],
    ['something that is not an address', 'https://'],
  ])('refuses %s', (_name, value) => {
    expect(parseProfileLink(value)).toBeUndefined();
  });

  it('refuses an address longer than the limit', () => {
    const long = `https://example.com/${'a'.repeat(PROFILE_LINK_MAX_CHARS)}`;

    expect(parseProfileLink(long)).toBeUndefined();
    expect(
      parseProfileLink(
        `https://example.com/${'a'.repeat(PROFILE_LINK_MAX_CHARS - 20)}`,
      ),
    ).toHaveLength(PROFILE_LINK_MAX_CHARS);
  });
});

describe('the documents the owner reads', () => {
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

  it('reads a resource and drops what the pages do not use', () => {
    expect(
      ProfileResourceSchema.parse({
        ...resource,
        skill: { id: 'profile-extract', version: '1.1.0' },
        extractedAt: 2_000,
      }),
    ).toEqual(resource);
  });

  it('keeps the address of a link and the reason of a failure', () => {
    expect(
      ProfileResourceSchema.parse({
        ...resource,
        type: 'link',
        source: 'link',
        url: 'https://example.com/talk',
        status: 'failed',
        failure: 'link-unreadable',
      }),
    ).toMatchObject({
      url: 'https://example.com/talk',
      status: 'failed',
      failure: 'link-unreadable',
    });
  });

  it('shows a reason it does not know as a fault on our side', () => {
    expect(
      ProfileResourceSchema.parse({
        ...resource,
        status: 'failed',
        failure: 'a-reason-added-later',
      }).failure,
    ).toBe('internal');
  });

  it('fills what is missing from a resource that is still new', () => {
    expect(
      ProfileResourceSchema.parse({
        id: 'r2',
        type: 'note',
        title: 'Notes',
        source: 'text',
        status: 'awaitingUpload',
      }),
    ).toEqual({
      id: 'r2',
      type: 'note',
      title: 'Notes',
      source: 'text',
      contentType: '',
      storagePath: '',
      status: 'awaitingUpload',
      itemCount: 0,
      createdAt: null,
      updatedAt: null,
    });
  });

  it.each([
    ['no status', { ...resource, status: undefined }],
    ['a status it does not know', { ...resource, status: 'archived' }],
    ['a type it does not know', { ...resource, type: 'video' }],
    ['no title', { ...resource, title: undefined }],
    ['no id', { ...resource, id: '' }],
  ])('does not accept a resource with %s', (_name, value) => {
    expect(ProfileResourceSchema.safeParse(value).success).toBe(false);
  });

  const item = {
    id: 'i1',
    kind: 'achievement',
    text: 'Cut payment incidents by 40% in two quarters.',
    evidence: 'Reduced Sev-1 and Sev-2 payment incidents 40%.',
    resourceId: 'r1',
    starred: true,
    hidden: false,
    edited: true,
    createdAt: 1_000,
    updatedAt: 2_000,
  };

  it('reads an item of the skill map', () => {
    expect(
      SkillMapItemSchema.parse({
        ...item,
        skill: { id: 'profile-extract', version: '1.1.0' },
      }),
    ).toEqual(item);
  });

  it('takes a missing mark as "no"', () => {
    expect(
      SkillMapItemSchema.parse({ id: 'i2', kind: 'skill', text: 'Go' }),
    ).toEqual({
      id: 'i2',
      kind: 'skill',
      text: 'Go',
      evidence: '',
      resourceId: '',
      starred: false,
      hidden: false,
      edited: false,
      createdAt: null,
      updatedAt: null,
    });
  });

  it.each([
    ['a kind it does not know', { ...item, kind: 'hobby' }],
    ['no text', { ...item, text: undefined }],
  ])('does not accept an item with %s', (_name, value) => {
    expect(SkillMapItemSchema.safeParse(value).success).toBe(false);
  });
});

describe('the answer of createProfileResource', () => {
  it('has the place to upload a file', () => {
    const answer = {
      resourceId: 'TuZHzAder2S8Lq3FT4Oy',
      upload: {
        path: 'users/uid-1/interview-docs/TuZHzAder2S8Lq3FT4Oy/document.pdf',
        contentType: 'application/pdf',
        maxBytes: 10_485_760,
      },
    };

    expect(CreateProfileResourceResponseSchema.parse(answer)).toEqual(answer);
  });

  it('has no upload for text and links', () => {
    expect(
      CreateProfileResourceResponseSchema.parse({ resourceId: 'r1' }),
    ).toEqual({ resourceId: 'r1' });
  });

  it.each([
    ['no id', {}],
    ['an id that is not one', { resourceId: 'a/b' }],
    [
      'a type nobody can upload',
      {
        resourceId: 'r1',
        upload: { path: 'p', contentType: 'image/png', maxBytes: 1 },
      },
    ],
  ])('is refused with %s', (_name, value) => {
    expect(CreateProfileResourceResponseSchema.safeParse(value).success).toBe(
      false,
    );
  });
});

describe('a page read again', () => {
  const NOW = 10_000_000;
  const ended = (refresh: Partial<PageRefresh>): PageRefresh => ({
    status: 'done',
    startedAt: NOW - 60_000,
    finishedAt: NOW - 30_000,
    ...refresh,
  });

  it('is being read until the backend says how it went, or the reading is lost', () => {
    expect(isRereading(undefined, NOW)).toBe(false);
    expect(isRereading({ status: 'reading', startedAt: NOW - 1000 }, NOW)).toBe(
      true,
    );
    expect(
      isRereading(
        { status: 'reading', startedAt: NOW - PAGE_READING_STALE_MS },
        NOW,
      ),
    ).toBe(false);
    expect(isRereading(ended({}), NOW)).toBe(false);
  });

  it.each([
    [{ changed: true }, 'changed'],
    [{ changed: false }, 'unchanged'],
    [{ status: 'failed', failure: 'link-unreadable' }, 'gone'],
    [{ status: 'failed', failure: 'empty' }, 'gone'],
    [{ status: 'failed', failure: 'quota' }, 'quota'],
    [{ status: 'failed', failure: 'model' }, 'error'],
    [{ status: 'failed' }, 'error'],
  ] as const)('says %j as "%s"', (refresh, kind) => {
    expect(rereadOutcomeOf(ended(refresh), NOW)).toEqual({ kind });
  });

  it('says nothing while it is read, once it is old news, or without an end', () => {
    expect(rereadOutcomeOf(undefined, NOW)).toBeNull();
    expect(
      rereadOutcomeOf({ status: 'reading', startedAt: NOW }, NOW),
    ).toBeNull();
    expect(
      rereadOutcomeOf(
        ended({ finishedAt: NOW - REREAD_OUTCOME_SHOWN_MS - 1 }),
        NOW,
      ),
    ).toBeNull();
    expect(rereadOutcomeOf(ended({ finishedAt: null }), NOW)).toBeNull();
  });

  it('keeps a resource whose reading again it does not understand, without it', () => {
    const parsed = ProfileResourceSchema.parse({
      id: 'r1',
      type: 'link',
      title: 'Talk',
      source: 'link',
      status: 'ready',
      createdAt: 1,
      updatedAt: 2,
      refresh: { status: 'queued' },
    });
    expect(parsed.refresh).toBeUndefined();
  });
});
