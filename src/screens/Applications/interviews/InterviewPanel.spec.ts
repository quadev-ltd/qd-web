import {
  formWhenOf,
  interviewChangesOf,
  newInterviewOf,
} from './InterviewPanel';

import { interviewFixture } from '@/testUtil/applicationFixtures';

const values = {
  name: 'Technical interview',
  date: '2026-10-28',
  startTime: '14:00',
  lengthMinutes: 60,
  type: 'technical' as const,
  description: interviewFixture().description,
};

describe('formWhenOf', () => {
  it('shows the date and time as entered in the zone they were entered in', () => {
    expect(formWhenOf(interviewFixture(), 'Europe/London')).toEqual({
      date: '2026-10-28',
      startTime: '14:00',
    });
  });

  it('shows when it starts in the browser’s zone when that is another one', () => {
    expect(
      formWhenOf(
        interviewFixture({ timeZone: 'America/New_York', startTime: '10:00' }),
        'Asia/Tokyo',
      ),
    ).toEqual({ date: '2026-10-28', startTime: '23:00' });
  });
});

describe('interviewChangesOf', () => {
  it('is nothing when nothing changed', () => {
    expect(
      interviewChangesOf(interviewFixture(), values, 'Europe/London'),
    ).toEqual({});
  });

  it('clears an optional field that was emptied, and the description with ""', () => {
    expect(
      interviewChangesOf(
        interviewFixture(),
        {
          ...values,
          name: '',
          lengthMinutes: null,
          type: null,
          description: '',
        },
        'Europe/London',
      ),
    ).toEqual({ name: null, lengthMinutes: null, type: null, description: '' });
  });

  it('sends the date, time and zone together when either changed', () => {
    expect(
      interviewChangesOf(
        interviewFixture(),
        { ...values, date: '2026-10-29' },
        'Europe/London',
      ),
    ).toEqual({
      date: '2026-10-29',
      startTime: '14:00',
      timeZone: 'Europe/London',
    });
  });

  it('keeps the zone it was entered in when the date and time are not touched elsewhere', () => {
    const elsewhere = interviewFixture({
      timeZone: 'America/New_York',
      startTime: '10:00',
    });
    expect(
      interviewChangesOf(
        elsewhere,
        { ...values, ...formWhenOf(elsewhere, 'Europe/London') },
        'Europe/London',
      ),
    ).toEqual({});
  });
});

describe('newInterviewOf', () => {
  it('sends the optional fields only when they are given', () => {
    expect(
      newInterviewOf(
        'a1',
        {
          name: '',
          date: '2026-10-28',
          startTime: '14:00',
          lengthMinutes: null,
          type: null,
          description: '',
        },
        'Europe/London',
      ),
    ).toEqual({
      applicationId: 'a1',
      date: '2026-10-28',
      startTime: '14:00',
      timeZone: 'Europe/London',
    });
    expect(newInterviewOf('a1', values, 'Europe/London')).toEqual({
      applicationId: 'a1',
      ...values,
      timeZone: 'Europe/London',
    });
  });
});
