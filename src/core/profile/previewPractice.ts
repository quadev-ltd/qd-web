// What the preview gateway's fake writes when a question is practised (D94): key points from the
// first visible items of the profile, then advice, 3 to 5 in all, as the backend's offline
// `answer-guide` does. Test and preview only.
import { type SkillMapItem } from './contract';
import { type PracticeKeyPoint } from './practice';

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
