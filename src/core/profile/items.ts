import { type SkillMapItem } from './contract';

/**
 * The order of the items inside a list: the ones the candidate starred, then the newest
 * first. The backend gives no order (it would need an index of its own), so the pages sort.
 */
export const sortItems = (items: readonly SkillMapItem[]): SkillMapItem[] =>
  [...items].sort(
    (a, b) =>
      Number(b.starred) - Number(a.starred) ||
      (b.createdAt ?? 0) - (a.createdAt ?? 0) ||
      a.id.localeCompare(b.id),
  );

/** The items that came from one resource, in that order. */
export const itemsOfResource = (
  items: readonly SkillMapItem[],
  resourceId: string,
): SkillMapItem[] =>
  sortItems(items.filter(item => item.resourceId === resourceId));
