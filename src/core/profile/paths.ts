/**
 * The interview profile: its resources. The first page after signing in for an account with the
 * interview tools (D91).
 */
export const PROFILE_PATH = '/profile';

/** One resource of the profile: where it is, what was read from it, and "Remove". */
export const RESOURCE_PATH = `${PROFILE_PATH}/resources/:resourceId`;

export const resourcePath = (resourceId: string) =>
  `${PROFILE_PATH}/resources/${encodeURIComponent(resourceId)}`;

/** The job applications (delivery 2a): their list. */
export const APPLICATIONS_PATH = '/applications';

export const APPLICATIONS_PREFIX = `${APPLICATIONS_PATH}/`;

/** One job application: its details, and later its brief. */
export const APPLICATION_PATH = `${APPLICATIONS_PREFIX}:applicationId`;

export const applicationPath = (applicationId: string) =>
  `${APPLICATIONS_PREFIX}${encodeURIComponent(applicationId)}`;

/** The details of an application: what it is, the job, "Edit" and "Remove". */
export const APPLICATION_DETAILS_PATH = `${APPLICATION_PATH}/details`;

export const applicationDetailsPath = (applicationId: string) =>
  `${applicationPath(applicationId)}/details`;

/** The CV section (delivery 2b): the versions of the candidate's CVs. */
export const CV_PATH = '/cv';

/** The CV section with "Your CV details" open over it: the account page links here (D85). */
export const CV_DETAILS_PATH = `${CV_PATH}/details`;

/** One CV version: being made, could not be made, or made, with what it changes. */
export const CV_VERSION_PATH = `${CV_PATH}/versions/:versionId`;

export const cvVersionPath = (versionId: string) =>
  `${CV_PATH}/versions/${encodeURIComponent(versionId)}`;

/** Two versions side by side, with what differs, and "Restore" for the earlier one. */
export const CV_COMPARE_PATH = `${CV_PATH}/compare`;

export const cvComparePath = (later: string, earlier?: string) =>
  `${CV_COMPARE_PATH}?${new URLSearchParams({
    later,
    ...(earlier ? { earlier } : {}),
  }).toString()}`;

/** The CV versions of one application (A6): the one sent, the others, a new one. */
export const APPLICATION_CV_PATH = `${APPLICATION_PATH}/cv`;

export const applicationCvPath = (applicationId: string) =>
  `${applicationPath(applicationId)}/cv`;
