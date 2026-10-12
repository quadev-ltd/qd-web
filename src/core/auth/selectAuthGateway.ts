import { type AuthGateway } from './gateway';
import { unavailableGateway } from './unavailableGateway';

/**
 * The one place that chooses the auth gateway, from VITE_AUTH_GATEWAY (validated as
 * env.AUTH_GATEWAY in src/core/env.ts).
 *
 * - `unavailable` (the default): returned at once.
 * - `preview`: the in-memory fake, loaded on demand.
 * - `firebase`: Firebase Authentication and Firestore (src/core/firebase), loaded on
 *   demand, and only when the account screens are on (VITE_ACCOUNT_ENABLED=true). With
 *   them off there is nothing to sign in to, so the unavailable gateway answers and the
 *   Firebase code is not part of the build. That is what makes VITE_ACCOUNT_ENABLED the one
 *   switch for production.
 *
 * This is the one exception to "only src/core/env.ts reads the environment": each condition
 * must be this literal expression, in the same file as the import. Vite replaces it with
 * the value at build time, the condition becomes `false` in every build that does not ask
 * for that gateway, and the bundler then leaves the code out of the bundle (a constant
 * imported from another file is not enough). `yarn check:bundle` verifies it.
 */
export const selectAuthGateway = (): AuthGateway | Promise<AuthGateway> => {
  // eslint-disable-next-line no-restricted-syntax -- see the comment above
  if (import.meta.env.VITE_AUTH_GATEWAY === 'preview') {
    return import('./previewGateway').then(({ createPreviewGateway }) =>
      createPreviewGateway(),
    );
  }
  if (
    // eslint-disable-next-line no-restricted-syntax -- see the comment above
    import.meta.env.VITE_ACCOUNT_ENABLED === 'true' &&
    // eslint-disable-next-line no-restricted-syntax -- see the comment above
    import.meta.env.VITE_AUTH_GATEWAY === 'firebase'
  ) {
    return import('@/core/firebase/gateway').then(({ createFirebaseGateway }) =>
      createFirebaseGateway(),
    );
  }
  return unavailableGateway;
};

export default selectAuthGateway;
