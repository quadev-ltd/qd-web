import { screen, waitFor } from '@testing-library/react';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { renderRoute } from '@/testUtil/renderWithProviders';

vi.mock('@/core/env', () => ({
  env: {
    APPLICATION_NAME: 'web',
    APPLICATION_ENVIRONMENT: 'test',
    ACCOUNT_ENABLED: true,
    AUTH_GATEWAY: 'unavailable',
  },
}));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const AUTH_ROUTES = [
  ['/sign-in', 'signIn.title'],
  ['/sign-up', 'signUp.title'],
  ['/forgot-password', 'forgotPassword.title'],
];

describe('route guards', () => {
  describe('the sign-in routes', () => {
    it.each(AUTH_ROUTES)(
      'show %s to a signed-out visitor',
      async (path, heading) => {
        await renderRoute(path, {
          session: { status: SessionStatus.SignedOut },
        });

        expect(
          screen.getByRole('heading', { level: 1, name: heading }),
        ).toBeInTheDocument();
      },
    );

    it.each(AUTH_ROUTES)(
      'show a loading state at %s while the session is initializing',
      async (path, heading) => {
        await renderRoute(path, {
          session: { status: SessionStatus.Initializing },
        });

        expect(
          screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
        ).toBeInTheDocument();
        expect(
          screen.queryByRole('heading', { level: 1, name: heading }),
        ).not.toBeInTheDocument();
      },
    );

    it.each(AUTH_ROUTES)(
      'send a signed-in user from %s to the signed-in home',
      async (path, heading) => {
        const { router } = await renderRoute(path, {
          session: { status: SessionStatus.Ready },
        });

        await waitFor(() =>
          expect(router.state.location.pathname).toBe('/home'),
        );
        expect(
          screen.queryByRole('heading', { level: 1, name: heading }),
        ).not.toBeInTheDocument();
      },
    );

    // These two statuses get their own screens with the backend; until then such a
    // user is treated as not signed in.
    it.each([SessionStatus.NeedsEmailVerification, SessionStatus.NeedsProfile])(
      'show the sign-in screen while the session is %s',
      async status => {
        await renderRoute('/sign-in', { session: { status } });

        expect(
          screen.getByRole('heading', { level: 1, name: 'signIn.title' }),
        ).toBeInTheDocument();
      },
    );
  });

  describe('the public pages', () => {
    it.each([
      SessionStatus.Initializing,
      SessionStatus.SignedOut,
      SessionStatus.Ready,
    ])('show the public home whatever the session (%s)', async status => {
      await renderRoute('/', { session: { status } });

      expect(
        screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
      ).toBeInTheDocument();
    });
  });
});
