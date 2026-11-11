// Dictating a practice answer (D102, research doc 25 §4, doc 13 §31): up to 3 minutes recorded at a
// time, turned into text by the backend, and added where the cursor was in the answer, or at its
// end, with Undo. The page keeps the recording until the text comes back, and nothing else.

/** A dictation stops at 3 minutes and adds what was said, as a mock interview's answer does. */
export const DICTATION_MAX_MS = 180_000;
/** "30 seconds left", at 2:30. */
export const DICTATION_WARN_MS = 150_000;

/** The answer's selection when it was last left: where the words go. */
export interface DictationCursor {
  start: number;
  end: number;
}

export interface DictationInserted {
  /** The answer with the words in it. */
  text: string;
  /** Just after the words: where the next dictation goes. */
  cursor: number;
  /** "Added n words at the end": nothing but spaces follows them. */
  atEnd: boolean;
}

/**
 * Adds the words at the cursor (after a selection, which stays), or at the end when the answer was
 * never clicked. A space goes before them unless the answer is empty there or a space, a line or an
 * opening bracket is already there; one goes after them when a word follows.
 */
export const insertDictation = (
  text: string,
  words: string,
  cursor: DictationCursor | null,
): DictationInserted => {
  const at =
    cursor === null
      ? text.length
      : Math.min(Math.max(cursor.start, cursor.end, 0), text.length);
  const before = text.slice(0, at);
  const after = text.slice(at);
  const spaceBefore = before === '' || /[\s([{“‘]$/u.test(before) ? '' : ' ';
  const spaceAfter = /^[\p{L}\p{N}]/u.test(after) ? ' ' : '';
  return {
    text: `${before}${spaceBefore}${words}${spaceAfter}${after}`,
    cursor: at + spaceBefore.length + words.length,
    atEnd: after.trim() === '',
  };
};
