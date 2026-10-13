/** The interview profile: its resources and the way into the skill map. */
export const PROFILE_PATH = '/profile';

/** One resource of the profile: where it is, what it added, and "Remove". */
export const RESOURCE_PATH = `${PROFILE_PATH}/resources/:resourceId`;

export const resourcePath = (resourceId: string) =>
  `${PROFILE_PATH}/resources/${encodeURIComponent(resourceId)}`;

/** The skill map: every item, to search and filter; with `itemId`, one item beside the list. */
export const SKILL_MAP_PATH = `${PROFILE_PATH}/skill-map`;
export const SKILL_MAP_ITEM_PATH = `${SKILL_MAP_PATH}/:itemId?`;

export const itemPath = (itemId: string) =>
  `${SKILL_MAP_PATH}/${encodeURIComponent(itemId)}`;
