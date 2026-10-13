import {
  type CreateProfileResourceRequest,
  parseProfileLink,
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
  PROFILE_TEXT_MAX_CHARS,
  PROFILE_TITLE_MAX_CHARS,
  PROFILE_UPLOAD_CONTENT_TYPES,
  PROFILE_UPLOAD_MAX_BYTES,
  type ProfileResource,
  type ProfileResourceFailure,
  RESOURCE_TYPES_BY_SOURCE,
  SKILL_MAP_ITEM_MAX_CHARS,
  type SkillMapItem,
} from './contract';
import { ProfileError, ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';
import {
  PREVIEW_FACTS,
  PREVIEW_SEED,
  type PreviewFact,
} from './previewProfileData';

import { PREVIEW_GATEWAY_MARKER } from '@/core/auth/previewGateway';

/**
 * An in-memory fake of the interview profile's backend, for local preview and tests ONLY,
 * the companion of src/core/auth/previewGateway.ts. It is never part of a production
 * build: it is loaded with a dynamic import that the bundler removes unless
 * VITE_AUTH_GATEWAY=preview (./selectProfileGateway.ts), and `yarn check:bundle` looks for
 * PREVIEW_GATEWAY_MARKER, which this file carries too.
 *
 * It behaves like the backend with its fake model: a resource is "read" a moment after
 * its content arrives and gives a few fictional items (./previewProfileData.ts); a link to
 * a host ending in `.invalid` cannot be read; what the profile already has is not added
 * twice; the limits are the backend's. Profiles live in memory and in sessionStorage, per
 * account, and nothing is sent anywhere.
 *
 * `window.qdPreviewProfile` (PreviewProfileControls) stands for what a test cannot wait
 * for or cause: a reading that fails, one that never ends, a day's limit already used.
 */
const STORAGE_KEY = `${PREVIEW_GATEWAY_MARKER}-profile`;

/** How long the fake takes to "read" a resource. */
export const PREVIEW_READ_MS = 1500;
/** The fake upload: this many steps, this long each. */
const UPLOAD_STEPS = 4;
const UPLOAD_STEP_MS = 120;

interface StoredResource extends ProfileResource {
  /** When the reading ends; `null` while the content has not arrived, or never ends. */
  settlesAt: number | null;
  /** How the reading will end, decided when the resource is created. */
  outcome: ProfileResourceFailure | 'ready';
}

interface PreviewProfile {
  resources: StoredResource[];
  items: SkillMapItem[];
  extractionsToday: number;
}

interface PreviewProfileState {
  profiles: Record<string, PreviewProfile>;
  nextId: number;
}

/** What happens outside the page, for the signed-in preview account. Test and preview only. */
export interface PreviewProfileControls {
  /** Replaces the profile with the one of the designs: six resources, one in each state. */
  seed(): void;
  /** The next resource that is added cannot be read, for this reason. */
  failNext(reason: ProfileResourceFailure): void;
  /** The next resource that is added is never read (it stays "being read"). */
  stallNext(): void;
  /** How many resources were already read today. */
  setExtractionsToday(count: number): void;
}

export type PreviewProfileGateway = ProfileGateway & {
  controls: PreviewProfileControls;
};

declare global {
  interface Window {
    qdPreviewProfile?: PreviewProfileControls;
  }
}

export type PreviewProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface PreviewProfileOptions {
  /** `null` keeps everything in memory only. */
  storage?: PreviewProfileStorage | null;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}

const browserStorage = (): PreviewProfileStorage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readState = (
  storage: PreviewProfileStorage | null,
): PreviewProfileState => {
  const empty: PreviewProfileState = { profiles: {}, nextId: 1 };
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (!stored) {
      return empty;
    }
    const parsed = JSON.parse(stored) as Partial<PreviewProfileState>;
    return {
      profiles:
        parsed.profiles && typeof parsed.profiles === 'object'
          ? parsed.profiles
          : {},
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return empty;
  }
};

const defaultWait = (milliseconds: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds);
  });

const toResource = ({
  settlesAt: _settlesAt,
  outcome: _outcome,
  ...resource
}: StoredResource): ProfileResource => resource;

const isHttpsInvalidHost = (url: string) => {
  try {
    return new URL(url).hostname.endsWith('.invalid');
  } catch {
    return false;
  }
};

