/** The interview profile: its resources and the way into the skill map. */
export const PROFILE_PATH = '/profile';

/** One resource of the profile: where it is, what it added, and "Remove". */
export const RESOURCE_PATH = `${PROFILE_PATH}/resources/:resourceId`;

export const resourcePath = (resourceId: string) =>
  `${PROFILE_PATH}/resources/${encodeURIComponent(resourceId)}`;
