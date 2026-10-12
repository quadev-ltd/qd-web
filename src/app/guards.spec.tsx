import { act, screen } from '@testing-library/react';

import { type SessionUser } from '@/core/auth/types';
import {
  accountDeleted,
  signedOutPathChosen,
} from '@/core/state/slices/exitSlice';
import {
  authStateChanged,
  profileLoaded,
  SessionStatus,
} from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
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

// A gateway that knows how each account confirms a deletion (the default one, "not available
// yet", knows no way, and the delete-account page would say so instead of asking).
const renderAt = (
  path: string,
  options: Omit<Parameters<typeof renderRoute>[1], 'gateway'> = {},
) => renderRoute(path, { ...options, gateway: createMockGateway() });

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

/** Signed up with an email that is not verified yet. */
const unverified = {
  ...ready,
  status: SessionStatus.NeedsEmailVerification,
  user: { ...user, emailVerified: false },
};

/** Signed in, without a profile document. */
const withoutProfile = {
  ...ready,
  status: SessionStatus.NeedsProfile,
  profile: null,
  profileStatus: 'missing' as const,
};

const SESSIONS = {
  [SessionStatus.Initializing]: { status: SessionStatus.Initializing },
  [SessionStatus.SignedOut]: { status: SessionStatus.SignedOut },
  [SessionStatus.NeedsEmailVerification]: unverified,
  [SessionStatus.NeedsProfile]: withoutProfile,
  [SessionStatus.Ready]: ready,
};

/** Each page that belongs to one session status, and its heading. */
const PAGES = {
  '/sign-in': 'signIn.title',
  '/verify-email': /^emailVerification\.title/,
  '/complete-profile': 'completeProfile.title',
  '/home': 'home.welcomeTitle',
  '/account/delete': 'deleteAccount.title',
  '/': 'publicHome.title',
} as const;

const headingOf = (path: keyof typeof PAGES) =>
  screen.findByRole('heading', { level: 1, name: PAGES[path] });

const homeHeading = () => headingOf('/home');

