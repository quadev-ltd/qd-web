import { diffLines } from './diffLines';

const EARLIER = [
  'Maya Okafor',
  '- Built reconciliation service, approx. 2M/day.',
  '- Responsible for various API tasks.',
  'Education',
].join('\n');
const LATER = [
  'Maya Okafor',
  '- Built the reconciliation service for two million card transactions a day.',
  '- Mentored two junior engineers.',
  'Education',
].join('\n');

describe('diffLines', () => {
  it('keeps what both say, pairs a line changed, and says what was added or removed', () => {
    expect(diffLines(EARLIER, LATER)).toEqual([
      { kind: 'same', earlier: 'Maya Okafor', later: 'Maya Okafor' },
      {
        kind: 'changed',
        earlier: '- Built reconciliation service, approx. 2M/day.',
        later:
          '- Built the reconciliation service for two million card transactions a day.',
      },
      {
        kind: 'changed',
        earlier: '- Responsible for various API tasks.',
        later: '- Mentored two junior engineers.',
      },
      { kind: 'same', earlier: 'Education', later: 'Education' },
    ]);
  });

  it('says a line only added, or only removed', () => {
    expect(diffLines('A\nB', 'A\nB\nC')).toEqual([
      { kind: 'same', earlier: 'A', later: 'A' },
      { kind: 'same', earlier: 'B', later: 'B' },
      { kind: 'added', later: 'C' },
    ]);
    expect(diffLines('A\nB\nC', 'A\nC')).toEqual([
      { kind: 'same', earlier: 'A', later: 'A' },
      { kind: 'removed', earlier: 'B' },
      { kind: 'same', earlier: 'C', later: 'C' },
    ]);
  });

  it('finds no difference in two equal texts, empty lines aside', () => {
    expect(
      diffLines('A\n\nB', 'A\nB').every(({ kind }) => kind === 'same'),
    ).toBe(true);
  });
});
