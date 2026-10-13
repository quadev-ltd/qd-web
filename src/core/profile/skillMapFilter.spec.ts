import {
  filterIgnoringKind,
  filterItems,
  isFiltered,
  NO_FILTER,
} from './skillMapFilter';

import { itemFixture } from '@/testUtil/profileFixtures';

const items = [
  itemFixture({
    id: 'go',
    kind: 'skill',
    text: 'Go and PostgreSQL',
    createdAt: 1,
  }),
  itemFixture({
    id: 'incidents',
    kind: 'achievement',
    text: 'Cut payment incidents by 40%',
    starred: true,
    edited: true,
    createdAt: 2,
  }),
  itemFixture({
    id: 'mentor',
    kind: 'story',
    text: 'Mentored two engineers',
    resourceId: 'r2',
    createdAt: 3,
  }),
  itemFixture({
    id: 'left',
    kind: 'experience',
    text: 'Left Fenwick Pay after the reorganisation',
    hidden: true,
    createdAt: 4,
  }),
];
const ids = (list: { id: string }[]) => list.map(({ id }) => id);

describe('the skill map filter', () => {
  it('shows everything that is not hidden by default: starred first, then newest', () => {
    expect(ids(filterItems(items, NO_FILTER))).toEqual([
      'incidents',
      'mentor',
      'go',
    ]);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('shows the hidden items instead of the others when asked to', () => {
    const filter = { ...NO_FILTER, hidden: true };

    expect(ids(filterItems(items, filter))).toEqual(['left']);
    expect(isFiltered(filter)).toBe(true);
  });

  it.each([
    [{ kind: 'skill' as const }, ['go']],
    [{ starred: true }, ['incidents']],
    [{ edited: true }, ['incidents']],
    [{ resourceId: 'r2' }, ['mentor']],
    [{ query: 'postgres' }, ['go']],
    [{ query: '  PAYMENT ' }, ['incidents']],
    [{ query: 'kubernetes' }, []],
    [{ kind: 'story' as const, starred: true }, []],
    [
      { kind: 'achievement' as const, starred: true, query: 'cut' },
      ['incidents'],
    ],
  ])('narrows the list with %j', (part, expected) => {
    const filter = { ...NO_FILTER, ...part };

    expect(ids(filterItems(items, filter))).toEqual(expected);
    expect(isFiltered(filter)).toBe(true);
  });

  it('does not count a search of spaces as a filter', () => {
    expect(isFiltered({ ...NO_FILTER, query: '   ' })).toBe(false);
  });

  it('searches what an item says, not the passage it came from', () => {
    const withEvidence = [
      itemFixture({
        id: 'a',
        text: 'Go in production',
        evidence: 'kubernetes',
      }),
    ];

    expect(
      filterItems(withEvidence, { ...NO_FILTER, query: 'kubernetes' }),
    ).toEqual([]);
  });

  it('counts each kind with the rest of the filter applied, whatever kind is chosen', () => {
    const filter = { ...NO_FILTER, kind: 'skill' as const, query: 'en' };

    expect(ids(filterIgnoringKind(items, filter)).sort()).toEqual([
      'incidents',
      'mentor',
    ]);
  });
});
