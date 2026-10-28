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

/** The interviews of an application (D89): coming up and past, and "Add an interview". */
export const APPLICATION_INTERVIEWS_PATH = `${APPLICATION_PATH}/interviews`;

export const applicationInterviewsPath = (applicationId: string) =>
  `${applicationPath(applicationId)}/interviews`;

/** One interview of an application: when it is, what the candidate knows, "Edit" and "Remove". */
export const APPLICATION_INTERVIEW_PATH = `${APPLICATION_INTERVIEWS_PATH}/:interviewId`;

export const applicationInterviewPath = (
  applicationId: string,
  interviewId: string,
) =>
  `${applicationInterviewsPath(applicationId)}/${encodeURIComponent(interviewId)}`;

/**
 * A question practised (X7, D94), opened from an interview's likely questions or its own
 * question: under the interview, so the way back leads there (D96).
 */
export const APPLICATION_INTERVIEW_PRACTICE_PATH = `${APPLICATION_INTERVIEW_PATH}/practice/:turnId`;

export const applicationInterviewPracticePath = (
  applicationId: string,
  interviewId: string,
  turnId: string,
) =>
  `${applicationInterviewPath(applicationId, interviewId)}/practice/${encodeURIComponent(turnId)}`;

/** A question of the brief practised (X7, D94): under the application, back to its brief. */
export const APPLICATION_PRACTICE_PATH = `${APPLICATION_PATH}/practice/:turnId`;

export const applicationPracticePath = (
  applicationId: string,
  turnId: string,
) => `${applicationPath(applicationId)}/practice/${encodeURIComponent(turnId)}`;

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

/**
 * A CV version opened from its application's CV tab (D96): the same page as `/cv/versions/:id`,
 * under the application, so the way back leads to that tab and the bar shows Applications.
 */
export const APPLICATION_CV_VERSION_PATH = `${APPLICATION_CV_PATH}/versions/:versionId`;

export const applicationCvVersionPath = (
  applicationId: string,
  versionId: string,
) =>
  `${applicationCvPath(applicationId)}/versions/${encodeURIComponent(versionId)}`;

/** Two versions compared, from an application's CV tab (D96). */
export const APPLICATION_CV_COMPARE_PATH = `${APPLICATION_CV_PATH}/compare`;

export const applicationCvComparePath = (
  applicationId: string,
  later: string,
  earlier?: string,
) =>
  `${applicationCvPath(applicationId)}/compare?${new URLSearchParams({
    later,
    ...(earlier ? { earlier } : {}),
  }).toString()}`;
