import { itemsOfResource, sortItems } from './items';

import { itemFixture } from '@/testUtil/profileFixtures';

describe('the order of the items', () => {
  it('puts the starred ones first, then the newest', () => {
    const items = [
      itemFixture({ id: 'old', createdAt: 1 }),
      itemFixture({ id: 'starred-old', createdAt: 2, starred: true }),
      itemFixture({ id: 'new', createdAt: 9 }),
      itemFixture({ id: 'starred-new', createdAt: 5, starred: true }),
    ];

    expect(sortItems(items).map(({ id }) => id)).toEqual([
      'starred-new',
      'starred-old',
      'new',
      'old',
    ]);
  });

  it('keeps an order that does not change between two reads: by id when all else is equal', () => {
    const items = [
      itemFixture({ id: 'b', createdAt: 5 }),
      itemFixture({ id: 'a', createdAt: 5 }),
      itemFixture({ id: 'c', createdAt: null }),
    ];

    expect(sortItems(items).map(({ id }) => id)).toEqual(['a', 'b', 'c']);
    expect(sortItems([...items].reverse()).map(({ id }) => id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('leaves the list it is given as it was', () => {
    const items = [
      itemFixture({ id: 'a', createdAt: 1 }),
      itemFixture({ id: 'b', createdAt: 2 }),
    ];

    sortItems(items);

    expect(items.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('gives the items of one resource, in that order', () => {
    const items = [
      itemFixture({ id: '1', resourceId: 'r1', createdAt: 1 }),
      itemFixture({ id: '2', resourceId: 'r2', createdAt: 2 }),
      itemFixture({ id: '3', resourceId: 'r1', createdAt: 3 }),
      itemFixture({ id: '4', resourceId: 'r1', createdAt: 0, starred: true }),
    ];

    expect(itemsOfResource(items, 'r1').map(({ id }) => id)).toEqual([
      '4',
      '3',
      '1',
    ]);
    expect(itemsOfResource(items, 'nope')).toEqual([]);
  });
});
