// The interview profile through Firebase: the owner's documents read with Firestore Lite,
// the callables of quadev-backend's `interview-profile` codebase, and the upload to Cloud
// Storage. The contract is in src/core/profile/contract.ts; what was tried against the
// real backend before this was written is in docs/adr/0007-interview-profile.md.
import {
  collection,
  doc,
  type DocumentData,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore/lite';
import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { type z } from 'zod';

import { db } from './app';
import { functions } from './functions';
import { storage } from './storage';

import logger from '@/core/logger';
import {
  CallableReason,
  CREATE_PROFILE_RESOURCE,
  type CreateProfileResourceRequest,
  CreateProfileResourceResponseSchema,
  PROFILE_EXTRACTION_SERVICE,
  type ProfileResource,
  ProfileResourceSchema,
  profileResourcesPath,
  type ProfileResourceText,
  ProfileResourceTextSchema,
  profileTextPath,
  READ_PROFILE_LINK_AGAIN,
  ReadAgainResponseSchema,
  REMOVE_PROFILE_RESOURCE,
  type RemoveProfileResourceRequest,
  RemoveProfileResourceResponseSchema,
  type SkillMapItem,
  SkillMapItemSchema,
  skillMapItemsPath,
  UPDATE_SKILL_MAP_ITEM,
  type UpdateSkillMapItemRequest,
  UpdateSkillMapItemResponseSchema,
  usageDayPath,
} from '@/core/profile/contract';
import { CvRefusal } from '@/core/profile/cvVersions';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import {
  type CreatedResource,
  type ItemChange,
  type UploadOptions,
  type UploadTarget,
} from '@/core/profile/gateway';
import { INTERVIEW_LIMIT_REASON } from '@/core/profile/interviews';

// ---------- Errors ----------

const codeOf = (error: unknown): string => {
  if (error && typeof error === 'object' && 'code' in error) {
    const { code } = error as { code: unknown };
    return typeof code === 'string' ? code : '';
  }
  return '';
};

const reasonOf = (error: unknown): unknown =>
  error && typeof error === 'object' && 'details' in error
    ? (error as { details?: { reason?: unknown } | null }).details?.reason
    : undefined;

/** What each reason of a `failed-precondition` refusal means for the screens. */
const PRECONDITION_CODES: Record<string, ProfileErrorCode> = {
  [CallableReason.MaxResources]: ProfileErrorCode.MaxResources,
  [CallableReason.MaxApplications]: ProfileErrorCode.MaxApplications,
  [INTERVIEW_LIMIT_REASON]: ProfileErrorCode.MaxInterviews,
  [CallableReason.AlreadyReading]: ProfileErrorCode.Reading,
  [CallableReason.JobNotReady]: ProfileErrorCode.Reading,
  [CallableReason.JobEdited]: ProfileErrorCode.JobEdited,
  // The pages only offer to read a link again.
  [CallableReason.NotALink]: ProfileErrorCode.Invalid,
  // CV versions (research doc 18). The pages only offer a CV, and a job with its text.
  [CvRefusal.MaxVersions]: ProfileErrorCode.MaxCvVersions,
  [CvRefusal.NoCvText]: ProfileErrorCode.NoCvText,
  [CvRefusal.NotACv]: ProfileErrorCode.Invalid,
  [CvRefusal.NoJobDescription]: ProfileErrorCode.Invalid,
  // The review pages only offer what the version allows.
  [CvRefusal.NotReady]: ProfileErrorCode.Invalid,
  [CvRefusal.NotEditable]: ProfileErrorCode.Invalid,
  [CvRefusal.NotAJob]: ProfileErrorCode.Invalid,
  // A written CV (D83) needs something in the profile to write from.
  [CvRefusal.NoItems]: ProfileErrorCode.NoItems,
  [CvRefusal.NotWritten]: ProfileErrorCode.Invalid,
  [CvRefusal.EditRetired]: ProfileErrorCode.Invalid,
};

/**
 * What a Firebase error means for the profile screens. Firestore codes are bare
 * ("permission-denied"), the others carry their service ("functions/…", "storage/…").
 */
export const toProfileError = (error: unknown): ProfileError => {
  if (error instanceof ProfileError) {
    return error;
  }
  const code = codeOf(error);
  switch (code) {
    case 'functions/permission-denied':
      return new ProfileError(
        reasonOf(error) === CallableReason.Flag
          ? ProfileErrorCode.FlagOff
          : ProfileErrorCode.SignedOut,
      );
    case 'functions/resource-exhausted':
      return new ProfileError(ProfileErrorCode.DailyLimit);
    case 'functions/failed-precondition':
      return new ProfileError(
        PRECONDITION_CODES[String(reasonOf(error))] ?? ProfileErrorCode.Unknown,
      );
    case 'functions/not-found':
    case 'storage/object-not-found':
      return new ProfileError(ProfileErrorCode.NotFound);
    case 'functions/invalid-argument':
      return new ProfileError(ProfileErrorCode.Invalid);
    case 'functions/unauthenticated':
    case 'storage/unauthenticated':
    case 'permission-denied':
    case 'unauthenticated':
      return new ProfileError(ProfileErrorCode.SignedOut);
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'storage/retry-limit-exceeded':
    case 'unavailable':
    case 'deadline-exceeded':
      return new ProfileError(ProfileErrorCode.Network);
    case 'functions/internal':
      // The Functions SDK also reports a request that never left the browser this way.
      return new ProfileError(
        globalThis.navigator?.onLine === false
          ? ProfileErrorCode.Network
          : ProfileErrorCode.Unknown,
      );
    case 'storage/unauthorized':
      return new ProfileError(ProfileErrorCode.UploadRefused);
    case 'storage/canceled':
      return new ProfileError(ProfileErrorCode.UploadCancelled);
    default:
      return new ProfileError(ProfileErrorCode.Unknown);
  }
};

export const mapped = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw toProfileError(error);
  }
};

