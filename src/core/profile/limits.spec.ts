import {
  dailyLimitResetTime,
  isDailyLimitReached,
  isProfileFull,
} from './limits';

describe('profile limits', () => {
  it('is full at twenty resources', () => {
    expect(isProfileFull(19)).toBe(false);
    expect(isProfileFull(20)).toBe(true);
    expect(isProfileFull(21)).toBe(true);
  });

  it('reaches today’s limit at twenty resources read', () => {
    expect(isDailyLimitReached(19)).toBe(false);
    expect(isDailyLimitReached(20)).toBe(true);
  });

  it('gives the next midnight UTC as the visitor’s clock shows it', () => {
    const now = new Date('2026-10-13T15:30:00Z');
    const midnightUtc = new Date('2026-10-14T00:00:00Z');
    const two = (value: number) => String(value).padStart(2, '0');

    expect(dailyLimitResetTime(now)).toBe(
      `${two(midnightUtc.getHours())}:${two(midnightUtc.getMinutes())}`,
    );
    expect(dailyLimitResetTime(now)).toMatch(/^\d{2}:\d{2}$/);
  });

  it('says midnight UTC as the browser’s clock shows it: 01:00 in London in summer, 00:00 in winter', () => {
    // The unit tests run in Europe/London (vite.config.ts).
    expect(dailyLimitResetTime(new Date('2026-07-01T12:00:00Z'))).toBe('01:00');
    expect(dailyLimitResetTime(new Date('2026-11-01T12:00:00Z'))).toBe('00:00');
  });

  it('moves to the day after once midnight UTC has passed', () => {
    // One second before and one second after midnight UTC: the same time of day, a day apart.
    expect(dailyLimitResetTime(new Date('2026-10-13T23:59:59Z'))).toBe(
      dailyLimitResetTime(new Date('2026-10-14T00:00:01Z')),
    );
  });
});
