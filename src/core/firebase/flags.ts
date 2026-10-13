// The per-user feature flag overrides (quadev-backend docs/api.md, `featureFlags/{uid}`).
// The owner reads the document; only the backend writes it.
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
