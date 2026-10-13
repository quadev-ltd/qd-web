import { type ProfileGateway } from './gateway';
import { unavailableProfileGateway } from './unavailableProfileGateway';

/**
 * The one place that chooses the profile gateway, with the same rule and for the same
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
export const selectProfileGateway = ():
  ProfileGateway | Promise<ProfileGateway> => {
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

export default selectProfileGateway;
