import {
  browserTimeZone,
  daysUntil,
  endOf,
  isComingUp,
  isKnownTimeZone,
  middayOf,
  nextInterviewOf,
  splitInterviews,
  zoneCity,
  zonedParts,
  zoneShortName,
} from './interviewTime';

const HOUR = 3_600_000;
// The clocks in London go back on 25 Oct 2026 at 02:00 BST.
const AT_14_BST = Date.parse('2026-10-08T10:00:00Z'); // 11:00 in London
const AT_14_GMT = Date.parse('2026-10-28T14:00:00Z'); // 14:00 in London
const NOW = Date.parse('2026-10-25T12:00:00Z');

const times = (startsAt: number, lengthMinutes?: number) => ({
  interviewId: `i-${startsAt}`,
  startsAt,
  date: '',
  startTime: '',
  timeZone: 'Europe/London',
  lengthMinutes,
});

describe('when an interview ends', () => {
  it('ends at its start plus its length, or an hour after its start without one', () => {
    expect(endOf({ startsAt: AT_14_GMT, lengthMinutes: 90 })).toBe(
      AT_14_GMT + 1.5 * HOUR,
    );
    expect(endOf({ startsAt: AT_14_GMT })).toBe(AT_14_GMT + HOUR);
  });

  it('is coming up until it has ended, so one going on now is still coming up', () => {
    const interview = { startsAt: NOW - 30 * 60_000, lengthMinutes: 45 };
    expect(isComingUp(interview, NOW)).toBe(true);
    expect(isComingUp(interview, NOW + 15 * 60_000)).toBe(false);
  });
});

describe('splitInterviews', () => {
  it('puts the next one first under "Coming up", and the latest first under "Past"', () => {
    const a = { id: 'a', startsAt: NOW + 10 * HOUR };
    const b = { id: 'b', startsAt: NOW + 2 * HOUR };
    const c = { id: 'c', startsAt: NOW - 48 * HOUR };
    const d = { id: 'd', startsAt: NOW - 5 * HOUR };

    const { comingUp, past } = splitInterviews([a, c, b, d], NOW);

    expect(comingUp.map(({ id }) => id)).toEqual(['b', 'a']);
    expect(past.map(({ id }) => id)).toEqual(['d', 'c']);
  });
});

describe('nextInterviewOf', () => {
  it('is the first of the application’s interviews that has not ended', () => {
    const over = times(NOW - 3 * HOUR);
    const later = times(NOW + 30 * HOUR);
    const sooner = times(NOW + 2 * HOUR);

    expect(nextInterviewOf([later, over, sooner], NOW)).toBe(sooner);
  });

  it('counts the length when the application gives one', () => {
    const long = times(NOW - 80 * 60_000, 90);
    expect(nextInterviewOf([long], NOW)).toBe(long);
    expect(nextInterviewOf([times(NOW - 80 * 60_000)], NOW)).toBeUndefined();
  });

  it('is none without interviews, or when all are past', () => {
    expect(nextInterviewOf(undefined, NOW)).toBeUndefined();
    expect(nextInterviewOf([times(NOW - 5 * HOUR)], NOW)).toBeUndefined();
  });
});

describe('zonedParts', () => {
  it('says the date and time of an instant in a zone, on both sides of the clocks going back', () => {
    expect(zonedParts(AT_14_GMT, 'Europe/London')).toEqual({
      date: '2026-10-28',
      time: '14:00',
      weekday: 'Wednesday',
      weekdayShort: 'Wed',
      day: '28',
      month: 'October',
      monthShort: 'Oct',
      year: '2026',
    });
    expect(zonedParts(AT_14_BST, 'Europe/London')).toMatchObject({
      date: '2026-10-08',
      time: '11:00',
    });
  });

  it('says it in another zone, with its own day', () => {
    expect(zonedParts(AT_14_GMT, 'America/New_York')).toMatchObject({
      date: '2026-10-28',
      time: '10:00',
    });
    expect(zonedParts(AT_14_GMT, 'Asia/Tokyo')).toMatchObject({
      date: '2026-10-28',
      time: '23:00',
    });
    expect(
      zonedParts(Date.parse('2026-10-28T23:30:00Z'), 'Asia/Tokyo'),
    ).toMatchObject({ date: '2026-10-29', time: '08:30', weekday: 'Thursday' });
  });

  it('says midnight as 00:00', () => {
    expect(
      zonedParts(Date.parse('2026-11-02T00:00:00Z'), 'Europe/London').time,
    ).toBe('00:00');
  });
});

describe('daysUntil', () => {
  it('counts calendar days in the zone: today, tomorrow, then more', () => {
    const now = Date.parse('2026-10-25T22:30:00Z'); // 22:30 in London
    expect(
      daysUntil(Date.parse('2026-10-25T23:30:00Z'), now, 'Europe/London'),
    ).toBe(0);
    expect(
      daysUntil(Date.parse('2026-10-26T00:30:00Z'), now, 'Europe/London'),
    ).toBe(1);
    expect(daysUntil(AT_14_GMT, now, 'Europe/London')).toBe(3);
    // In Tokyo it is already the 26th.
    expect(daysUntil(AT_14_GMT, now, 'Asia/Tokyo')).toBe(2);
  });
});

describe('a zone’s name', () => {
  it('takes the city from the zone', () => {
    expect(zoneCity('Europe/London')).toBe('London');
    expect(zoneCity('America/New_York')).toBe('New York');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });

  it('has no city for a zone that names no place', () => {
    expect(zoneCity('UTC')).toBeUndefined();
    expect(zoneCity('Etc/GMT+3')).toBeUndefined();
  });

  it('gives the short name of the zone at that time', () => {
    expect(zoneShortName('Europe/London', AT_14_GMT)).toBe('GMT');
    expect(zoneShortName('Europe/London', AT_14_BST)).toBe('BST');
    expect(zoneShortName('UTC', AT_14_GMT)).toBe('UTC');
  });

  it('knows the zones the browser knows', () => {
    expect(isKnownTimeZone('Europe/London')).toBe(true);
    expect(isKnownTimeZone('Mars/Olympus_Mons')).toBe(false);
  });

  it('asks for a day’s short name at its midday', () => {
    expect(middayOf('2026-10-28')).toBe(Date.parse('2026-10-28T12:00:00Z'));
    expect(middayOf('')).toBeUndefined();
  });
});

describe('the tests’ zone', () => {
  it('is London, whatever the computer’s', () => {
    expect(browserTimeZone()).toBe('Europe/London');
  });
});
