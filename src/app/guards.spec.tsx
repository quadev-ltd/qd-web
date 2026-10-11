import { act, screen } from '@testing-library/react';

import { type SessionUser } from '@/core/auth/types';
import {
  authStateChanged,
  SessionStatus,
} from '@/core/state/slices/sessionSlice';
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
];

const user: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
};

const ready = {
  status: SessionStatus.Ready,
  authResolved: true,
  user,
  profile: { firstName: 'Ada', lastName: 'Lovelace' },
  profileStatus: 'loaded' as const,
};

const homeHeading = () =>
  screen.findByRole('heading', { level: 1, name: 'home.welcomeTitle' });

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
        const { router } = await renderRoute(path, { session: ready });

        expect(await homeHeading()).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/home');
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

  describe('the signed-in home', () => {
    it('shows the home to a signed-in user', async () => {
      await renderRoute('/home', { session: ready });

      expect(await homeHeading()).toBeInTheDocument();
    });

    it('shows a loading state while the session is initializing', async () => {
      await renderRoute('/home', {
        session: { status: SessionStatus.Initializing },
      });

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 1, name: 'home.welcomeTitle' }),
      ).not.toBeInTheDocument();
    });

    it.each([
      SessionStatus.SignedOut,
      SessionStatus.NeedsEmailVerification,
      SessionStatus.NeedsProfile,
    ])(
      'sends a visitor whose session is %s to the sign-in screen',
      async status => {
        const { router } = await renderRoute('/home', { session: { status } });

        expect(
          await screen.findByRole('heading', {
            level: 1,
            name: 'signIn.title',
          }),
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/sign-in');
      },
    );

    it('goes to the public home, not to the sign-in screen, when the user signs out', async () => {
      const { router, store } = await renderRoute('/home', { session: ready });
      expect(await homeHeading()).toBeInTheDocument();

      act(() => {
        store.dispatch(authStateChanged(null));
      });

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'publicHome.title',
        }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
    });
  });

  describe('the forgot-password screen', () => {
    it.each([
      SessionStatus.Initializing,
      SessionStatus.SignedOut,
      SessionStatus.Ready,
    ])('is shown whatever the session (%s)', async status => {
      await renderRoute('/forgot-password', {
        session: status === SessionStatus.Ready ? ready : { status },
      });

      expect(
        screen.getByRole('heading', { level: 1, name: 'forgotPassword.title' }),
      ).toBeInTheDocument();
    });
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
