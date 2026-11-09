import { type TFunction } from 'i18next';

import { practiceAmount } from './practiceAmount';

/** The keys with their counts, as the English text would read them. */
const t = ((
  key: string,
  options: { count?: number; first?: string; second?: string },
) => {
  if (key === 'sessions.and') {
    return `${options.first} and ${options.second}`;
  }
  const noun =
    key === 'sessions.mockInterviews' ? 'mock interview' : 'question';
  return `${options.count} ${noun}${options.count === 1 ? '' : 's'}`;
}) as unknown as TFunction;

describe('how much practice a job holds (D99, D100)', () => {
  it('names the mock interviews first, or the questions first where the screen does', () => {
    expect(practiceAmount(t, 1, 1)).toBe('1 mock interview and 1 question');
    expect(practiceAmount(t, 3, 1, 'questions-first')).toBe(
      '3 questions and 1 mock interview',
    );
  });

  it('leaves out what there is none of, and still counts questions without either', () => {
    expect(practiceAmount(t, 0, 2)).toBe('2 mock interviews');
    expect(practiceAmount(t, 3, 0)).toBe('3 questions');
    expect(practiceAmount(t, 0, 0)).toBe('0 questions');
  });
});
