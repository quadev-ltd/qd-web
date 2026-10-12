// Which sign-in providers the website offers next to email and password.

/**
 * Apple sign-in on a website needs a Services ID and a verified domain in the Apple
 * Developer account, which are not set up yet. Until then the button is not shown; the app
 * keeps its own Apple sign-in. The gateways keep `signInWithApple`, so turning this on is
 * the only change the screens need.
 */
export const APPLE_SIGN_IN_ENABLED: boolean = false;
