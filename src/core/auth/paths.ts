// The paths of the account pages. The routes (src/app/routes.tsx), the route guards and the
// screens use these constants.

/**
 * The signed-in home, where signing in leads. An account with the interview tools has the
 * applications instead (D85), and this address leads there; everyone else keeps the home.
 */
export const HOME_PATH = '/home';

/** "Your account": the personal details, and how the user signs in (D85). */
export const ACCOUNT_PATH = '/account';

export const SIGN_IN_PATH = '/sign-in';

/**
 * The "verify your email" page. It is also where the verification email sends the user back
 * to ("Continue" on the page that confirms the address), so the account backend has to know
 * it: the domain must be in the project's authorised domains.
 */
export const VERIFY_EMAIL_PATH = '/verify-email';

/** Shown when a signed-in user has no complete profile yet. */
export const COMPLETE_PROFILE_PATH = '/complete-profile';

/**
 * Where a signed-in user deletes the account. `/delete-account` is the public page that
 * explains how to do it (linked from the stores).
 */
export const DELETE_ACCOUNT_PATH = '/account/delete';
