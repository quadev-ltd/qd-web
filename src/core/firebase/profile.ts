// The web version of the reads and writes of qd-mobile src/core/firebase/profile.ts: the
// same document, the same fields and the same order. The pure helpers of that file (dates
// and names) are in src/core/auth/profile.ts.
//
// One difference: the app listens to the document live (the full Firestore SDK). The
// website uses Firestore Lite, which only reads and writes, so `watchProfile` reads the
// document once and then reports the writes made from this page. A change made elsewhere
// (the app on a phone) shows the next time the site is opened. See
// docs/adr/0004-firebase-gateway.md.
import {
  deleteField,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore/lite';

import { db } from './app';

import { logAuthError } from '@/core/auth/errors';
import { normaliseName } from '@/core/auth/profile';
import { type ProviderNames, type UserProfile } from '@/core/auth/types';

// Contract: quadev-backend docs/api.md (users/{uid}) and firestore.rules.
const USERS = 'users';

const userDoc = (uid: string) => doc(db(), USERS, uid);

// ---------- Reads ----------

const toProfile = (data: Record<string, unknown> | undefined): UserProfile => ({
  firstName: typeof data?.firstName === 'string' ? data.firstName : '',
  lastName: typeof data?.lastName === 'string' ? data.lastName : '',
  ...(typeof data?.dateOfBirth === 'string'
    ? { dateOfBirth: data.dateOfBirth }
    : {}),
});

export const getProfile = async (uid: string): Promise<UserProfile | null> => {
  const snapshot = await getDoc(userDoc(uid));
  return snapshot.exists() ? toProfile(snapshot.data()) : null;
};

// ---------- Watching ----------

type ProfileListener = (profile: UserProfile | null) => void;

/** Waits between the attempts of the first read; after the last one the error is reported. */
export const PROFILE_READ_RETRY_DELAYS_MS = [1000, 3000];

const listeners = new Map<string, Set<ProfileListener>>();
// Counts the writes made from this page, per user: a read that started before a write must
// not report what it saw (it may be older than the write).
const writes = new Map<string, number>();

const writeCount = (uid: string) => writes.get(uid) ?? 0;

/** Tells the watchers what this page just wrote. */
const profileWritten = (uid: string, profile: UserProfile) => {
  writes.set(uid, writeCount(uid) + 1);
  listeners.get(uid)?.forEach(listener => listener(profile));
};

const wait = (milliseconds: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds);
  });

/**
 * Reports `users/{uid}`: the document as it is on the server now, then every write made
 * from this page. `onNext(null)` means the document does not exist.
 *
 * The first read is tried again after a network failure, so a short interruption does not
 * send an existing user to the complete-profile page; `onError` is called when it still
 * fails. A read overtaken by a write from this page is dropped.
 */
export const watchProfile = (
  uid: string,
  onNext: (profile: UserProfile | null) => void,
  onError: (error: unknown) => void,
): (() => void) => {
  let active = true;
  const listener: ProfileListener = profile => {
    if (active) {
      onNext(profile);
    }
  };
  const watchers = listeners.get(uid) ?? new Set<ProfileListener>();
  listeners.set(uid, watchers);
  watchers.add(listener);

  const read = async () => {
    for (let attempt = 0; active; attempt += 1) {
      const writesBefore = writeCount(uid);
      try {
        const profile = await getProfile(uid);
        if (writeCount(uid) === writesBefore) {
          listener(profile);
        }
        return;
      } catch (error) {
        const delay = PROFILE_READ_RETRY_DELAYS_MS[attempt];
        if (delay === undefined) {
          if (active) {
            logAuthError('watchProfile', error, uid);
            onError(error);
          }
          return;
        }
        await wait(delay);
      }
    }
  };
  read();

  return () => {
    active = false;
    watchers.delete(listener);
    if (watchers.size === 0) {
      listeners.delete(uid);
    }
  };
};

// ---------- Writes ----------

/** Creates `users/{uid}`. `createdAt` is set by the server, as the rules require. */
export const createProfile = async (uid: string, profile: UserProfile) => {
  const fields: UserProfile = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    ...(profile.dateOfBirth ? { dateOfBirth: profile.dateOfBirth } : {}),
  };
  await setDoc(userDoc(uid), { ...fields, createdAt: serverTimestamp() });
  profileWritten(uid, fields);
};

type ProfileChanges = Partial<Omit<UserProfile, 'dateOfBirth'>> & {
  dateOfBirth?: string | null;
};

/** The profile after `changes`, worked out here instead of read again. */
const withChanges = (
  profile: UserProfile,
  { dateOfBirth, ...names }: ProfileChanges,
): UserProfile => {
  const { dateOfBirth: previousDateOfBirth, ...previousNames } = profile;
  const nextDateOfBirth =
    dateOfBirth === undefined ? previousDateOfBirth : dateOfBirth;
  return {
    firstName: names.firstName ?? previousNames.firstName,
    lastName: names.lastName ?? previousNames.lastName,
    ...(nextDateOfBirth ? { dateOfBirth: nextDateOfBirth } : {}),
  };
};

const writeChanges = async (uid: string, changes: ProfileChanges) => {
  const { dateOfBirth, ...names } = changes;
  await updateDoc(userDoc(uid), {
    ...names,
    ...(dateOfBirth === null ? { dateOfBirth: deleteField() } : {}),
    ...(typeof dateOfBirth === 'string' ? { dateOfBirth } : {}),
  });
};

/** Changes names and/or date of birth. `dateOfBirth: null` removes it. */
export const updateProfile = async (uid: string, changes: ProfileChanges) => {
  await writeChanges(uid, changes);
  // The watchers need the whole profile. The write is done: a failed read is only logged.
  try {
    const profile = await getProfile(uid);
    if (profile) {
      profileWritten(uid, profile);
    }
  } catch (error) {
    logAuthError('getProfile', error, uid);
  }
};

/** Creates the profile, or completes it if a document already exists. */
export const saveProfile = async (uid: string, profile: UserProfile) => {
  const existing = await getProfile(uid);
  if (existing) {
    await writeChanges(uid, profile);
    profileWritten(uid, withChanges(existing, profile));
  } else {
    await createProfile(uid, profile);
  }
};

/**
 * After Google or Apple sign-in: creates the profile from the provider's names when there is
 * none yet. Returns false when the names are incomplete (the user then completes the profile).
 */
export const createProfileIfMissing = async (
  uid: string,
  names: ProviderNames,
): Promise<boolean> => {
  const existing = await getProfile(uid);
  if (existing) {
    return true;
  }
  const firstName = normaliseName(names.firstName);
  const lastName = normaliseName(names.lastName);
  if (!firstName || !lastName) {
    return false;
  }
  await createProfile(uid, { firstName, lastName });
  return true;
};

/** Test helper: forgets the watchers and the write counts. */
export const resetProfileWatchersForTests = () => {
  listeners.clear();
  writes.clear();
};
