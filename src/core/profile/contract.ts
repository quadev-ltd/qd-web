// The contract of the interview profile, copied from quadev-backend: the website cannot
// install `@quadev/shared`, which is private and not published (docs/adr/0007).
//
// Mirrors quadev-backend packages/shared/src/interviewProfile.ts (names, limits, the link
// check, the requests and the answers of the callables), and docs/api.md for the documents
// the owner reads. Checked against the backend at 106a428 (13 Oct 2026).
//
// Change this file only after the backend's docs/api.md says the same. The end-to-end tests
// against the backend's emulators (e2e-emulators/) are what catches a difference.
import { z } from 'zod';

// ---------- What a profile holds ----------

/** What a candidate can add to the profile. */
export const PROFILE_RESOURCE_TYPES = [
  'cv',
  'link',
  'document',
  'note',
] as const;
export type ProfileResourceType = (typeof PROFILE_RESOURCE_TYPES)[number];

/** How the content of a resource arrives: a file, text typed or pasted, or a link. */
export const PROFILE_RESOURCE_SOURCES = ['file', 'text', 'link'] as const;
export type ProfileResourceSource = (typeof PROFILE_RESOURCE_SOURCES)[number];

/** The type depends on the source: the backend refuses any other pair. */
export const RESOURCE_TYPES_BY_SOURCE = {
  file: ['cv', 'document'],
  text: ['cv', 'document', 'note'],
  link: ['link'],
} as const satisfies Record<
  ProfileResourceSource,
  readonly ProfileResourceType[]
>;

/**
 * Where a resource is in its life: created and waiting for its content, being read, read
 * (its items are in the skill map), or not read (`failure` says why). Nothing moves a
 * resource out of the first two by itself: the way out is to remove it.
 */
export const PROFILE_RESOURCE_STATUSES = [
  'awaitingUpload',
  'processing',
  'ready',
  'failed',
] as const;
export type ProfileResourceStatus = (typeof PROFILE_RESOURCE_STATUSES)[number];

/** Why a resource could not be read. */
export const PROFILE_RESOURCE_FAILURES = [
  'unsupported-file',
  'empty',
  'too-long',
  'too-large',
  'link-unreadable',
  'flag-off',
  'quota',
  'blocked',
  'model',
  'internal',
] as const;
export type ProfileResourceFailure = (typeof PROFILE_RESOURCE_FAILURES)[number];

/** The kinds of item in the skill map. */
export const SKILL_MAP_KINDS = [
  'skill',
  'experience',
  'project',
  'achievement',
  'story',
] as const;
export type SkillMapKind = (typeof SKILL_MAP_KINDS)[number];

// ---------- Limits ----------

/** Resources one profile can hold. */
export const PROFILE_MAX_RESOURCES = 20;
/** Longest title of a resource. */
export const PROFILE_TITLE_MAX_CHARS = 100;
/** Longest text of a resource, typed or pasted. */
export const PROFILE_TEXT_MAX_CHARS = 50_000;
/** Longest address of a link. */
export const PROFILE_LINK_MAX_CHARS = 2_000;
/** Longest text of one skill map item. */
export const SKILL_MAP_ITEM_MAX_CHARS = 600;
/** Largest file a candidate can upload (also in the backend's storage.rules). */
export const PROFILE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
/** Resources read per user and per day (docs/api.md, `createProfileResource`). */
export const PROFILE_DAILY_EXTRACTIONS = 20;

/** File types a candidate can upload: PDF, DOCX and plain text. */
export const PROFILE_UPLOAD_CONTENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
] as const;
export type ProfileUploadContentType =
  (typeof PROFILE_UPLOAD_CONTENT_TYPES)[number];

// ---------- Where the documents are ----------

/** `users/{uid}/interviewProfile/main`: the profile document (its revision counter). */
export const interviewProfilePath = (uid: string) =>
  `users/${uid}/interviewProfile/main`;

/** The resources of a profile; with `resourceId`, one of them. */
export const profileResourcesPath = (uid: string, resourceId?: string) =>
  `${interviewProfilePath(uid)}/resources${resourceId === undefined ? '' : `/${resourceId}`}`;

/** The skill map items of a profile; with `itemId`, one of them. */
export const skillMapItemsPath = (uid: string, itemId?: string) =>
  `${interviewProfilePath(uid)}/items${itemId === undefined ? '' : `/${itemId}`}`;

/** `usage/{uid}/days/{yyyy-mm-dd}`: the counters of one UTC day. */
export const usageDayPath = (uid: string, date: Date) =>
  `usage/${uid}/days/${date.toISOString().slice(0, 10)}`;

/** The name of the profile service inside a usage document (`services.<name>.calls`). */
export const PROFILE_EXTRACTION_SERVICE = 'profileExtraction';

// ---------- Links ----------

const PUBLIC_HOST =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
/** Endings that never name a public site. */
const PRIVATE_HOST_ENDINGS = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.arpa',
];

/**
 * The address of a public web page in its normal form, or `undefined` when a link is not
 * accepted: `https` only, a domain name (no IP address, no single-word host), the standard
 * port, no user name or password, at most PROFILE_LINK_MAX_CHARS characters. The part
 * after `#` is dropped. The backend applies the same check and refuses what fails it.
 */
