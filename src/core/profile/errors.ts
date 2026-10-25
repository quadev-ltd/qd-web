import logger from '@/core/logger';

/**
 * Why a call to the profile gateway failed, in the words of the screens. The gateways turn
 * what their backend says (a callable error, a Storage error) into one of these, so no
 * screen reads a Firebase error.
 */
export const ProfileErrorCode = {
  /** The interview tools are not on for this account (the `interviewAssistant` flag). */
  FlagOff: 'profile/flag-off',
  /** Today's limit of resources read was reached. */
  DailyLimit: 'profile/daily-limit',
  /** The profile already holds as many resources as it can. */
  MaxResources: 'profile/max-resources',
  /** The account already holds as many applications as it can. */
  MaxApplications: 'profile/max-applications',
  /** The application already holds as many interviews as it can (D89). */
  MaxInterviews: 'profile/max-interviews',
  /** The account already holds as many CV versions as it can. */
  MaxCvVersions: 'profile/max-cv-versions',
  /** The CV has no text kept yet, so no version can start from it. */
  NoCvText: 'profile/no-cv-text',
  /** The profile has no visible item, so no CV can be written from it. */
  NoItems: 'profile/no-items',
  /** The resource or the item does not exist (any more). */
  NotFound: 'profile/not-found',
  /** It is being read (the first time, or its page again), so it cannot change or start again. */
  Reading: 'profile/reading',
  /** Reading the posting again would replace the job's text that the candidate edited. */
  JobEdited: 'profile/job-edited',
  /** The backend did not accept the request as it was sent. */
  Invalid: 'profile/invalid',
  /** Nobody is signed in, or the page could not prove where it comes from (App Check). */
  SignedOut: 'profile/signed-out',
  /** The backend could not be reached, or did not answer in time. */
  Network: 'profile/network',
  /** The file store refused the file: its type, its size, or a second upload. */
  UploadRefused: 'profile/upload-refused',
  /** The upload was stopped by the user. */
  UploadCancelled: 'profile/upload-cancelled',
  /** No backend is connected (the default gateway). */
  Unavailable: 'profile/unavailable',
  /** Anything else. */
  Unknown: 'profile/unknown',
} as const;

export type ProfileErrorCode =
  (typeof ProfileErrorCode)[keyof typeof ProfileErrorCode];

/** Thrown by every profile gateway. */
export class ProfileError extends Error {
  constructor(public readonly code: ProfileErrorCode) {
    super(code);
    this.name = 'ProfileError';
  }
}

/** The code of a profile error; anything else is "unknown". */
export const getProfileErrorCode = (error: unknown): ProfileErrorCode =>
  error instanceof ProfileError ? error.code : ProfileErrorCode.Unknown;

/** Refusals that are part of normal use, not faults: logged as messages, not as errors. */
const EXPECTED_CODES: ReadonlySet<string> = new Set([
  ProfileErrorCode.FlagOff,
  ProfileErrorCode.DailyLimit,
  ProfileErrorCode.MaxResources,
  ProfileErrorCode.MaxApplications,
  ProfileErrorCode.MaxInterviews,
  ProfileErrorCode.MaxCvVersions,
  ProfileErrorCode.NoCvText,
  ProfileErrorCode.NoItems,
  ProfileErrorCode.NotFound,
  ProfileErrorCode.Reading,
  ProfileErrorCode.JobEdited,
  ProfileErrorCode.Network,
  ProfileErrorCode.UploadCancelled,
  ProfileErrorCode.Unavailable,
]);

/**
 * Logs a failure without anything about the candidate: the operation, the error code and
 * the uid. Never pass a title, an address, the text of an item or a raw error here.
 */
export const logProfileError = (
  operation: string,
  error: unknown,
  uid?: string | null,
) => {
  const code = getProfileErrorCode(error);
  const message = `${operation} failed: code=${code}${uid ? ` uid=${uid}` : ''}`;
  if (EXPECTED_CODES.has(code)) {
    logger().logMessage(message);
  } else {
    logger().logError(new Error(message));
  }
};
