import { render } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';
import { Provider } from 'react-redux';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';

import { createRoutes } from '@/app/routes';
import { AuthGatewayProvider } from '@/core/auth/AuthGatewayProvider';
import { type AuthGateway } from '@/core/auth/gateway';
import { unavailableGateway } from '@/core/auth/unavailableGateway';
import {
  type ExitState,
  initialExitState,
} from '@/core/state/slices/exitSlice';
import {
  initialSessionState,
  type SessionState,
} from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';

interface Options {
  /** The URL the component is rendered at. */
  route?: string;
  /** Router state at that URL (what a <Link state> passes). */
  routeState?: unknown;
  /** The session the store starts with, on top of the initial one (Initializing). */
  session?: Partial<SessionState>;
  /** How the user left the signed-in pages, on top of the initial state (nothing). */
  exit?: Partial<ExitState>;
  /** The auth gateway the component calls. By default sign-in is unavailable. */
  gateway?: AuthGateway;
}

// Translations are mocked in vitest.setup.ts (t returns the key), so no i18n provider is
// needed here. There is no SessionProvider either: the session is what `session` says, and
// a spec that needs the real one renders it itself.

const createProviders = ({
  session,
  exit,
  gateway = unavailableGateway,
}: Options) => {
  const store = createStore({
    session: { ...initialSessionState, ...session },
    exit: { ...initialExitState, ...exit },
  });
  const Providers = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <AuthGatewayProvider gateway={gateway}>{children}</AuthGatewayProvider>
    </Provider>
  );
  return { store, Providers };
};

/** Renders a component or a screen inside the store, the auth gateway and a router. */
export const renderWithProviders = (
  ui: ReactElement,
  options: Options = {},
) => {
  const { route = '/', routeState } = options;
  const { store, Providers } = createProviders(options);
  return {
    store,
    ...render(
      <Providers>
        <MemoryRouter initialEntries={[{ pathname: route, state: routeState }]}>
          {ui}
        </MemoryRouter>
      </Providers>,
    ),
  };
};

/**
 * Renders the application's routes at a URL, to test which screen a path shows. The account
 * screens are loaded on demand, so this waits until the first screen is ready.
 */
export const renderRoute = async (route: string, options: Options = {}) => {
  const { store, Providers } = createProviders(options);
  const router = createMemoryRouter(createRoutes(), {
    initialEntries: [route],
  });
  if (!router.state.initialized) {
    await new Promise<void>(resolve => {
      const stop = router.subscribe(state => {
        if (state.initialized) {
          stop();
          resolve();
        }
      });
    });
  }
  return {
    store,
    router,
    ...render(
      <Providers>
        <RouterProvider router={router} />
      </Providers>,
    ),
  };
};

export default renderWithProviders;