export const createPreviewProfileGateway = ({
  storage = browserStorage(),
  now = Date.now,
  wait = defaultWait,
}: PreviewProfileOptions = {}): PreviewProfileGateway => {
  const state = readState(storage);
  // The callables of the backend act on whoever is signed in. The fake has no session of
  // its own: it acts on the account whose profile was read last, which a page always does
  // before it changes anything.
  let currentUid: string | null = null;
  let nextFailure: ProfileResourceFailure | null = null;
  let nextStalls = false;
  const uploaded = new Set<string>();

  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Memory only.
    }
  };

  const newId = (prefix: string) => {
    const id = `${prefix}-${state.nextId}`;
    state.nextId += 1;
    return id;
  };

  const profileOf = (uid: string): PreviewProfile => {
    state.profiles[uid] ??= { resources: [], items: [], extractionsToday: 0 };
    return state.profiles[uid];
  };

  const addItems = (
    profile: PreviewProfile,
    resourceId: string,
    facts: PreviewFact[],
    at: number,
  ) => {
    const known = new Set(profile.items.map(item => item.text));
    const fresh = facts.filter(({ text }) => !known.has(text));
    fresh.forEach((entry, index) => {
      profile.items.push({
        id: newId('item'),
        kind: entry.kind,
        text: entry.text,
        evidence: entry.evidence,
        resourceId,
        starred: false,
        hidden: false,
        edited: false,
        // One millisecond apart, so "newest first" has an answer.
        createdAt: at + index,
        updatedAt: at + index,
      });
    });
    return fresh.length;
  };

  /** Ends the readings whose time has come. */
  const settle = (profile: PreviewProfile) => {
    const time = now();
    let changed = false;
    for (const resource of profile.resources) {
      if (
        resource.status !== 'processing' ||
        resource.settlesAt === null ||
        resource.settlesAt > time
      ) {
        continue;
      }
      changed = true;
      resource.updatedAt = resource.settlesAt;
      if (resource.outcome === 'ready') {
        resource.status = 'ready';
        resource.itemCount = addItems(
          profile,
          resource.id,
          PREVIEW_FACTS[resource.type],
          resource.settlesAt,
        );
      } else {
        resource.status = 'failed';
        resource.failure = resource.outcome;
      }
    }
    if (changed) {
      save();
    }
  };

  const read = (uid: string): PreviewProfile => {
    currentUid = uid;
    const profile = profileOf(uid);
    settle(profile);
    return profile;
  };

  const currentProfile = (): PreviewProfile => {
    if (!currentUid) {
      throw new ProfileError(ProfileErrorCode.SignedOut);
    }
    return read(currentUid);
  };

  const startReading = (resource: StoredResource) => {
    resource.status = 'processing';
    resource.settlesAt = nextStalls ? null : now() + PREVIEW_READ_MS;
    nextStalls = false;
  };

  const assertValid = (request: CreateProfileResourceRequest) => {
    const title = request.title.trim();
    const types: readonly string[] = RESOURCE_TYPES_BY_SOURCE[request.source];
    const valid =
      title.length > 0 &&
      title.length <= PROFILE_TITLE_MAX_CHARS &&
      types.includes(request.type) &&
      (request.source !== 'text' ||
        (request.text.trim().length > 0 &&
          request.text.trim().length <= PROFILE_TEXT_MAX_CHARS)) &&
      (request.source !== 'link' ||
        parseProfileLink(request.url) !== undefined) &&
      (request.source !== 'file' ||
        PROFILE_UPLOAD_CONTENT_TYPES.includes(request.contentType));
    if (!valid) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
  };

  const controls: PreviewProfileControls = {
    seed: () => {
      const profile = currentProfile();
      profile.resources = [];
      profile.items = [];
      // Oldest first, so the first of the list is the newest: a day apart, ending today.
      const day = 24 * 60 * 60 * 1000;
      [...PREVIEW_SEED].reverse().forEach((entry, index, all) => {
        const at = now() - (all.length - index) * day;
        const resource: StoredResource = {
          id: newId('resource'),
          type: entry.type,
          title: entry.title,
          source:
            entry.type === 'link'
              ? 'link'
              : entry.type === 'note'
                ? 'text'
                : 'file',
          contentType:
            entry.type === 'link'
              ? 'text/uri-list'
              : entry.type === 'note'
                ? 'text/plain'
                : 'application/pdf',
          ...(entry.type === 'link'
            ? { url: 'https://talks.example/ledgers-without-tears' }
            : {}),
          storagePath: '',
          status: entry.status,
          ...(entry.failure ? { failure: entry.failure } : {}),
          itemCount: 0,
          createdAt: at,
          updatedAt: at,
          // The two unfinished ones stay as they are: nothing is waiting to end.
          settlesAt: null,
          outcome: entry.failure ?? 'ready',
        };
        resource.storagePath = `users/${currentUid}/interview-docs/${resource.id}/document`;
        resource.itemCount = addItems(profile, resource.id, entry.facts, at);
        profile.resources.push(resource);
      });
      save();
    },
    failNext: reason => {
      nextFailure = reason;
    },
    stallNext: () => {
      nextStalls = true;
    },
    setExtractionsToday: count => {
      currentProfile().extractionsToday = count;
      save();
    },
  };

  return {
    controls,

    getResources: async uid =>
      [...read(uid).resources]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map(toResource),
    getResource: async (uid, resourceId) => {
      const resource = read(uid).resources.find(({ id }) => id === resourceId);
      return resource ? toResource(resource) : null;
    },
    getItems: async uid => read(uid).items.map(item => ({ ...item })),
    getExtractionsToday: async uid => read(uid).extractionsToday,

    createResource: async request => {
      const profile = currentProfile();
      assertValid(request);
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      if (profile.resources.length >= PROFILE_MAX_RESOURCES) {
        throw new ProfileError(ProfileErrorCode.MaxResources);
      }
      const at = now();
      const id = newId('resource');
      const link =
        request.source === 'link' ? parseProfileLink(request.url) : undefined;
      const resource: StoredResource = {
        id,
        type: request.type,
        title: request.title.trim(),
        source: request.source,
        contentType:
          request.source === 'file'
            ? request.contentType
            : request.source === 'link'
              ? 'text/uri-list'
              : 'text/plain',
        ...(link ? { url: link } : {}),
        storagePath: `users/${currentUid}/interview-docs/${id}/document`,
        status: 'awaitingUpload',
        itemCount: 0,
        createdAt: at,
        updatedAt: at,
        settlesAt: null,
        outcome:
          nextFailure ??
          (link && isHttpsInvalidHost(link) ? 'link-unreadable' : 'ready'),
      };
      nextFailure = null;
      profile.resources.push(resource);
      profile.extractionsToday += 1;
      if (request.source === 'file') {
        save();
        return {
          resourceId: id,
          upload: {
            path: resource.storagePath,
            contentType: request.contentType,
            maxBytes: PROFILE_UPLOAD_MAX_BYTES,
          },
        };
      }
      // Text and links are stored by the backend itself: the reading starts at once.
      startReading(resource);
      save();
      return { resourceId: id };
    },

    uploadFile: async (target, file, { onProgress, signal } = {}) => {
      const profile = currentProfile();
      const resource = profile.resources.find(
        ({ storagePath }) => storagePath === target.path,
      );
      // Like the rules of the file store: the owner's path, once, within the limits.
      if (
        !resource ||
        uploaded.has(target.path) ||
        resource.status !== 'awaitingUpload' ||
        file.size === 0 ||
        file.size > target.maxBytes
      ) {
        throw new ProfileError(ProfileErrorCode.UploadRefused);
      }
      for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
        if (signal?.aborted) {
          throw new ProfileError(ProfileErrorCode.UploadCancelled);
        }
        await wait(UPLOAD_STEP_MS);
        onProgress?.(step / UPLOAD_STEPS);
      }
      if (signal?.aborted) {
        throw new ProfileError(ProfileErrorCode.UploadCancelled);
      }
      uploaded.add(target.path);
      startReading(resource);
      resource.updatedAt = now();
      save();
    },

    updateItem: async (itemId, change) => {
      const profile = currentProfile();
      const item = profile.items.find(({ id }) => id === itemId);
      if (!item) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const text = change.text?.trim();
      const nothing =
        text === undefined &&
        change.starred === undefined &&
        change.hidden === undefined;
      if (
        nothing ||
        (text !== undefined &&
          (text.length === 0 || text.length > SKILL_MAP_ITEM_MAX_CHARS))
      ) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      if (text !== undefined && text !== item.text) {
        item.text = text;
        item.edited = true;
      }
      item.starred = change.starred ?? item.starred;
      item.hidden = change.hidden ?? item.hidden;
      item.updatedAt = now();
      save();
    },
    removeItem: async itemId => {
      const profile = currentProfile();
      const item = profile.items.find(({ id }) => id === itemId);
      if (!item) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      profile.items = profile.items.filter(({ id }) => id !== itemId);
      const resource = profile.resources.find(
        ({ id }) => id === item.resourceId,
      );
      if (resource) {
        resource.itemCount = Math.max(0, resource.itemCount - 1);
      }
      save();
    },
    removeResource: async resourceId => {
      const profile = currentProfile();
      if (!profile.resources.some(({ id }) => id === resourceId)) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const before = profile.items.length;
      profile.resources = profile.resources.filter(
        ({ id }) => id !== resourceId,
      );
      profile.items = profile.items.filter(
        item => item.resourceId !== resourceId,
      );
      save();
      return { itemsRemoved: before - profile.items.length };
    },

    // No file exists here: the address leads nowhere on purpose.
    getFileUrl: async () => '#',
  };
};

/**
 * Puts the controls on `window.qdPreviewProfile`, for the browser console and the
 * end-to-end tests. Only the preview gateway has them, so they are never in a production build.
 */
export const exposePreviewProfileControls = (
  gateway: PreviewProfileGateway,
): ProfileGateway => {
  window.qdPreviewProfile = gateway.controls;
  return gateway;
};
