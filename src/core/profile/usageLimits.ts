// Per-user daily limits of the AI services: `usageLimits/{uid}`, written by an admin script
// (quadev-backend scripts/set-limit.ts), read by its owner. A service's override sits on top of
// its default, each field capped at a ceiling; the backend applies the same in assertWithinQuota.
// A copy of quadev-backend's packages/shared/src/usage.ts, as the rest of this folder is.
import { z } from 'zod';

/** The usage services the backend counts, as `usage/{uid}/days/{date}` names them. */
export const USAGE_SERVICES = {
  cvVersion: 'cvVersion',
} as const;

export const USAGE_LIMITS_COLLECTION = 'usageLimits';

/** `usageLimits/{uid}`: the user's overrides. Absent for everyone with the defaults. */
export const usageLimitsPath = (uid: string) =>
  `${USAGE_LIMITS_COLLECTION}/${uid}`;

export interface QuotaLimits {
  maxCallsPerDay: number;
  maxCostUsdPerDay: number;
}

/** The most an override can grant, so a typo can't run up a bill. */
export const USAGE_LIMIT_CEILING: QuotaLimits = {
  maxCallsPerDay: 50,
  maxCostUsdPerDay: 5,
};

/** CV versions a day, and their cost, for a user with no override (doc 13 question 33). */
export const CV_VERSION_DAILY_LIMIT: QuotaLimits = {
  maxCallsPerDay: 5,
  maxCostUsdPerDay: 0.5,
};

const OverrideSchema = z.object({
  maxCallsPerDay: z.number().int().nonnegative().optional(),
  maxCostUsdPerDay: z.number().nonnegative().optional(),
});
export type QuotaOverride = z.infer<typeof OverrideSchema>;

/** A malformed service's entry is left out, so its defaults apply, as the backend does. */
export const UsageLimitsSchema = z.object({
  services: z
    .record(z.string(), z.unknown())
    .catch({})
    .transform(
      entries =>
        Object.fromEntries(
          Object.entries(entries).flatMap(([service, value]) => {
            const parsed = OverrideSchema.safeParse(value);
            return parsed.success ? [[service, parsed.data]] : [];
          }),
        ) as Record<string, QuotaOverride>,
    ),
  note: z.string().optional().catch(undefined),
});
export type UsageLimits = z.infer<typeof UsageLimitsSchema>;

/**
 * A service's limits for one user: each field of the override on top of the default, capped at
 * the ceiling. 0 is allowed: it blocks the service for that user.
 */
export const effectiveLimits = (
  defaults: QuotaLimits,
  override?: QuotaOverride,
): QuotaLimits => ({
  maxCallsPerDay: Math.min(
    override?.maxCallsPerDay ?? defaults.maxCallsPerDay,
    USAGE_LIMIT_CEILING.maxCallsPerDay,
  ),
  maxCostUsdPerDay: Math.min(
    override?.maxCostUsdPerDay ?? defaults.maxCostUsdPerDay,
    USAGE_LIMIT_CEILING.maxCostUsdPerDay,
  ),
});
