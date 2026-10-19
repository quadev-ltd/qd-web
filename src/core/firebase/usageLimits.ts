// The user's daily limits of the AI services through Firebase: `usageLimits/{uid}`, read with
// Firestore Lite under the owner-read rule. The contract is in src/core/profile/usageLimits.ts.
import { doc, getDoc } from 'firebase/firestore/lite';

import { db } from './app';
import { mapped } from './interviewProfile';

import logger from '@/core/logger';
import {
  type StoredUsageLimits,
  usageLimitsPath,
} from '@/core/profile/usageLimits';

/**
 * The overrides as stored, or `null` when there are none. Each service's entry is read with
 * serviceOverride and effectiveLimits, as the backend reads it: one not understood gives that
 * service its defaults, and leaves the others as they are.
 */
export const getUsageLimits = (
  uid: string,
): Promise<StoredUsageLimits | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageLimitsPath(uid)));
    const services: unknown = snapshot.data()?.services;
    if (services === undefined) {
      return null;
    }
    if (typeof services !== 'object' || services === null) {
      logger().logError(new Error('getUsageLimits: services not understood'));
      return null;
    }
    // A plain copy, kept in the store.
    return {
      services: JSON.parse(JSON.stringify(services)) as Record<string, unknown>,
    };
  });
