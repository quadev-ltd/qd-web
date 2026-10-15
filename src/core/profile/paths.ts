/** The interview profile: its resources and what was found in them. */
export const PROFILE_PATH = '/profile';

/** One resource of the profile: where it is, what was read from it, and "Remove". */
export const RESOURCE_PATH = `${PROFILE_PATH}/resources/:resourceId`;

export const resourcePath = (resourceId: string) =>
  `${PROFILE_PATH}/resources/${encodeURIComponent(resourceId)}`;

/** The job applications (delivery 2a). Their list is the signed-in home. */
export const APPLICATIONS_PREFIX = '/applications/';

/** One job application: its details, and later its brief. */
export const APPLICATION_PATH = `${APPLICATIONS_PREFIX}:applicationId`;

export const applicationPath = (applicationId: string) =>
  `${APPLICATIONS_PREFIX}${encodeURIComponent(applicationId)}`;

/** The details of an application: what it is, the job, "Edit" and "Remove". */
export const APPLICATION_DETAILS_PATH = `${APPLICATION_PATH}/details`;

export const applicationDetailsPath = (applicationId: string) =>
  `${applicationPath(applicationId)}/details`;
