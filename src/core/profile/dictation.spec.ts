import { insertDictation } from './dictation';

const WORDS = 'I kept support updated.';

describe('where dictated words go (D102, doc 13 §31.1)', () => {
  it('at the end when the answer was never clicked, after a space', () => {
    expect(insertDictation('We rolled it back.', WORDS, null)).toEqual({
      text: 'We rolled it back. I kept support updated.',
      cursor: 42,
      atEnd: true,
    });
  });

  it('as the whole answer when it is empty', () => {
    expect(insertDictation('', WORDS, null)).toEqual({
      text: WORDS,
      cursor: WORDS.length,
      atEnd: true,
    });
  });

  it('at the cursor, with a space on each side when words are there', () => {
    const text = 'We rolled it back. Afterwards I wrote the review.';
    const cursor = { start: 19, end: 19 };
    expect(insertDictation(text, WORDS, cursor)).toEqual({
      text: 'We rolled it back. I kept support updated. Afterwards I wrote the review.',
      cursor: 19 + WORDS.length,
      atEnd: false,
    });
  });

  it('adds no space where one, a new line or an opening bracket is already there', () => {
    expect(insertDictation('First.\n', WORDS, null).text).toBe(
      `First.\n${WORDS}`,
    );
    expect(
      insertDictation('A note (', 'said aloud', { start: 8, end: 8 }).text,
    ).toBe('A note (said aloud');
    expect(insertDictation('Ends here ', WORDS, null).text).toBe(
      `Ends here ${WORDS}`,
    );
  });

  it('adds no space before punctuation that follows', () => {
    expect(
      insertDictation('We rolled it back.', 'within 40 minutes', {
        start: 17,
        end: 17,
      }).text,
    ).toBe('We rolled it back within 40 minutes.');
  });

  it('goes after a selection, which stays, and counts spaces only as the end', () => {
    expect(
      insertDictation('one two three', 'and a half', { start: 4, end: 7 }),
    ).toEqual({
      text: 'one two and a half three',
      cursor: 18,
      atEnd: false,
    });
    expect(insertDictation('Done.  ', WORDS, { start: 5, end: 5 }).atEnd).toBe(
      true,
    );
  });

  it('keeps a cursor past the end at the end', () => {
    expect(insertDictation('Short.', WORDS, { start: 40, end: 40 }).text).toBe(
      `Short. ${WORDS}`,
    );
  });
});
