// Where the feature flags come from, in the backend's order: the per-user overrides
// (quadev-backend docs/api.md, `featureFlags/{uid}`: the owner reads the document, only the
// backend writes it), then Remote Config.
import { doc, getDoc } from 'firebase/firestore/lite';

import { db } from './app';

import { parseOverrides } from '@/core/flags/evaluate';
import {
  FEATURE_FLAGS_COLLECTION,
  type FlagValues,
} from '@/core/flags/registry';

/**
 * The flags set for this user alone. Usually the document does not exist: then nothing is
 * overridden. Read once (Firestore Lite has no listener): a change made by an admin shows
 * the next time the site is opened.
 */
export const getFlagOverrides = async (uid: string): Promise<FlagValues> => {
  const snapshot = await getDoc(doc(db(), FEATURE_FLAGS_COLLECTION, uid));
  return snapshot.exists() ? parseOverrides(snapshot.data()) : {};
};

/**
 * The flags Remote Config sets for everyone (./remoteConfig.ts). That file, and the Remote
 * Config part of the SDK with it, is loaded here, the first time somebody is signed in.
 */
export const getRemoteFlags = async (): Promise<FlagValues> =>
  (await import('./remoteConfig')).getRemoteFlags();
