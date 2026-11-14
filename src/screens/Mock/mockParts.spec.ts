import { type TFunction } from 'i18next';

import { questionRange } from './mockParts';

/** The key with its values, to see which words a length gets. */
const t = ((key: string, values: object) =>
  `${key} ${JSON.stringify(values)}`) as unknown as TFunction;

describe('the questions a length plans, in words (D103)', () => {
  it('says "or" between two counts in a row, and "to" otherwise', () => {
    expect(questionRange(t, 5)).toBe('mock.questionsOr {"min":2,"max":3}');
    expect(questionRange(t, 10)).toBe('mock.questionsOr {"min":4,"max":5}');
    expect(questionRange(t, 20)).toBe('mock.questionsTo {"min":6,"max":8}');
    expect(questionRange(t, 25)).toBe('mock.questionsTo {"min":8,"max":10}');
  });
});