// ---------- Reads ----------

export const millis = (value: unknown): number | null =>
  value instanceof Timestamp ? value.toMillis() : null;

/** A page read again (`refresh`, on a link or a job), with its Timestamps in milliseconds. */
export const refreshWithDates = (
  refresh: DocumentData | undefined,
): { refresh?: DocumentData } =>
  refresh
    ? {
        refresh: {
          ...refresh,
          startedAt: millis(refresh.startedAt),
          ...(refresh.finishedAt === undefined
            ? {}
            : { finishedAt: millis(refresh.finishedAt) }),
        },
      }
    : {};

const withDates = (id: string, data: DocumentData) => ({
  ...data,
  id,
  createdAt: millis(data.createdAt),
  updatedAt: millis(data.updatedAt),
  ...(data.textAt === undefined ? {} : { textAt: millis(data.textAt) }),
  ...refreshWithDates(data.refresh as DocumentData | undefined),
});

/**
 * The documents that match the contract. One that does not is left out and counted in the
 * log (a count only: never its content), so a field this version does not understand
 * cannot break a page.
 */
const parseAll = <T>(
  operation: string,
  schema: z.ZodType<T>,
  documents: { id: string; data(): DocumentData }[],
): T[] => {
  const parsed = documents.map(document =>
    schema.safeParse(withDates(document.id, document.data())),
  );
  const rejected = parsed.filter(result => !result.success).length;
  if (rejected > 0) {
    logger().logError(
      new Error(`${operation}: ${rejected} document(s) not understood`),
    );
  }
  return parsed.flatMap(result => (result.success ? [result.data] : []));
};

/** The resources of the profile, newest first. */
export const getResources = (uid: string): Promise<ProfileResource[]> =>
  mapped(async () => {
    const snapshot = await getDocs(
      query(
        collection(db(), profileResourcesPath(uid)),
        orderBy('createdAt', 'desc'),
      ),
    );
    return parseAll('getResources', ProfileResourceSchema, snapshot.docs);
  });

export const getResource = (
  uid: string,
  resourceId: string,
): Promise<ProfileResource | null> =>
  mapped(async () => {
    const snapshot = await getDoc(
      doc(db(), profileResourcesPath(uid, resourceId)),
    );
    if (!snapshot.exists()) {
      return null;
    }
    return (
      parseAll('getResource', ProfileResourceSchema, [snapshot])[0] ?? null
    );
  });

/**
 * Every item of the skill map. No order is asked for: "starred first, then newest" would
 * need an index of its own in the backend, and a profile is small enough to sort in the page.
 */
export const getItems = (uid: string): Promise<SkillMapItem[]> =>
  mapped(async () => {
    const snapshot = await getDocs(collection(db(), skillMapItemsPath(uid)));
    return parseAll('getItems', SkillMapItemSchema, snapshot.docs);
  });

