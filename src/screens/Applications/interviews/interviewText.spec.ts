import { type TFunction } from 'i18next';

import {
  dayOf,
  fullDayOf,
  interviewTitle,
  nextInterviewWhen,
  relativeDayOf,
  shortDayOf,
  timesOf,
  zoneCityName,
  zoneName,
} from './interviewText';

// The specs' t gives the key; this one also shows what it was given.
const t = ((key: string, params?: Record<string, unknown>) =>
  params
    ? `${key}(${Object.entries(params)
        .map(([name, value]) => `${name}=${String(value)}`)
        .join(',')})`
    : key) as unknown as TFunction;

const LONDON = 'Europe/London';
const NOW = Date.parse('2026-10-25T12:00:00Z');
const STARTS = Date.parse('2026-10-28T14:00:00Z');

describe('interviewTitle', () => {
  it('is its name; without one, its type with "interview", or "Interview"', () => {
    expect(interviewTitle(t, { name: 'Recruiter call', type: 'mixed' })).toBe(
      'Recruiter call',
    );
    expect(interviewTitle(t, { type: 'system-design' })).toBe(
      'interviews.typedTitle_system-design',
    );
    expect(interviewTitle(t, {})).toBe('interviews.untitled');
  });
});

describe('when it is', () => {
  it('names the day for a row, the list and the page', () => {
    expect(dayOf(STARTS, NOW, LONDON)).toBe('Wednesday 28 Oct');
    expect(shortDayOf(STARTS, NOW, LONDON)).toBe('Wed 28 Oct');
    expect(fullDayOf(STARTS, LONDON)).toBe('Wednesday 28 October 2026');
  });

  it('adds the year only when it isn’t this one', () => {
    const next = Date.parse('2027-01-12T10:00:00Z');
    expect(dayOf(next, NOW, LONDON)).toBe('Tuesday 12 Jan 2027');
    expect(shortDayOf(next, NOW, LONDON)).toBe('Tue 12 Jan 2027');
  });

  it('gives the times, with the end only when there is a length', () => {
    expect(timesOf(t, { startsAt: STARTS, lengthMinutes: 90 }, LONDON)).toBe(
      'interviews.timeRange(start=14:00,end=15:30)',
    );
    expect(timesOf(t, { startsAt: STARTS }, LONDON)).toBe('14:00');
    expect(
      timesOf(t, { startsAt: STARTS, lengthMinutes: 60 }, 'America/New_York'),
    ).toBe('interviews.timeRange(start=10:00,end=11:00)');
  });

  it('says how soon: today, tomorrow, in n days', () => {
    expect(relativeDayOf(t, NOW + 3_600_000, NOW, LONDON)).toBe(
      'interviews.today',
    );
    expect(relativeDayOf(t, NOW + 86_400_000, NOW, LONDON, true)).toBe(
      'interviews.tomorrowChip',
    );
    expect(relativeDayOf(t, STARTS, NOW, LONDON)).toBe(
      'interviews.inDays(count=3)',
    );
  });

  it('says when the next interview is on the list of applications', () => {
    expect(nextInterviewWhen(t, { startsAt: STARTS }, NOW, LONDON)).toBe(
      'interviews.dayAndTime(day=Wed 28 Oct,time=14:00)',
    );
  });
});

describe('the zone', () => {
  it('names it with its city and its short name at that time', () => {
    expect(zoneName(t, LONDON, STARTS)).toBe(
      'interviews.zoneWithCity(city=London,short=GMT)',
    );
    expect(zoneName(t, LONDON, Date.parse('2026-10-08T10:00:00Z'))).toBe(
      'interviews.zoneWithCity(city=London,short=BST)',
    );
    expect(zoneName(t, 'UTC', STARTS)).toBe('UTC');
  });

  it('names it with its city alone', () => {
    expect(zoneCityName(t, 'America/New_York', STARTS)).toBe(
      'interviews.zoneCity(city=New York)',
    );
  });
});
