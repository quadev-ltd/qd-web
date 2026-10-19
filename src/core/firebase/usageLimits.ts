// The user's daily limits of the AI services through Firebase: `usageLimits/{uid}`, read with
// Firestore Lite under the owner-read rule. The contract is in src/core/profile/usageLimits.ts.
import { doc, getDoc } from 'firebase/firestore/lite';

import { db } from './app';
import { mapped } from './interviewProfile';

import logger from '@/core/logger';
import {
  type UsageLimits,
  usageLimitsPath,
  UsageLimitsSchema,
} from '@/core/profile/usageLimits';

/** The overrides, or `null` when there are none (or they are not understood: the defaults apply). */
export const getUsageLimits = (uid: string): Promise<UsageLimits | null> =>
  mapped(async () => {
    const snapshot = await getDoc(doc(db(), usageLimitsPath(uid)));
    const data = snapshot.data();
    if (!data) {
      return null;
    }
    const parsed = UsageLimitsSchema.safeParse(data);
    if (!parsed.success) {
      logger().logError(new Error('getUsageLimits: document not understood'));
      return null;
    }
    return parsed.data;
  });
