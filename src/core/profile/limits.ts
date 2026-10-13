import { PROFILE_DAILY_EXTRACTIONS, PROFILE_MAX_RESOURCES } from './contract';

/**
 * When today's limit starts again: the backend counts per UTC day, so at the next midnight
 * UTC. Given as the visitor's own clock shows it ("01:00" in London in summer).
 */
export const dailyLimitResetTime = (now: Date = new Date()): string => {
  const reset = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(reset.getHours())}:${two(reset.getMinutes())}`;
};

/** Whether the profile holds as many resources as it can. */
export const isProfileFull = (resourceCount: number): boolean =>
  resourceCount >= PROFILE_MAX_RESOURCES;

/** Whether today's limit of resources read is used up, as far as the count shows. */
export const isDailyLimitReached = (extractionsToday: number): boolean =>
  extractionsToday >= PROFILE_DAILY_EXTRACTIONS;
