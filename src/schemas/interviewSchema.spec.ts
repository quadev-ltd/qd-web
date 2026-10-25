import { interviewSchema, isInterviewDate } from './interviewSchema';

const valid = {
  name: ' Technical interview ',
  date: '2026-10-28',
  startTime: '14:00',
  lengthMinutes: 60,
  type: 'technical' as const,
  description: ' Two engineers. ',
};

describe('interviewSchema', () => {
  it('takes an interview with only its date and start time', () => {
    expect(
      interviewSchema.parse({
        name: '',
        date: '2026-10-28',
        startTime: '14:00',
        lengthMinutes: null,
        type: null,
        description: '',
      }),
    ).toEqual({
      name: '',
      date: '2026-10-28',
      startTime: '14:00',
      lengthMinutes: null,
      type: null,
      description: '',
    });
  });

  it('trims the name and the description', () => {
    expect(interviewSchema.parse(valid)).toMatchObject({
      name: 'Technical interview',
      description: 'Two engineers.',
    });
  });

  it('keeps the minutes of a field that shows seconds', () => {
    expect(
      interviewSchema.parse({ ...valid, startTime: '14:05:00' }).startTime,
    ).toBe('14:05');
  });

  it('asks for the date and the start time', () => {
    const result = interviewSchema.safeParse({
      ...valid,
      date: '',
      startTime: '',
    });
    expect(result.success).toBe(false);
    const messages = result.error?.issues.map(({ message }) => message);
    expect(messages).toContain('interviews.dateRequiredError');
    expect(messages).toContain('interviews.timeRequiredError');
  });

  it('refuses a name over 60 characters and a description over 2,000', () => {
    const result = interviewSchema.safeParse({
      ...valid,
      name: 'x'.repeat(61),
      description: 'x'.repeat(2_001),
    });
    expect(result.error?.issues.map(({ message }) => message)).toEqual([
      'interviews.nameLengthError',
      'interviews.descriptionLengthError',
    ]);
  });
});

describe('isInterviewDate', () => {
  it('takes a real date from 2000 to 2100, past ones too', () => {
    expect(isInterviewDate('2000-01-01')).toBe(true);
    expect(isInterviewDate('2024-02-29')).toBe(true);
    expect(isInterviewDate('2100-12-31')).toBe(true);
  });

  it('refuses one that does not exist, or is out of those years', () => {
    expect(isInterviewDate('2026-02-29')).toBe(false);
    expect(isInterviewDate('2026-13-01')).toBe(false);
    expect(isInterviewDate('1999-12-31')).toBe(false);
    expect(isInterviewDate('2101-01-01')).toBe(false);
    expect(isInterviewDate('28/10/2026')).toBe(false);
  });
});
