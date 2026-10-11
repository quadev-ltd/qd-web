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
    it.each(['/sign-in', '/sign-up', '/forgot-password', '/home'])(
      'shows the not found page at %s',
      async path => {
        await renderRoute(path, signedOut);

        expect(
          screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
        ).toBeInTheDocument();
      },
    );
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

    // The signed-in home arrives with the next change.
    it('shows the not found page at /home for now', async () => {
      await renderRoute('/home', signedOut);

      expect(
        screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
      ).toBeInTheDocument();
    });

    it('still shows the public pages', async () => {
      await renderRoute('/privacy-policy', signedOut);

      expect(
        screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
      ).toBeInTheDocument();
    });
  });
});
