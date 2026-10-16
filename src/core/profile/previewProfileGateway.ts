import {
  APPLICATION_NAME_MAX_CHARS,
  APPLICATION_NOTES_MAX_CHARS,
  APPLICATIONS_MAX,
  type ApplicationBrief,
  BRIEF_DAILY_LIMIT,
  type BriefQuestion,
  type BriefRequirement,
  APPLICATION_FILE_NAME_MAX_CHARS,
  type CreateJobApplicationRequest,
  isJobPending,
  JOB_DESCRIPTION_MAX_CHARS,
  type JobApplication,
  type NewJob,
} from './applications';
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
  type ProfileResourceText,
  RESOURCE_TYPES_BY_SOURCE,
  SKILL_MAP_ITEM_MAX_CHARS,
  type SkillMapItem,
} from './contract';
import { ProfileError, ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';
import {
  PREVIEW_FACTS,
  PREVIEW_SEED,
  PREVIEW_SEED_APPLICATIONS,
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
  /** For a note: what was pasted, kept as its text once it is read. */
  pasted?: string;
}

/** What the fake keeps of a file: no file is read here, so a text that says what it stands for. */
const fileTextOf = (title: string) =>
  `${title}\n\nThe text of the file, without its layout. In the real backend this is what was read from the PDF, the Word document or the text file.`;

interface PreviewProfile {
  resources: StoredResource[];
  items: SkillMapItem[];
  extractionsToday: number;
  /** Absent in what an older version stored. */
  applications?: JobApplication[];
  /** Goes up with every change to the resources or the items, as the backend's does. */
  revision?: number;
  /** How many briefs were prepared today. */
  briefsToday?: number;
  /** The readings of applications' jobs, by application. */
  jobReadings?: Record<string, JobReading>;
  /** The texts kept of the resources (D78), by resource. */
  texts?: Record<string, ProfileResourceText>;
}

/** How the fake reads the job of an application (research doc 17). */
interface JobReading {
  /** When the reading ends; `null` while the file has not arrived. */
  settlesAt: number | null;
  outcome: ProfileResourceFailure | 'ready';
  source: NewJob['source'];
  /** The pasted text, the address, or the file's name: what the names are read from. */
  from: string;
  /** For a file: where it is uploaded. */
  path?: string;
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
  /**
   * Replaces the applications with the three of the designs: a brief with two gaps, a brief
   * the job has changed since, and no brief yet.
   */
  seedApplications(): void;
  /** The next brief cannot be prepared: the model failed, or today's limit was reached. */
  failNextBrief(reason: 'model' | 'quota'): void;
  /** The job of the next application cannot be read, for this reason. */
  failNextJob(reason: ProfileResourceFailure): void;
  /** How many briefs were already prepared today. */
  setBriefsToday(count: number): void;
}

/** How long the fake takes to prepare a brief; the real one takes 10 to 20 seconds. */
export const PREVIEW_BRIEF_MS = 1200;

/** Questions the fake asks for any job, with what kind each is. */
const PREVIEW_QUESTIONS: [string, BriefQuestion['kind']][] = [
  ['Tell me about an incident you led from alert to fix.', 'behavioural'],
  ['How would you design the main service of this team?', 'technical'],
  ['How would you approach your first 90 days in this role?', 'role'],
  ['Why this company, and why now?', 'motivation'],
];

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
  pasted: _pasted,
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
  // its own: it asks the preview auth gateway's record of who is signed in (the same
  // storage), and without one it acts on the account whose profile was read last.
  let lastReadUid: string | null = null;
  const signedInUid = (): string | null => {
    try {
      const session = JSON.parse(
        storage?.getItem(PREVIEW_GATEWAY_MARKER) ?? 'null',
      ) as { currentUid?: unknown } | null;
      return typeof session?.currentUid === 'string'
        ? session.currentUid
        : null;
    } catch {
      return null;
    }
  };
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

  let nextBriefFailure: 'model' | 'quota' | null = null;
  let nextJobFailure: ProfileResourceFailure | null = null;

  /** The names a reading finds: from the first lines of a text, an address or a file's name. */
  const namesFrom = (
    reading: JobReading,
  ): { title?: string; company?: string } => {
    const short = (value?: string) =>
      value && value.length <= 60 ? value : undefined;
    if (reading.source === 'text') {
      const lines = reading.from
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      return {
        title: short(lines[0]) ?? lines[0]?.split(/\s+/).slice(0, 5).join(' '),
        company: lines.length > 2 ? short(lines[1]) : undefined,
      };
    }
    if (reading.source === 'link') {
      const url = new URL(reading.from);
      const slug = url.pathname.split('/').filter(Boolean).pop() ?? '';
      const words = slug.replace(/[-_]+/g, ' ').trim();
      const label = url.hostname
        .split('.')
        .find(part => !['www', 'jobs', 'careers'].includes(part));
      return {
        title: words
          ? words.charAt(0).toUpperCase() + words.slice(1)
          : undefined,
        company: label
          ? label.charAt(0).toUpperCase() + label.slice(1)
          : undefined,
      };
    }
    return {
      title: reading.from.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '),
    };
  };

  /** Ends the readings whose time has come, as the backend's trigger would. */
  const settleJobs = (profile: PreviewProfile) => {
    const time = now();
    let changed = false;
    for (const application of profile.applications ?? []) {
      const reading = profile.jobReadings?.[application.id];
      const job = application.job;
      if (
        !reading ||
        !job ||
        job.status !== 'reading' ||
        reading.settlesAt === null ||
        reading.settlesAt > time
      ) {
        continue;
      }
      changed = true;
      application.updatedAt = reading.settlesAt;
      if (reading.outcome !== 'ready') {
        job.status = 'failed';
        job.failure = reading.outcome;
        continue;
      }
      job.status = 'ready';
      job.takenAt = reading.settlesAt;
      const names = namesFrom(reading);
      application.title ||= names.title ?? '';
      application.company ??= names.company;
      if (reading.source === 'link') {
        application.jobDescription = `Copy of the posting at ${reading.from}. We are hiring for this role: you will design and run services in production and lead incident response for your area.`;
      } else if (reading.source === 'file') {
        application.jobDescription = `Read from ${reading.from}. You will design and run services in production and mentor engineers on the team.`;
      }
    }
    if (changed) {
      save();
    }
  };

  /**
   * A brief as the fake prepares it: one requirement for each sentence of the job (six at
   * most), the first ones shown by the profile's items and the last two left as gaps, and
   * four questions with notes.
   */
  const briefFor = (
    profile: PreviewProfile,
    application: JobApplication,
  ): ApplicationBrief => {
    const sentences = (application.jobDescription ?? '')
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean)
      .slice(0, 6);
    const items = profile.items;
    const requirements: BriefRequirement[] = sentences.map(
      (sentence, index) => ({
        text: sentence.replace(/[.!?]$/, '').slice(0, 120),
        importance: index < 4 ? 'required' : 'preferred',
        evidence: sentence,
        itemIds:
          index < sentences.length - 2 && items.length > 0
            ? [items[index % items.length]!.id]
            : [],
      }),
    );
    const questions: BriefQuestion[] = PREVIEW_QUESTIONS.map(
      ([text, kind], index) => ({
        text,
        kind,
        bullets: [
          ...(items[index]
            ? [
                {
                  text: items[index].text.slice(0, 80),
                  itemId: items[index].id,
                },
              ]
            : []),
          {
            text: 'Say what you changed afterwards, not only how you fixed it.',
          },
        ],
      }),
    );
    return {
      requirements,
      questions,
      applicationRevision: application.revision,
      profileRevision: profile.revision ?? 0,
      builtAt: now(),
    };
  };

  const profileOf = (uid: string): PreviewProfile => {
    state.profiles[uid] ??= { resources: [], items: [], extractionsToday: 0 };
    state.profiles[uid].applications ??= [];
    state.profiles[uid].revision ??= 0;
    return state.profiles[uid];
  };

  /** A change to the resources or the items: briefs built before it are out of date. */
  const touch = (profile: PreviewProfile) => {
    profile.revision = (profile.revision ?? 0) + 1;
  };

  const applicationsOf = (profile: PreviewProfile): JobApplication[] =>
    (profile.applications ??= []);

  const name = (value: string | undefined, required = false) => {
    const trimmed = value?.trim() ?? '';
    if (
      (required && trimmed.length === 0) ||
      trimmed.length > APPLICATION_NAME_MAX_CHARS
    ) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return trimmed || undefined;
  };

  const text = (value: string | undefined, max: number) => {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > max) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return trimmed || undefined;
  };

  const posting = (value: string | undefined) => {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }
    const link = parseProfileLink(value);
    if (!link) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return link;
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
  /**
   * The text the backend keeps when a resource is read (research doc 17): a note as pasted, a
   * file's text; nothing for a link until its copy is kept.
   */
  const keepText = (
    profile: PreviewProfile,
    resource: StoredResource,
    at: number,
  ) => {
    if (resource.source === 'link') {
      return;
    }
    const text =
      resource.source === 'text'
        ? (resource.pasted ?? '')
        : fileTextOf(resource.title);
    profile.texts = {
      ...profile.texts,
      [resource.id]: {
        text,
        kind: resource.source === 'text' ? 'note' : 'file',
        format:
          resource.source === 'text'
            ? 'text'
            : resource.contentType === 'application/pdf'
              ? 'pdf'
              : resource.contentType.startsWith('text/')
                ? 'text'
                : 'docx',
        takenAt: at,
        chars: text.length,
        truncated: false,
      },
    };
    resource.textAt = at;
  };

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
      touch(profile);
      resource.updatedAt = resource.settlesAt;
      if (resource.outcome === 'ready') {
        resource.status = 'ready';
        keepText(profile, resource, resource.settlesAt);
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
    lastReadUid = uid;
    const profile = profileOf(uid);
    settle(profile);
    settleJobs(profile);
    return profile;
  };

  const currentUid = (): string => {
    const uid = signedInUid() ?? lastReadUid;
    if (!uid) {
      throw new ProfileError(ProfileErrorCode.SignedOut);
    }
    return uid;
  };
  const currentProfile = (): PreviewProfile => read(currentUid());

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
      profile.texts = {};
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
        resource.storagePath = `users/${currentUid()}/interview-docs/${resource.id}/document`;
        resource.itemCount = addItems(profile, resource.id, entry.facts, at);
        if (resource.status === 'ready') {
          keepText(profile, resource, at);
        }
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
    failNextBrief: reason => {
      nextBriefFailure = reason;
    },
    failNextJob: reason => {
      nextJobFailure = reason;
    },
    setBriefsToday: count => {
      currentProfile().briefsToday = count;
      save();
    },
    seedApplications: () => {
      const profile = currentProfile();
      const day = 24 * 60 * 60 * 1000;
      const itemIds = profile.items.map(({ id }) => id);
      const briefOf = (
        gaps: number,
        applicationRevision: number,
        builtAt: number,
      ): ApplicationBrief => ({
        requirements: Array.from({ length: 6 }, (_, index) => ({
          text: `Requirement ${index + 1}`,
          importance: index < 4 ? 'required' : 'preferred',
          itemIds:
            index < 6 - gaps && itemIds.length > 0
              ? [itemIds[index % itemIds.length]]
              : [],
        })),
        questions: [],
        applicationRevision,
        profileRevision: profile.revision ?? 0,
        builtAt,
      });
      profile.applications = PREVIEW_SEED_APPLICATIONS.map((entry, index) => {
        const at = now() - (index + 1) * day;
        const revision = entry.brief === 'jobChanged' ? 2 : 1;
        return {
          id: newId('application'),
          title: entry.title,
          company: entry.company,
          role: entry.role,
          jobDescription: entry.jobDescription,
          postingUrl: entry.postingUrl,
          notes: entry.notes,
          revision,
          ...(entry.brief === 'none'
            ? {}
            : {
                brief: briefOf(
                  entry.brief === 'jobChanged' ? 0 : entry.brief.gaps,
                  1,
                  at,
                ),
              }),
          createdAt: at - day,
          updatedAt: at,
        };
      });
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
        ...(request.source === 'text' ? { pasted: request.text.trim() } : {}),
        storagePath: `users/${currentUid()}/interview-docs/${id}/document`,
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
      touch(profile);
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
      const jobId = Object.entries(profile.jobReadings ?? {}).find(
        ([, reading]) => reading.path === target.path,
      )?.[0];
      const job = applicationsOf(profile).find(({ id }) => id === jobId)?.job;
      // Like the rules of the file store: the owner's path, once, within the limits.
      if (
        (!resource && !job) ||
        uploaded.has(target.path) ||
        (resource ? resource.status : job?.status) !== 'awaitingUpload' ||
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
      if (resource) {
        startReading(resource);
        resource.updatedAt = now();
      } else if (job && jobId) {
        // The trigger reads the job once its file has arrived.
        job.status = 'reading';
        const reading = profile.jobReadings?.[jobId];
        if (reading) {
          reading.settlesAt = now() + PREVIEW_READ_MS;
        }
      }
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
      if (profile.texts?.[resourceId]) {
        const { [resourceId]: _removed, ...texts } = profile.texts;
        profile.texts = texts;
      }
      touch(profile);
      save();
      return { itemsRemoved: before - profile.items.length };
    },

    // No file exists here: the address leads nowhere on purpose.
    getFileUrl: async () => '#',
    getResourceText: async (uid, resourceId) => {
      const text = read(uid).texts?.[resourceId];
      return text ? { ...text } : null;
    },

    getApplications: async uid =>
      structuredClone(applicationsOf(read(uid))).sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
      ),
    getApplication: async (uid, applicationId) => {
      const found = applicationsOf(read(uid)).find(
        ({ id }) => id === applicationId,
      );
      return found ? structuredClone(found) : null;
    },
    getProfileRevision: async uid => read(uid).revision ?? 0,

    createApplication: async (request: CreateJobApplicationRequest) => {
      const uid = currentUid();
      const profile = currentProfile();
      const { job } = request;
      const application: JobApplication = {
        id: '',
        title: name(request.title) ?? '',
        company: name(request.company),
        role: name(request.role),
        notes: text(request.notes, APPLICATION_NOTES_MAX_CHARS),
        revision: 1,
        createdAt: now(),
        updatedAt: now(),
      };
      let reading: JobReading;
      if (job.source === 'text') {
        const pasted = text(job.text, JOB_DESCRIPTION_MAX_CHARS);
        if (!pasted) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        application.jobDescription = pasted;
        reading = {
          settlesAt: null,
          outcome: 'ready',
          source: 'text',
          from: pasted,
        };
      } else if (job.source === 'link') {
        const link = posting(job.url);
        if (!link) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        application.postingUrl = link;
        reading = {
          settlesAt: null,
          outcome: isHttpsInvalidHost(link) ? 'link-unreadable' : 'ready',
          source: 'link',
          from: link,
        };
      } else {
        const fileName = job.fileName.trim();
        if (
          !PROFILE_UPLOAD_CONTENT_TYPES.includes(job.contentType) ||
          fileName.length === 0 ||
          fileName.length > APPLICATION_FILE_NAME_MAX_CHARS
        ) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        reading = {
          settlesAt: null,
          outcome: 'ready',
          source: 'file',
          from: fileName,
        };
      }
      if (applicationsOf(profile).length >= APPLICATIONS_MAX) {
        throw new ProfileError(ProfileErrorCode.MaxApplications);
      }
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      if (nextJobFailure) {
        reading.outcome = nextJobFailure;
        nextJobFailure = null;
      }
      application.id = newId('application');
      application.job = {
        source: job.source,
        status: job.source === 'file' ? 'awaitingUpload' : 'reading',
        ...(job.source === 'file' ? { fileName: job.fileName.trim() } : {}),
        edited: false,
      };
      if (job.source === 'file') {
        reading.path = `users/${uid}/application-docs/${application.id}/job`;
      } else {
        reading.settlesAt = now() + PREVIEW_READ_MS;
      }
      profile.jobReadings = {
        ...profile.jobReadings,
        [application.id]: reading,
      };
      applicationsOf(profile).push(application);
      profile.extractionsToday += 1;
      save();
      return job.source === 'file' && reading.path
        ? {
            applicationId: application.id,
            upload: {
              path: reading.path,
              contentType: job.contentType,
              maxBytes: PROFILE_UPLOAD_MAX_BYTES,
            },
          }
        : { applicationId: application.id };
    },

    updateApplication: async ({ applicationId, ...changes }) => {
      const application = applicationsOf(currentProfile()).find(
        ({ id }) => id === applicationId,
      );
      if (!application) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const before = JSON.stringify(application);
      if (changes.title !== undefined) {
        application.title = name(changes.title, true) ?? '';
      }
      if (changes.company !== undefined) {
        application.company = name(changes.company ?? undefined);
      }
      if (changes.role !== undefined) {
        application.role = name(changes.role ?? undefined);
      }
      if (changes.jobDescription !== undefined) {
        const job = text(changes.jobDescription, JOB_DESCRIPTION_MAX_CHARS);
        // Not while the job is being read ("job-not-ready"), and never emptied.
        if (!job || isJobPending(application)) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        application.jobDescription = job;
        if (application.job) {
          // Pasted after a failed reading, the job becomes ready.
          application.job.status = 'ready';
          application.job.failure = undefined;
          application.job.edited = true;
        }
      }
      if (changes.postingUrl !== undefined) {
        application.postingUrl = posting(changes.postingUrl ?? undefined);
      }
      if (changes.notes !== undefined) {
        application.notes = text(
          changes.notes ?? undefined,
          APPLICATION_NOTES_MAX_CHARS,
        );
      }
      // The posting's address is not something a brief is built from.
      const { postingUrl: _before, ...was } = JSON.parse(
        before,
      ) as JobApplication;
      const { postingUrl: _after, ...is } = application;
      if (JSON.stringify(was) !== JSON.stringify(is)) {
        application.revision += 1;
      }
      application.updatedAt = now();
      save();
      return { revision: application.revision };
    },

    prepareBrief: async applicationId => {
      const profile = currentProfile();
      const application = applicationsOf(profile).find(
        ({ id }) => id === applicationId,
      );
      if (!application) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      if (application.job && application.job.status !== 'ready') {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const failure = nextBriefFailure;
      nextBriefFailure = null;
      if (
        failure === 'quota' ||
        (profile.briefsToday ?? 0) >= BRIEF_DAILY_LIMIT
      ) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      await wait(PREVIEW_BRIEF_MS);
      profile.briefsToday = (profile.briefsToday ?? 0) + 1;
      if (failure === 'model') {
        save();
        throw new ProfileError(ProfileErrorCode.Unknown);
      }
      application.brief = briefFor(profile, application);
      application.updatedAt = now();
      save();
    },
    getBriefsToday: async uid => read(uid).briefsToday ?? 0,

    removeApplication: async applicationId => {
      const profile = currentProfile();
      if (!applicationsOf(profile).some(({ id }) => id === applicationId)) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      profile.applications = applicationsOf(profile).filter(
        ({ id }) => id !== applicationId,
      );
      save();
    },
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
