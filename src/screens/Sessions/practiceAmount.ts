// How much practice a job holds, in words (D99, D100): "1 mock interview and 1 question", or the
// questions first where the screens put them so ("3 questions and 1 mock interview").
import { type TFunction } from 'i18next';

export const practiceAmount = (
  t: TFunction,
  questions: number,
  mockInterviews: number,
  order: 'mock-first' | 'questions-first' = 'mock-first',
): string => {
  const mock =
    mockInterviews > 0
      ? t('sessions.mockInterviews', { count: mockInterviews })
      : null;
  const asked =
    questions > 0 || !mock
      ? t('sessions.questions', { count: questions })
      : null;
  const parts = order === 'mock-first' ? [mock, asked] : [asked, mock];
  const [first, second] = parts.filter((part): part is string => Boolean(part));
  return second ? t('sessions.and', { first, second }) : (first ?? '');
};
