// What the preview gateway's fake writes when a question is practised (D94): key points from the
// first visible items of the profile, then advice, 3 to 5 in all, as the backend's offline
// `answer-guide` does; and feedback on an answer from the key points its words share, as the
// offline `answer-feedback` does. Test and preview only.
import { type SkillMapItem } from './contract';
import {
  type PracticeFeedback,
  type PracticeKeyPoint,
  type PracticeTurn,
} from './practice';

const ADVICE = [
  'Say what you changed afterwards, not only how you fixed it.',
  'Start with what was at stake, in one sentence.',
  'Name your own part: what you decided, not only what the team did.',
];

/** Up to two of the profile's facts, the starred first, then advice: 3 to 5 points. */
export const previewKeyPointsFor = (
  items: SkillMapItem[],
): PracticeKeyPoint[] => {
  const facts = items
    .filter(({ hidden }) => !hidden)
    .sort((a, b) => Number(b.starred) - Number(a.starred))
    .slice(0, 2)
    .map(({ id, text }) => ({ text, itemId: id }));
  return [...facts, ...ADVICE.map(text => ({ text }))].slice(
    0,
    Math.max(3, facts.length + 1),
  );
};

/** The longer words of a text, lowercased: what an answer and a key point share. */
const wordsOf = (text: string) =>
  new Set(text.toLowerCase().match(/[a-z0-9%]{5,}/g) ?? []);

/** An answer shorter than this is "one line": nothing covered, and no example built from it. */
const ONE_LINE = 60;

/**
 * Feedback on an answer: the key points it shares a word with are covered, the others left out.
 * A one-line answer covers nothing and gets no example, so those sections are left out.
 */
export const previewFeedbackFor = (
  turn: Pick<PracticeTurn, 'keyPoints'>,
  answer: string,
): PracticeFeedback => {
  const said = wordsOf(answer);
  const short = answer.length < ONE_LINE;
  const covered = short
    ? []
    : turn.keyPoints.filter(({ text }) =>
        [...wordsOf(text)].some(word => said.has(word)),
      );
  const missing = turn.keyPoints.filter(point => !covered.includes(point));
  const sentences = answer.split(/(?<=[.!?])\s+/).filter(Boolean);
  const seconds = Math.max(5, Math.round(answer.split(/\s+/).length / 2.5));
  return {
    covered: covered.map(({ text }) => `You covered it: ${text}`),
    missing: missing.map(({ text }) => text),
    structure:
      sentences.length >= 3
        ? 'Situation, action and result are there, in order. Say in one line what your own part was.'
        : 'Give the situation, what you did, and the result, in that order.',
    clarity: `About ${seconds} seconds when spoken. Each sentence moves the story on.`,
    suggestions: [
      'Start with what was at stake, in one sentence.',
      'End with what changed afterwards.',
    ],
    ...(short
      ? {}
      : {
          example: [
            sentences[0],
            ...missing
              .filter(({ itemId }) => itemId)
              .map(
                ({ text }) =>
                  `I also ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
              ),
          ].join(' '),
        }),
  };
};
