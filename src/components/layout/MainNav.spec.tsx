import { screen, within } from '@testing-library/react';

import { MainNav } from './MainNav';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('MainNav', () => {
  it('links to the home and to the account section, and marks the current page', () => {
    renderWithProviders(
      <MainNav homePath="/home" accountPath="/home#account" />,
      { route: '/home' },
    );

    const nav = screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    });
    const home = within(nav).getByRole('link', { name: 'drawerMenu.home' });
    const account = within(nav).getByRole('link', { name: 'home.accountLink' });
    expect(home).toHaveAttribute('href', '/home');
    expect(home).toHaveAttribute('aria-current', 'page');
    expect(account).toHaveAttribute('href', '/home#account');
    expect(account).not.toHaveAttribute('aria-current');
  });

  it('does not mark the home as current on another page', () => {
    renderWithProviders(
      <MainNav homePath="/home" accountPath="/home#account" />,
      { route: '/forgot-password' },
    );

    expect(
      screen.getByRole('link', { name: 'drawerMenu.home' }),
    ).not.toHaveAttribute('aria-current');
  });
});
