import { type SkillMapItem, type SkillMapKind } from './contract';
import { sortItems } from './items';

/** What the skill map shows: every part narrows the list further. */
export interface SkillMapFilter {
  /** Part of the text of an item, in any case. */
  query: string;
  kind: SkillMapKind | 'all';
  /** Only the items that came from this resource. */
  resourceId: string | 'all';
  starred: boolean;
  edited: boolean;
  /**
   * The hidden items instead of the others. A hidden item is one the candidate never wants
   * used, so it is out of every other view.
   */
  hidden: boolean;
}

export const NO_FILTER: SkillMapFilter = {
  query: '',
  kind: 'all',
  resourceId: 'all',
  starred: false,
  edited: false,
  hidden: false,
};

/** Whether anything narrows the list beyond "everything that is not hidden". */
export const isFiltered = (filter: SkillMapFilter): boolean =>
  filter.query.trim() !== '' ||
  filter.kind !== 'all' ||
  filter.resourceId !== 'all' ||
  filter.starred ||
  filter.edited ||
  filter.hidden;

/** The items a filter leaves, whatever their kind: for the counts next to each kind. */
export const filterIgnoringKind = (
  items: readonly SkillMapItem[],
  filter: SkillMapFilter,
): SkillMapItem[] => {
  const query = filter.query.trim().toLowerCase();
  return items.filter(
    item =>
      item.hidden === filter.hidden &&
      (!filter.starred || item.starred) &&
      (!filter.edited || item.edited) &&
      (filter.resourceId === 'all' || item.resourceId === filter.resourceId) &&
      (query === '' || item.text.toLowerCase().includes(query)),
  );
};

/** The items a filter leaves, in the order of the lists: starred first, then newest. */
export const filterItems = (
  items: readonly SkillMapItem[],
  filter: SkillMapFilter,
): SkillMapItem[] =>
  sortItems(
    filterIgnoringKind(items, filter).filter(
      item => filter.kind === 'all' || item.kind === filter.kind,
    ),
  );
