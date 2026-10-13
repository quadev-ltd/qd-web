import { type ProfileGateway } from './gateway';
import { unavailableProfileGateway } from './unavailableProfileGateway';

/**
 * Chooses the profile gateway, in the one place that does, with the same rule and for the same
 * reason as src/core/auth/selectAuthGateway.ts: each condition is the literal expression,
 * in the same file as its import, so the bundler leaves out of a build the gateways that
 * build does not ask for (`yarn check:bundle` verifies it).
 *
 * - `preview`: the in-memory fake, loaded on demand.
 * - `firebase`, with the account screens on: the callables, the reads and the upload of
 *   src/core/firebase, loaded on demand by the first profile page. Signing in loads none
 *   of it.
 * - anything else: the unavailable gateway, at once.
 */
const chooseProfileGateway = (): ProfileGateway | Promise<ProfileGateway> => {
  // eslint-disable-next-line no-restricted-syntax -- see the comment above
  if (import.meta.env.VITE_AUTH_GATEWAY === 'preview') {
    return import('./previewProfileGateway').then(
      ({ createPreviewProfileGateway, exposePreviewProfileControls }) =>
        exposePreviewProfileControls(createPreviewProfileGateway()),
    );
  }
  if (
    // eslint-disable-next-line no-restricted-syntax -- see the comment above
    import.meta.env.VITE_ACCOUNT_ENABLED === 'true' &&
    // eslint-disable-next-line no-restricted-syntax -- see the comment above
    import.meta.env.VITE_AUTH_GATEWAY === 'firebase'
  ) {
    return import('@/core/firebase/profileGateway').then(
      ({ createFirebaseProfileGateway }) => createFirebaseProfileGateway(),
    );
  }
  return unavailableProfileGateway;
};

let selected: ProfileGateway | Promise<ProfileGateway> | undefined;

/**
 * The profile gateway of the page: chosen the first time it is asked for, and the same one
 * every time after. More than one place provides it (the profile's routes, the home's
 * starting card), and they must all talk to the same gateway.
 */
export const selectProfileGateway = ():
  ProfileGateway | Promise<ProfileGateway> => {
  selected ??= chooseProfileGateway();
  return selected;
};

/** Test helper: lets a test choose again after changing the environment. */
export const resetProfileGatewayForTests = () => {
  selected = undefined;
};

export default selectProfileGateway;
