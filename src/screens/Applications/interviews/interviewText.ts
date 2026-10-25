// How the interview pages name an interview and say when it is (D89, doc 15 §21.4): in the
// browser's time zone, from the instant the backend computed, with the end only when there is
// a length.
import { type TFunction } from 'i18next';
import { useEffect, useState } from 'react';

import {
  type ApplicationInterview,
  type InterviewTime,
} from '@/core/profile/interviews';
import {
  daysUntil,
  endOf,
  zoneCity,
  zonedParts,
  zoneShortName,
} from '@/core/profile/interviewTime';

/** Its name; without one, its type ("Technical interview"), or "Interview". */
export const interviewTitle = (
  t: TFunction,
  { name, type }: Pick<ApplicationInterview, 'name' | 'type'>,
): string =>
  name ||
  (type ? t(`interviews.typedTitle_${type}`) : t('interviews.untitled'));

/** "London time (GMT)": the city and the zone's short name at that time. */
export const zoneName = (t: TFunction, timeZone: string, at: number) => {
  const city = zoneCity(timeZone);
  const short = zoneShortName(timeZone, at);
  return city ? t('interviews.zoneWithCity', { city, short }) : short;
};

/** "New York time", without the short name. */
export const zoneCityName = (t: TFunction, timeZone: string, at: number) => {
  const city = zoneCity(timeZone);
  return city
    ? t('interviews.zoneCity', { city })
    : zoneShortName(timeZone, at);
};

/** "14:00 to 15:00", or "14:00" without a length. */
export const timesOf = (
  t: TFunction,
  interview: Pick<ApplicationInterview, 'startsAt' | 'lengthMinutes'>,
  timeZone: string,
) => {
  const start = zonedParts(interview.startsAt, timeZone).time;
  if (!interview.lengthMinutes) {
    return start;
  }
  const end = zonedParts(endOf(interview), timeZone).time;
  return t('interviews.timeRange', { start, end });
};

/** The year, only when it isn't this one. */
const yearOf = (instant: number, now: number, timeZone: string) => {
  const { year } = zonedParts(instant, timeZone);
  return year === zonedParts(now, timeZone).year ? '' : ` ${year}`;
};

/** "Wednesday 28 Oct", for a row and the removal. */
export const dayOf = (instant: number, now: number, timeZone: string) => {
  const { weekday, day, monthShort } = zonedParts(instant, timeZone);
  return `${weekday} ${day} ${monthShort}${yearOf(instant, now, timeZone)}`;
};

/** "Wed 28 Oct", for the list of applications. */
export const shortDayOf = (instant: number, now: number, timeZone: string) => {
  const { weekdayShort, day, monthShort } = zonedParts(instant, timeZone);
  return `${weekdayShort} ${day} ${monthShort}${yearOf(instant, now, timeZone)}`;
};

/** "Wednesday 28 October 2026", for the interview's page. */
export const fullDayOf = (instant: number, timeZone: string) => {
  const { weekday, day, month, year } = zonedParts(instant, timeZone);
  return `${weekday} ${day} ${month} ${year}`;
};

/** "today", "tomorrow", "in 3 days"; as a chip, "Today", "Tomorrow", "In 3 days". */
export const relativeDayOf = (
  t: TFunction,
  instant: number,
  now: number,
  timeZone: string,
  chip = false,
) => {
  const days = daysUntil(instant, now, timeZone);
  const suffix = chip ? 'Chip' : '';
  if (days <= 0) {
    return t(`interviews.today${suffix}`);
  }
  if (days === 1) {
    return t(`interviews.tomorrow${suffix}`);
  }
  return t(`interviews.inDays${suffix}`, { count: days });
};

/** "Wed 28 Oct, 14:00": the next interview on the list of applications. */
export const nextInterviewWhen = (
  t: TFunction,
  { startsAt }: Pick<InterviewTime, 'startsAt'>,
  now: number,
  timeZone: string,
) =>
  t('interviews.dayAndTime', {
    day: shortDayOf(startsAt, now, timeZone),
    time: zonedParts(startsAt, timeZone).time,
  });

const CLOCK_MS = 60_000;

/** The time now, once a minute: an interview that ends moves to "Past" on an open page. */
export const useNow = () => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
};
