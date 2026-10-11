import { type AuthGateway } from './gateway';
import { unavailableGateway } from './unavailableGateway';

/**
 * The one place that chooses the auth gateway, from VITE_AUTH_GATEWAY (validated as
 * env.AUTH_GATEWAY in src/core/env.ts).
 *
 * - `unavailable` (the default, and production): returned at once.
 * - `preview`: the in-memory fake, loaded on demand.
 *
 * This is the one exception to "only src/core/env.ts reads the environment": the condition
 * must be this literal expression, in the same file as the import. Vite replaces it with
 * the value at build time, the condition becomes `false` in every build without
 * VITE_AUTH_GATEWAY=preview, and the bundler then leaves the fake out of the bundle
 * (a constant imported from another file is not enough). `yarn check:bundle` verifies it.
 */
export const selectAuthGateway = (): AuthGateway | Promise<AuthGateway> => {
  // eslint-disable-next-line no-restricted-syntax -- see the comment above
  if (import.meta.env.VITE_AUTH_GATEWAY === 'preview') {
    return import('./previewGateway').then(({ createPreviewGateway }) =>
      createPreviewGateway(),
    );
  }
  return unavailableGateway;
};

export default selectAuthGateway;