describe('route guards', () => {
  describe('the sign-in routes', () => {
    it.each(AUTH_ROUTES)(
      'show %s to a signed-out visitor',
      async (path, heading) => {
        await renderAt(path, {
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
        await renderAt(path, {
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
        const { router } = await renderAt(path, { session: ready });

        expect(await homeHeading()).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/home');
        expect(
          screen.queryByRole('heading', { level: 1, name: heading }),
        ).not.toBeInTheDocument();
      },
    );

    it.each(AUTH_ROUTES)(
      'send a user whose email is not verified from %s to the verify-email screen',
      async path => {
        const { router } = await renderAt(path, { session: unverified });

        expect(await headingOf('/verify-email')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/verify-email');
      },
    );

    it.each(AUTH_ROUTES)(
      'send a user without a profile from %s to the complete-profile screen',
      async path => {
        const { router } = await renderAt(path, { session: withoutProfile });

        expect(await headingOf('/complete-profile')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/complete-profile');
      },
    );

    // What the sign-up form relies on: the new account is signed in and unverified, and
    // the session, not the form, leads to the next screen.
    it('leave the sign-up screen for the verify-email screen as soon as the account exists', async () => {
      const { router, store } = await renderAt('/sign-up', {
        session: { status: SessionStatus.SignedOut, authResolved: true },
      });

      act(() => {
        store.dispatch(authStateChanged(unverified.user));
      });

      expect(await headingOf('/verify-email')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/verify-email');
    });
  });

  describe.each([
    ['/home', SessionStatus.Ready],
    ['/account/delete', SessionStatus.Ready],
    ['/verify-email', SessionStatus.NeedsEmailVerification],
    ['/complete-profile', SessionStatus.NeedsProfile],
  ] as const)('%s', (path, own) => {
    const others = (
      [
        [SessionStatus.NeedsEmailVerification, '/verify-email'],
        [SessionStatus.NeedsProfile, '/complete-profile'],
        [SessionStatus.Ready, '/home'],
      ] as const
    ).filter(([status]) => status !== own);

    it(`is shown to a user whose session is ${own}`, async () => {
      const { router } = await renderAt(path, { session: SESSIONS[own] });

      expect(await headingOf(path)).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
    });

    it('shows a loading state while the session is initializing', async () => {
      await renderAt(path, {
        session: { status: SessionStatus.Initializing },
      });

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('sends a visitor who is not signed in to the sign-in screen', async () => {
      const { router } = await renderAt(path, {
        session: SESSIONS[SessionStatus.SignedOut],
      });

      expect(await headingOf('/sign-in')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/sign-in');
    });

    it.each(others)(
      'sends a user whose session is %s to %s',
      async (status, destination) => {
        const { router } = await renderAt(path, {
          session: SESSIONS[status],
        });

        expect(await headingOf(destination)).toBeInTheDocument();
        expect(router.state.location.pathname).toBe(destination);
      },
    );

    it('goes to the public home, not to the sign-in screen, when the user signs out', async () => {
      const { router, store } = await renderAt(path, {
        session: SESSIONS[own],
      });
      expect(await headingOf(path)).toBeInTheDocument();

      act(() => {
        store.dispatch(authStateChanged(null));
      });

      expect(await headingOf('/')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
    });

    it('goes where the page chose when the user signs out', async () => {
      const { router, store } = await renderAt(path, {
        session: SESSIONS[own],
      });
      expect(await headingOf(path)).toBeInTheDocument();

      act(() => {
        store.dispatch(signedOutPathChosen('/sign-in'));
        store.dispatch(authStateChanged(null));
      });

      expect(await headingOf('/sign-in')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/sign-in');
    });
  });

  describe('moving on', () => {
    it('leaves the verify-email screen for the home once the email is verified', async () => {
      const { router, store } = await renderAt('/verify-email', {
        session: unverified,
      });
      expect(await headingOf('/verify-email')).toBeInTheDocument();

      act(() => {
        store.dispatch(authStateChanged(user));
      });

      expect(await homeHeading()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/home');
    });

    it('leaves the complete-profile screen for the home once the profile is saved', async () => {
      const { router, store } = await renderAt('/complete-profile', {
        session: withoutProfile,
      });
      expect(await headingOf('/complete-profile')).toBeInTheDocument();

      act(() => {
        store.dispatch(profileLoaded(ready.profile));
      });

      expect(await homeHeading()).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/home');
    });
  });

  describe('after the account was deleted', () => {
    const notice = () => screen.queryByText('deleteAccount.successTitle');

    it.each([
      ['the session ends first', [authStateChanged(null), accountDeleted()]],
      ['the notice comes first', [accountDeleted(), authStateChanged(null)]],
    ])(
      'says so on the public home, whether %s',
      async (_order, [first, second]) => {
        const { router, store } = await renderAt('/account/delete', {
          session: ready,
        });
        expect(await headingOf('/account/delete')).toBeInTheDocument();

        act(() => {
          store.dispatch(first);
        });
        act(() => {
          store.dispatch(second);
        });

        expect(await headingOf('/')).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/');
        expect(notice()).toBeInTheDocument();
        expect(screen.getByText('deleteAccount.successMessage')).toBeVisible();
      },
    );

    it('moves the focus to the notice, so it is read out', async () => {
      await renderAt('/', {
        session: SESSIONS[SessionStatus.SignedOut],
        exit: { accountDeleted: true },
      });

      expect(screen.getByRole('status')).toHaveFocus();
    });

    it('forgets the notice when the user opens another page', async () => {
      const { router, store } = await renderAt('/', {
        session: SESSIONS[SessionStatus.SignedOut],
        exit: { accountDeleted: true },
      });
      expect(notice()).toBeInTheDocument();

      await act(() => router.navigate('/privacy-policy'));

      expect(store.getState().exit.accountDeleted).toBe(false);
      await act(() => router.navigate('/'));
      expect(await headingOf('/')).toBeInTheDocument();
      expect(notice()).not.toBeInTheDocument();
    });

    it('says nothing on the public home otherwise', async () => {
      await renderAt('/', { session: SESSIONS[SessionStatus.SignedOut] });

      expect(notice()).not.toBeInTheDocument();
    });
  });

  describe('the forgot-password screen', () => {
    it.each([
      SessionStatus.Initializing,
      SessionStatus.SignedOut,
      SessionStatus.NeedsEmailVerification,
      SessionStatus.NeedsProfile,
      SessionStatus.Ready,
    ])('is shown whatever the session (%s)', async status => {
      await renderAt('/forgot-password', { session: SESSIONS[status] });

      expect(
        screen.getByRole('heading', { level: 1, name: 'forgotPassword.title' }),
      ).toBeInTheDocument();
    });
  });

  describe('the public pages', () => {
    it.each([
      SessionStatus.Initializing,
      SessionStatus.SignedOut,
      SessionStatus.NeedsEmailVerification,
      SessionStatus.NeedsProfile,
      SessionStatus.Ready,
    ])('show the public home whatever the session (%s)', async status => {
      await renderAt('/', { session: SESSIONS[status] });

      expect(
        screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
      ).toBeInTheDocument();
    });
  });
});
