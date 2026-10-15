import { screen, within } from '@testing-library/react';

import { MainNav } from './MainNav';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

const renderNav = (route: string) =>
  renderWithProviders(
    <MainNav
      homePath="/home"
      profilePath="/profile"
      accountPath="/home#account"
    />,
    { route },
  );

describe('MainNav', () => {
  it('links to the home, the profile and the account section, and marks the current page', () => {
    renderNav('/home');

    const nav = screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    });
    const links = within(nav).getAllByRole('link');
    expect(links.map(link => link.textContent)).toEqual([
      'drawerMenu.home',
      'profile.title',
      'home.accountLink',
    ]);
    const [home, profile, account] = links;
    expect(home).toHaveAttribute('href', '/home');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(profile).toHaveAttribute('href', '/profile');
    expect(profile).not.toHaveAttribute('aria-current');
    expect(account).toHaveAttribute('href', '/home#account');
    expect(account).not.toHaveAttribute('aria-current');
  });

  it.each(['/profile', '/profile/resources/r1'])(
    'marks the profile as current at %s',
    route => {
      renderNav(route);

      expect(
        screen.getByRole('link', { name: 'profile.title' }),
      ).toHaveAttribute('aria-current', 'page');
      expect(
        screen.getByRole('link', { name: 'drawerMenu.home' }),
      ).not.toHaveAttribute('aria-current');
    },
  );

  it('keeps the home marked on the page of an application, which belongs to it', () => {
    renderNav('/applications/a1');

    const home = screen.getByRole('link', { name: 'drawerMenu.home' });
    expect(home).toHaveClass('bg-white/14');
    // Marked to the eye only: the page itself is the application, not the home.
    expect(home).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'profile.title' })).not.toHaveClass(
      'bg-white/14',
    );
  });

  it('marks nothing as current on another page', () => {
    renderNav('/forgot-password');

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });
});
