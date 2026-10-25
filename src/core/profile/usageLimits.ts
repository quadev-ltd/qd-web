// Per-user daily limits of the AI services: `usageLimits/{uid}`, written by the owner with
// quadev-backend's scripts/set-limit.ts, read by the user it is for. A service's override sits on
// top of its default, each field capped at a ceiling; the backend applies the same in
// assertWithinQuota for every service. A copy of quadev-backend's packages/shared/src/usage.ts
// (as of 00b79c0), as the rest of this folder is; its spec is the backend's fixtures.
import { z } from 'zod';

/** The services whose model calls are metered and limited, as `usage` and `usageLimits` name them. */
export const USAGE_SERVICES = {
  profileExtraction: 'profileExtraction',
  jobReading: 'jobReading',
  applicationBrief: 'applicationBrief',
  cvVersion: 'cvVersion',
  interviewQuestions: 'interviewQuestions',
  aiDiagnostics: 'aiDiagnostics',
} as const;
export type UsageService = (typeof USAGE_SERVICES)[keyof typeof USAGE_SERVICES];

export const isUsageService = (value: string): value is UsageService =>
  Object.hasOwn(USAGE_SERVICES, value);

/** A service's daily limits for one user: calls and estimated cost per UTC day. */
export interface DailyLimits {
  maxCallsPerDay: number;
  maxCostUsdPerDay: number;
}

/** What a CV version may use per user and day, unless the user has an override. */
export const CV_VERSION_DAILY_LIMIT: DailyLimits = {
  maxCallsPerDay: 5,
  maxCostUsdPerDay: 0.5,
};

/** The likely questions of an interview (D94, doc 21 §4): lists written per user and day. */
export const INTERVIEW_QUESTIONS_DAILY_LIMIT: DailyLimits = {
  maxCallsPerDay: 10,
  maxCostUsdPerDay: 0.5,
};

/** No override can go above this, so a typo cannot run up a bill. */
export const USAGE_LIMIT_CEILING: DailyLimits = {
  maxCallsPerDay: 50,
  maxCostUsdPerDay: 5,
};

export const USAGE_LIMITS_COLLECTION = 'usageLimits';

/** `usageLimits/{uid}` */
export const usageLimitsPath = (uid: string) =>
  `${USAGE_LIMITS_COLLECTION}/${uid}`;

/** One service's override: either field alone, 0 to block the service for the user. */
export const ServiceLimitsSchema = z.object({
  maxCallsPerDay: z.number().int().nonnegative().optional(),
  maxCostUsdPerDay: z.number().nonnegative().optional(),
});
export type ServiceLimits = z.infer<typeof ServiceLimitsSchema>;

/** The document `usageLimits/{uid}`. Other fields are tolerated. */
export const UsageLimitsSchema = z.object({
  services: z.record(z.string(), ServiceLimitsSchema).default({}),
  note: z.string().max(200).optional(),
  updatedAt: z.unknown().optional(),
  updatedBy: z.string().optional(),
});
export type UsageLimits = z.infer<typeof UsageLimitsSchema>;

/**
 * The limits that apply: each field of the override on top of the default, capped at
 * {@link USAGE_LIMIT_CEILING}. No override, or one that is not a valid {@link ServiceLimitsSchema},
 * gives the defaults.
 */
export const effectiveLimits = (
  defaults: DailyLimits,
  override?: unknown,
): DailyLimits => {
  const parsed = ServiceLimitsSchema.safeParse(override);
  const own = parsed.success ? parsed.data : {};
  return {
    maxCallsPerDay: Math.min(
      own.maxCallsPerDay ?? defaults.maxCallsPerDay,
      USAGE_LIMIT_CEILING.maxCallsPerDay,
    ),
    maxCostUsdPerDay: Math.min(
      own.maxCostUsdPerDay ?? defaults.maxCostUsdPerDay,
      USAGE_LIMIT_CEILING.maxCostUsdPerDay,
    ),
  };
};

/** One service's override in a `usageLimits/{uid}` document as stored, or `undefined`. */
export const serviceOverride = (
  document: unknown,
  service: string,
): unknown => {
  const parsed = z
    .object({ services: z.record(z.string(), z.unknown()) })
    .safeParse(document);
  return parsed.success ? parsed.data.services[service] : undefined;
};

/**
 * What the website keeps of `usageLimits/{uid}`: its services as stored, each read with
 * serviceOverride and effectiveLimits as the backend reads them, so one malformed entry never
 * hides another service's override.
 */
export interface StoredUsageLimits {
  services: Record<string, unknown>;
}
