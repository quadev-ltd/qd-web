import { screen } from '@testing-library/react';

import { PublicHomeScreen } from './PublicHomeScreen';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockEnv = vi.hoisted(() => ({
  APPLICATION_NAME: 'web',
  APPLICATION_ENVIRONMENT: 'test',
  ACCOUNT_ENABLED: false,
}));

vi.mock('@/core/env', () => ({ env: mockEnv }));

describe('PublicHomeScreen', () => {
  afterEach(() => {
    mockEnv.ACCOUNT_ENABLED = false;
  });

  it('shows the title, the logo and the three cards', () => {
    renderWithProviders(<PublicHomeScreen />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'brand.logoAlt' })).toBeVisible();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
    ).toEqual([
      'publicHome.signUpCardTitle',
      'publicHome.dataCardTitle',
      'publicHome.deleteCardTitle',
    ]);
  });

  it('links to the delete-account page from the last card', () => {
    renderWithProviders(<PublicHomeScreen />);

    expect(
      screen.getByRole('link', { name: 'publicHome.deleteCardLink' }),
    ).toHaveAttribute('href', '/delete-account');
  });

  describe('when the account flag is off', () => {
    it('shows no sign in, sign up or create account buttons', () => {
      renderWithProviders(<PublicHomeScreen />);

      expect(
        screen.queryByRole('link', { name: 'landing.changePathButton' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'landing.signUpButton' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: 'publicHome.createAccountButton' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('navigation', {
          name: 'header.accountNavAccessibilityLabel',
        }),
      ).not.toBeInTheDocument();
    });

    it('shows the description that does not invite to create an account', () => {
      renderWithProviders(<PublicHomeScreen />);

      expect(screen.getByText('publicHome.description')).toBeInTheDocument();
      expect(
        screen.queryByText('publicHome.descriptionWithAccount'),
      ).not.toBeInTheDocument();
    });
  });

  describe('when the account flag is on', () => {
    beforeEach(() => {
      mockEnv.ACCOUNT_ENABLED = true;
    });

    it('links to sign in from the header and from the hero', () => {
      renderWithProviders(<PublicHomeScreen />);

      const signInLinks = screen.getAllByRole('link', {
        name: 'landing.changePathButton',
      });
      expect(signInLinks).toHaveLength(2);
      signInLinks.forEach(link =>
        expect(link).toHaveAttribute('href', '/sign-in'),
      );
    });

    it('links to sign up from the header and from the hero', () => {
      renderWithProviders(<PublicHomeScreen />);

      expect(
        screen.getByRole('link', { name: 'landing.signUpButton' }),
      ).toHaveAttribute('href', '/sign-up');
      expect(
        screen.getByRole('link', { name: 'publicHome.createAccountButton' }),
      ).toHaveAttribute('href', '/sign-up');
    });

    it('shows the description that invites to create an account', () => {
      renderWithProviders(<PublicHomeScreen />);

      expect(
        screen.getByText('publicHome.descriptionWithAccount'),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('publicHome.description'),
      ).not.toBeInTheDocument();
    });

    describe('for a signed-in user', () => {
      const signedIn = { session: { status: SessionStatus.Ready } };

      it('links to their home instead of sign in and sign up', () => {
        renderWithProviders(<PublicHomeScreen />, signedIn);

        expect(
          screen.getByRole('link', { name: 'drawerMenu.home' }),
        ).toHaveAttribute('href', '/home');
        expect(
          screen.getByRole('link', { name: 'publicHome.goToHomeButton' }),
        ).toHaveAttribute('href', '/home');
        expect(
          screen.queryByRole('link', { name: 'landing.changePathButton' }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('link', { name: 'landing.signUpButton' }),
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('link', {
            name: 'publicHome.createAccountButton',
          }),
        ).not.toBeInTheDocument();
      });

      it('does not invite them to create an account', () => {
        renderWithProviders(<PublicHomeScreen />, signedIn);

        expect(screen.getByText('publicHome.description')).toBeInTheDocument();
        expect(
          screen.queryByText('publicHome.descriptionWithAccount'),
        ).not.toBeInTheDocument();
      });
    });
  });

  it('shows no way to the signed-in home while the account flag is off, even with a session', () => {
    renderWithProviders(<PublicHomeScreen />, {
      session: { status: SessionStatus.Ready },
    });

    expect(
      screen.queryByRole('link', { name: 'drawerMenu.home' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'publicHome.goToHomeButton' }),
    ).not.toBeInTheDocument();
  });
});
