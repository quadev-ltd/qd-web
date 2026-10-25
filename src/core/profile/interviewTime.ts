// When the interviews of an application are (D89), as the pages say it. Every time is shown in the
// browser's time zone, worked out from the instant the backend computed (`startsAt`); the date
// and time the candidate entered are kept with their own zone, and shown when it is another one.
// An interview has ended at its start plus its length, or an hour after its start without one.
import { type ApplicationInterview, type InterviewTime } from './interviews';

/** How long an interview without a length is taken to last. */
export const ASSUMED_LENGTH_MINUTES = 60;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** The browser's time zone, an IANA name ('Europe/London'). */
export const browserTimeZone = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

type Timed = Pick<ApplicationInterview, 'startsAt' | 'lengthMinutes'>;

/** When an interview ends. */
export const endOf = ({ startsAt, lengthMinutes }: Timed): number =>
  startsAt + (lengthMinutes ?? ASSUMED_LENGTH_MINUTES) * MINUTE_MS;

/** It has not ended yet: it is under "Coming up". */
export const isComingUp = (interview: Timed, now: number): boolean =>
  endOf(interview) > now;

/** Coming up, the next one first; past, the latest first. */
export const splitInterviews = <T extends Timed>(
  interviews: readonly T[],
  now: number,
): { comingUp: T[]; past: T[] } => {
  const sorted = [...interviews].sort((a, b) => a.startsAt - b.startsAt);
  return {
    comingUp: sorted.filter(interview => isComingUp(interview, now)),
    past: sorted.filter(interview => !isComingUp(interview, now)).reverse(),
  };
};

/** The next interview of an application, from the times it keeps: the first that hasn't ended. */
export const nextInterviewOf = (
  times: readonly InterviewTime[] | undefined,
  now: number,
): InterviewTime | undefined =>
  [...(times ?? [])]
    .sort((a, b) => a.startsAt - b.startsAt)
    .find(time => isComingUp(time, now));

// ---------- An instant in a zone ----------

export interface ZonedParts {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:mm', 24-hour. */
  time: string;
  /** 'Wednesday', 'Wed'. */
  weekday: string;
  weekdayShort: string;
  /** '28'. */
  day: string;
  /** 'October', 'Oct'. */
  month: string;
  monthShort: string;
  year: string;
}

const formatters = new Map<string, Intl.DateTimeFormat[]>();

const formattersFor = (timeZone: string): Intl.DateTimeFormat[] => {
  let found = formatters.get(timeZone);
  if (!found) {
    found = [
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }),
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'long',
        month: 'long',
      }),
      new Intl.DateTimeFormat('en-GB', {
        timeZone,
        weekday: 'short',
        month: 'short',
      }),
    ];
    formatters.set(timeZone, found);
  }
  return found;
};

const partsOf = (format: Intl.DateTimeFormat, instant: number) =>
  Object.fromEntries(
    format.formatToParts(instant).map(({ type, value }) => [type, value]),
  ) as Partial<Record<Intl.DateTimeFormatPartTypes, string>>;

/** The date and time of an instant in a zone, with the names of its day and month. */
export const zonedParts = (instant: number, timeZone: string): ZonedParts => {
  const [numeric, long, short] = formattersFor(timeZone);
  const n = partsOf(numeric, instant);
  const l = partsOf(long, instant);
  const s = partsOf(short, instant);
  return {
    date: `${n.year}-${n.month}-${n.day}`,
    time: `${n.hour}:${n.minute}`,
    weekday: l.weekday ?? '',
    weekdayShort: s.weekday ?? '',
    day: String(Number(n.day)),
    month: l.month ?? '',
    monthShort: s.month ?? '',
    year: n.year ?? '',
  };
};

const dayNumber = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
};

/** Calendar days from today to the day of an instant, in a zone: 0 today, 1 tomorrow. */
export const daysUntil = (
  instant: number,
  now: number,
  timeZone: string,
): number =>
  dayNumber(zonedParts(instant, timeZone).date) -
  dayNumber(zonedParts(now, timeZone).date);

// ---------- A zone's name ----------

/**
 * The city of an IANA zone ('America/New_York' → 'New York'); none for a zone that names no
 * place ('UTC', 'Etc/GMT+3').
 */
export const zoneCity = (timeZone: string): string | undefined => {
  if (!timeZone.includes('/') || timeZone.startsWith('Etc/')) {
    return undefined;
  }
  return timeZone.split('/').pop()?.replaceAll('_', ' ') || undefined;
};

/**
 * The zone's short name at an instant: 'GMT' or 'BST' in London, 'GMT-4' in New York. Some
 * browsers say 'GMT+0' for London in winter: that is 'GMT'.
 */
export const zoneShortName = (timeZone: string, instant: number): string =>
  (
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(instant)
      .find(({ type }) => type === 'timeZoneName')?.value ?? timeZone
  ).replace(/^(GMT|UTC)[+-]0$/, '$1');

/** Midday (UTC) of a 'YYYY-MM-DD' date: when a zone's short name for that day is asked. */
export const middayOf = (date: string): number | undefined => {
  const [year, month, day] = date.split('-').map(Number);
  const at = Date.UTC(year, month - 1, day, 12);
  return Number.isNaN(at) ? undefined : at;
};

/** The zone is one the browser can work with. */
export const isKnownTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone });
    return true;
  } catch {
    return false;
  }
};
