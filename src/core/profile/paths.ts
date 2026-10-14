/** The interview profile: its resources and what was found in them. */
export const PROFILE_PATH = '/profile';

/** One resource of the profile: where it is, what was read from it, and "Remove". */
export const RESOURCE_PATH = `${PROFILE_PATH}/resources/:resourceId`;

export const resourcePath = (resourceId: string) =>
  `${PROFILE_PATH}/resources/${encodeURIComponent(resourceId)}`;