/** The text kept of one resource, or `null` when there is none. */
export const getResourceText = (
  uid: string,
  resourceId: string,
): Promise<ProfileResourceText | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), profileTextPath(uid, resourceId)));
    if (!snapshot.exists()) {
      return null;
    }
    const data = snapshot.data();
    const parsed = ProfileResourceTextSchema.safeParse({
      ...data,
      takenAt: millis(data.takenAt),
    });
    if (!parsed.success) {
      logger().logError(new Error('getResourceText: not understood'));
      return null;
    }
    return parsed.data;
  });

/** How many resources the backend read for this user today (UTC). */
export const getExtractionsToday = (uid: string): Promise<number> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageDayPath(uid, new Date())));
    const calls: unknown =
      snapshot.data()?.services?.[PROFILE_EXTRACTION_SERVICE]?.calls;
    return typeof calls === 'number' && calls > 0 ? calls : 0;
  });

// ---------- Callables ----------

/** Calls a callable and checks that its answer is what the contract says. */
export const call = <Request, Response>(
  name: string,
  schema: z.ZodType<Response>,
  data: Request,
): Promise<Response> =>
  mapped(async () => {
    const result = await httpsCallable<Request, unknown>(
      functions(),
      name,
    )(data);
    const parsed = schema.safeParse(result.data);
    if (!parsed.success) {
      throw new ProfileError(ProfileErrorCode.Unknown);
    }
    return parsed.data;
  });

export const createResource = (
  request: CreateProfileResourceRequest,
): Promise<CreatedResource> =>
  call(CREATE_PROFILE_RESOURCE, CreateProfileResourceResponseSchema, request);

export const updateItem = async (
  itemId: string,
  change: ItemChange,
): Promise<void> => {
  await call<UpdateSkillMapItemRequest, unknown>(
    UPDATE_SKILL_MAP_ITEM,
    UpdateSkillMapItemResponseSchema,
    { itemId, ...change },
  );
};

export const removeItem = async (itemId: string): Promise<void> => {
  await call<UpdateSkillMapItemRequest, unknown>(
    UPDATE_SKILL_MAP_ITEM,
    UpdateSkillMapItemResponseSchema,
    { itemId, remove: true },
  );
};

export const removeResource = async (
  resourceId: string,
): Promise<{ itemsRemoved: number }> => {
  const { itemsRemoved } = await call<
    RemoveProfileResourceRequest,
    z.infer<typeof RemoveProfileResourceResponseSchema>
  >(REMOVE_PROFILE_RESOURCE, RemoveProfileResourceResponseSchema, {
    resourceId,
  });
  return { itemsRemoved };
};

/** Asks for a link's page to be read again; the resource then says how it goes. */
export const readLinkAgain = async (resourceId: string): Promise<void> => {
  await call(READ_PROFILE_LINK_AGAIN, ReadAgainResponseSchema, { resourceId });
};

// ---------- The file ----------

/**
 * Uploads the file of a resource to the path the backend answered, with the content type
 * it answered. The file store's rules accept one upload per path: this is never tried a
 * second time for the same resource.
 */
export const uploadFile = (
  target: UploadTarget,
  file: Blob,
  { onProgress, signal }: UploadOptions = {},
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new ProfileError(ProfileErrorCode.UploadCancelled));
      return;
    }
    const task = uploadBytesResumable(ref(storage(), target.path), file, {
      contentType: target.contentType,
    });
    const cancel = () => {
      task.cancel();
    };
    signal?.addEventListener('abort', cancel, { once: true });
    task.on(
      'state_changed',
      snapshot => {
        if (snapshot.totalBytes > 0) {
          onProgress?.(snapshot.bytesTransferred / snapshot.totalBytes);
        }
      },
      error => {
        signal?.removeEventListener('abort', cancel);
        reject(toProfileError(error));
      },
      () => {
        signal?.removeEventListener('abort', cancel);
        resolve();
      },
    );
  });

/**
 * An address that downloads the stored file, for a normal link. The page never reads the
 * bytes itself: that would need a cross-origin rule on the bucket (docs/adr/0007).
 */
export const getFileUrl = ({
  storagePath,
}: Pick<ProfileResource, 'storagePath'>): Promise<string> =>
  mapped(() => getDownloadURL(ref(storage(), storagePath)));
