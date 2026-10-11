import { screen } from '@testing-library/react';

import { renderRoute } from '@/testUtil/renderWithProviders';

vi.mock('@/core/env', () => ({
  env: {
    APPLICATION_NAME: 'web',
    APPLICATION_ENVIRONMENT: 'test',
    ACCOUNT_ENABLED: false,
  },
}));

describe('routes', () => {
  it('shows the public home at /', () => {
    renderRoute('/');

    expect(
      screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
    ).toBeInTheDocument();
  });

  it('shows the privacy policy at /privacy-policy', () => {
    renderRoute('/privacy-policy');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
    ).toBeInTheDocument();
  });

  it('shows the terms and conditions at /terms-and-conditions', () => {
    renderRoute('/terms-and-conditions');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Terms and Conditions' }),
    ).toBeInTheDocument();
  });

  it('shows the delete-account information at /delete-account', () => {
    renderRoute('/delete-account');

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'deleteAccountInfo.title',
      }),
    ).toBeInTheDocument();
  });

  it('shows the not found page for an unknown path', () => {
    renderRoute('/does-not-exist');

    expect(
      screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
    ).toBeInTheDocument();
  });

  it.each(['/sign-in', '/sign-up', '/forgot-password', '/home'])(
    'shows the not found page at %s until the account screens exist',
    path => {
      renderRoute(path);

      expect(
        screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
      ).toBeInTheDocument();
    },
  );
});
