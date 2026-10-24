import { screen } from '@testing-library/react';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { renderRoute } from '@/testUtil/renderWithProviders';

const mockEnv = vi.hoisted(() => ({
  APPLICATION_NAME: 'web',
  APPLICATION_ENVIRONMENT: 'test',
  ACCOUNT_ENABLED: false,
  AUTH_GATEWAY: 'unavailable',
}));

vi.mock('@/core/env', () => ({ env: mockEnv }));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const signedOut = { session: { status: SessionStatus.SignedOut } };

describe('routes', () => {
  afterEach(() => {
    mockEnv.ACCOUNT_ENABLED = false;
  });

  it('shows the public home at /', async () => {
    await renderRoute('/');

    expect(
      screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
    ).toBeInTheDocument();
  });

  it('shows the privacy policy at /privacy-policy', async () => {
    await renderRoute('/privacy-policy');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeInTheDocument();
  });

  it('shows the terms and conditions at /terms-and-conditions', async () => {
    await renderRoute('/terms-and-conditions');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms and Conditions' }),
    ).toBeInTheDocument();
  });

  it('shows the delete-account information at /delete-account', async () => {
    await renderRoute('/delete-account');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'deleteAccountInfo.title',
      }),
    ).toBeInTheDocument();
  });

  it('shows the not found page for an unknown path', async () => {
    await renderRoute('/does-not-exist');

    expect(
      screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
    ).toBeInTheDocument();
  });

  describe('when the account flag is off (production)', () => {
    it.each([
      '/sign-in',
      '/sign-up',
      '/forgot-password',
      '/home',
      '/applications',
      '/account',
      '/verify-email',
      '/complete-profile',
      '/account/delete',
      '/profile',
      '/profile/resources/r1',
    ])('shows the not found page at %s', async path => {
      await renderRoute(path, signedOut);

      expect(
        screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
      ).toBeInTheDocument();
    });
  });

  describe('when the account flag is on', () => {
    beforeEach(() => {
      mockEnv.ACCOUNT_ENABLED = true;
    });

    it.each([
      ['/sign-in', 'signIn.title'],
      ['/sign-up', 'signUp.title'],
      ['/forgot-password', 'forgotPassword.title'],
    ])('shows the account screen at %s', async (path, heading) => {
      await renderRoute(path, signedOut);

      expect(
        screen.getByRole('heading', { level: 1, name: heading }),
      ).toBeInTheDocument();
    });

    it.each([
      '/home',
      '/applications',
      '/account',
      '/verify-email',
      '/complete-profile',
      '/account/delete',
      '/profile',
      '/profile/resources/r1',
    ])(
      'guards %s: a signed-out visitor is sent to the sign-in screen',
      async path => {
        const { router } = await renderRoute(path, signedOut);

        expect(
          await screen.findByRole('heading', {
            level: 1,
            name: 'signIn.title',
          }),
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/sign-in');
      },
    );

    describe('the profile, for a signed-in user', () => {
      const signedIn = {
        session: {
          status: SessionStatus.Ready,
          profile: { firstName: 'Maya', lastName: 'Okafor' },
        },
      };

      it('says "not available for your account yet" while the interview tools are off for the account', async () => {
        await renderRoute('/profile', signedIn);

        expect(
          await screen.findByText('access.notAvailableChip'),
        ).toBeInTheDocument();
        expect(
          screen.getByRole('heading', { level: 1, name: 'profile.title' }),
        ).toBeInTheDocument();
      });

      it('says the same at the address of a resource', async () => {
        await renderRoute('/profile/resources/r1', signedIn);

        expect(
          await screen.findByText('access.notAvailableChip'),
        ).toBeInTheDocument();
      });

      it('shows the profile when they are on', async () => {
        // A user, so the profile is read: here the gateway is the unavailable one, and the
        // page says it could not read it under its own heading.
        await renderRoute('/profile', {
          session: {
            ...signedIn.session,
            user: {
              uid: 'uid-1',
              email: 'maya@example.com',
              emailVerified: true,
              displayName: null,
              providerIds: ['password'],
            },
          },
          flags: { interviewAssistant: true },
        });

        expect(
          await screen.findByText('profile.description'),
        ).toBeInTheDocument();
        expect(
          screen.queryByText('access.notAvailableChip'),
        ).not.toBeInTheDocument();
      });
    });

    describe('where a signed-in user lands (D85, D91)', () => {
      const signedIn = {
        session: {
          status: SessionStatus.Ready,
          profile: { firstName: 'Maya', lastName: 'Okafor' },
        },
      };

      it('sends the home to the profile for an account with the interview tools', async () => {
        const { router } = await renderRoute('/home', {
          ...signedIn,
          flags: { interviewAssistant: true },
        });

        expect(
          await screen.findByRole('link', {
            name: 'profile.title',
            current: 'page',
          }),
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/profile');
      });

      it('sends the applications to the home for an account without them', async () => {
        const { router } = await renderRoute('/applications', signedIn);

        expect(
          await screen.findByRole('heading', {
            level: 1,
            name: 'home.welcomeTitle',
          }),
        ).toBeInTheDocument();
        expect(router.state.location.pathname).toBe('/home');
      });

      it('shows "Your account" at /account', async () => {
        await renderRoute('/account', signedIn);

        expect(
          await screen.findByRole('heading', {
            level: 1,
            name: 'home.accountTitle',
          }),
        ).toBeInTheDocument();
      });
    });

    it('still shows the public pages', async () => {
      await renderRoute('/privacy-policy', signedOut);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
      ).toBeInTheDocument();
    });
  });
});
