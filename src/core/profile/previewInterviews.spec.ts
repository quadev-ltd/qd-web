import { ProfileError, ProfileErrorCode } from './errors';
import { type ApplicationInterview } from './interviews';
import {
  checkedFields,
  instantIn,
  seedInterviews,
  timesOf,
} from './previewInterviews';

const invalid = new ProfileError(ProfileErrorCode.Invalid);

describe('instantIn', () => {
  it('works out the instant of a date and time on a zone’s clocks, as the backend does', () => {
    expect(instantIn('2026-10-28', '14:00', 'Europe/London')).toBe(
      Date.parse('2026-10-28T14:00:00Z'),
    );
    expect(instantIn('2026-10-08', '11:00', 'Europe/London')).toBe(
      Date.parse('2026-10-08T10:00:00Z'),
    );
    expect(instantIn('2026-10-28', '10:00', 'America/New_York')).toBe(
      Date.parse('2026-10-28T14:00:00Z'),
    );
    expect(instantIn('2026-10-29', '08:30', 'Asia/Tokyo')).toBe(
      Date.parse('2026-10-28T23:30:00Z'),
    );
  });

  it('on a change of the clocks, moves a time that doesn’t exist forward, and takes the earlier of one that comes twice', () => {
    // 01:30 on 29 Mar 2026 doesn't exist in London: 02:30 BST, 01:30 UTC.
    expect(instantIn('2026-03-29', '01:30', 'Europe/London')).toBe(
      Date.parse('2026-03-29T01:30:00Z'),
    );
    // 01:30 on 25 Oct 2026 comes twice: the first, in BST.
    expect(instantIn('2026-10-25', '01:30', 'Europe/London')).toBe(
      Date.parse('2026-10-25T00:30:00Z'),
    );
  });
});

describe('checkedFields', () => {
  it('takes what the backend takes, trimmed', () => {
    expect(
      checkedFields({
        name: '  Final interview ',
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
        lengthMinutes: 45,
        type: 'mixed',
        description: ' With the CTO. ',
      }),
    ).toEqual({ name: 'Final interview', description: 'With the CTO.' });
    expect(checkedFields({ date: '2000-01-01', lengthMinutes: 480 })).toEqual({
      name: undefined,
      description: undefined,
    });
  });

  it('refuses what the backend refuses', () => {
    expect(() => checkedFields({ name: 'x'.repeat(61) })).toThrow(invalid);
    expect(() => checkedFields({ date: '2026-02-30' })).toThrow(invalid);
    expect(() => checkedFields({ date: '1999-12-31' })).toThrow(invalid);
    expect(() => checkedFields({ date: '28/10/2026' })).toThrow(invalid);
    expect(() => checkedFields({ startTime: '24:00' })).toThrow(invalid);
    expect(() => checkedFields({ timeZone: 'Mars/Olympus_Mons' })).toThrow(
      invalid,
    );
    expect(() => checkedFields({ lengthMinutes: 4 })).toThrow(invalid);
    expect(() => checkedFields({ lengthMinutes: 30.5 })).toThrow(invalid);
    expect(() => checkedFields({ description: 'x'.repeat(2_001) })).toThrow(
      invalid,
    );
  });
});

describe('timesOf', () => {
  it('lists the interviews’ times, the oldest first, as the application keeps them', () => {
    const interview = (
      id: string,
      startsAt: number,
      more: Partial<ApplicationInterview> = {},
    ): ApplicationInterview => ({
      id,
      date: '2026-10-28',
      startTime: '14:00',
      timeZone: 'Europe/London',
      startsAt,
      description: '',
      revision: 1,
      createdAt: null,
      updatedAt: null,
      ...more,
    });

    expect(
      timesOf([
        interview('later', 2),
        interview('sooner', 1, { name: 'Recruiter call', lengthMinutes: 30 }),
      ]),
    ).toEqual([
      {
        interviewId: 'sooner',
        startsAt: 1,
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
        name: 'Recruiter call',
        lengthMinutes: 30,
      },
      {
        interviewId: 'later',
        startsAt: 2,
        date: '2026-10-28',
        startTime: '14:00',
        timeZone: 'Europe/London',
      },
    ]);
  });
});

describe('seedInterviews', () => {
  it('gives the interviews of the designs around now, in the zone given', () => {
    let next = 0;
    const now = Date.parse('2026-10-25T12:00:00Z');
    const { first, second } = seedInterviews(
      now,
      'Europe/London',
      () => `interview-${(next += 1)}`,
    );

    expect(
      first.map(({ name, date, startTime }) => [name, date, startTime]),
    ).toEqual([
      ['Technical interview', '2026-10-28', '14:00'],
      ['System design', '2026-11-05', '10:00'],
      ['Recruiter call', '2026-10-08', '11:00'],
    ]);
    expect(first[0].startsAt).toBe(Date.parse('2026-10-28T14:00:00Z'));
    expect(second).toMatchObject([
      { date: '2026-11-03', startTime: '09:30', type: 'behavioural' },
    ]);
    expect(second[0].name).toBeUndefined();
  });
});