export const parseProfileLink = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > PROFILE_LINK_MAX_CHARS ||
    /[\s<>"\\^`{|}]/.test(trimmed)
  ) {
    return undefined;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return undefined;
  }
  if (
    url.protocol !== 'https:' ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    return undefined;
  }
  const host = url.hostname;
  if (host.length > 253 || !PUBLIC_HOST.test(host)) {
    return undefined;
  }
  if (PRIVATE_HOST_ENDINGS.some(ending => host.endsWith(ending))) {
    return undefined;
  }
  url.hash = '';
  return url.href.length > PROFILE_LINK_MAX_CHARS ? undefined : url.href;
};

// ---------- The callables (codebase `interview-profile`, region europe-west1) ----------

export const CREATE_PROFILE_RESOURCE = 'createProfileResource';
export const UPDATE_SKILL_MAP_ITEM = 'updateSkillMapItem';
export const REMOVE_PROFILE_RESOURCE = 'removeProfileResource';

/** What `createProfileResource` takes. The title is 1 to PROFILE_TITLE_MAX_CHARS characters. */
export type CreateProfileResourceRequest =
  | {
      source: 'text';
      type: (typeof RESOURCE_TYPES_BY_SOURCE.text)[number];
      title: string;
      /** 1 to PROFILE_TEXT_MAX_CHARS characters. */
      text: string;
    }
  | {
      source: 'file';
      type: (typeof RESOURCE_TYPES_BY_SOURCE.file)[number];
      title: string;
      contentType: ProfileUploadContentType;
    }
  | {
      source: 'link';
      type: 'link';
      title: string;
      /** An address `parseProfileLink` accepts. */
      url: string;
    };

/** A document id, as the backend creates them. */
const documentId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const CreateProfileResourceResponseSchema = z.object({
  resourceId: documentId,
  /** Only for a file: upload it here, once, with this content type. */
  upload: z
    .object({
      /** Cloud Storage path in the default bucket. */
      path: z.string().min(1),
      contentType: z.enum(PROFILE_UPLOAD_CONTENT_TYPES),
      maxBytes: z.number().int().positive(),
    })
    .optional(),
});
export type CreateProfileResourceResponse = z.infer<
  typeof CreateProfileResourceResponseSchema
>;

/**
 * What `updateSkillMapItem` takes: one change at least (`text` is 1 to
 * SKILL_MAP_ITEM_MAX_CHARS characters), or `remove: true` alone.
 */
export type UpdateSkillMapItemRequest =
  | { itemId: string; text?: string; starred?: boolean; hidden?: boolean }
  | { itemId: string; remove: true };

export const UpdateSkillMapItemResponseSchema = z.object({
  itemId: documentId,
  removed: z.boolean(),
});

export interface RemoveProfileResourceRequest {
  resourceId: string;
}

export const RemoveProfileResourceResponseSchema = z.object({
  resourceId: documentId,
  itemsRemoved: z.number().int().nonnegative(),
});

/** `details.reason` of a callable error, when the code alone does not say enough. */
export const CallableReason = {
  /** `permission-denied`: the `interviewAssistant` flag is off for the caller. */
  Flag: 'flag',
  /** `failed-precondition`: the profile already holds PROFILE_MAX_RESOURCES resources. */
  MaxResources: 'max-resources',
} as const;

// ---------- The documents the owner reads ----------
// Timestamps are given here in milliseconds since the epoch: the Firebase folder converts
// them, so nothing outside it holds a Firestore class.

const timestamp = z.number().nullable().catch(null);

/** `users/{uid}/interviewProfile/main/resources/{id}`, with its id. */
export const ProfileResourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(PROFILE_RESOURCE_TYPES),
  title: z.string(),
  source: z.enum(PROFILE_RESOURCE_SOURCES),
  contentType: z.string().catch(''),
  /** Only for a link: the address of the page. */
  url: z.string().optional().catch(undefined),
  /** Cloud Storage path of the content. */
  storagePath: z.string().catch(''),
  status: z.enum(PROFILE_RESOURCE_STATUSES),
  // A reason this version does not know is shown as "something went wrong on our side".
  failure: z.enum(PROFILE_RESOURCE_FAILURES).optional().catch('internal'),
  /** Items in the skill map that came from this resource. */
  itemCount: z.number().int().nonnegative().catch(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ProfileResource = z.infer<typeof ProfileResourceSchema>;

/** `users/{uid}/interviewProfile/main/items/{id}`, with its id. */
export const SkillMapItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(SKILL_MAP_KINDS),
  /** One fact, as a short note. The candidate can edit it. */
  text: z.string(),
  /** The passage of the resource that supports the item, word for word. Never edited. */
  evidence: z.string().catch(''),
  /** The resource the item came from. */
  resourceId: z.string().catch(''),
  /** The candidate wants this one used first. */
  starred: z.boolean().catch(false),
  /** The candidate does not want this one used. */
  hidden: z.boolean().catch(false),
  /** The candidate changed the text. */
  edited: z.boolean().catch(false),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type SkillMapItem = z.infer<typeof SkillMapItemSchema>;
