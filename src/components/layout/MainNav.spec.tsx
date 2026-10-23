import { screen, within } from '@testing-library/react';

import { MainNav } from './MainNav';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

/** With the interview tools: Applications · CVs (with the CV tool) · Profile (D85). */
const renderTools = (route: string, { cvTool = true } = {}) =>
  renderWithProviders(
    <MainNav
      applicationsPath="/applications"
      cvPath={cvTool ? '/cv' : undefined}
      profilePath="/profile"
    />,
    { route },
  );

/** Without them: Home · Profile. */
const renderHome = (route: string) =>
  renderWithProviders(<MainNav homePath="/home" profilePath="/profile" />, {
    route,
  });

const labels = () =>
  within(
    screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    }),
  )
    .getAllByRole('link')
    .map(link => link.textContent);

const current = () =>
  screen
    .getAllByRole('link')
    .filter(link => link.getAttribute('aria-current') === 'page')
    .map(link => link.textContent);

describe('MainNav', () => {
  it('reads Applications · CVs · Profile with the interview and CV tools, and has no Account', () => {
    renderTools('/applications');

    expect(labels()).toEqual([
      'applications.title',
      'cv.title',
      'profile.title',
    ]);
    expect(
      screen.getByRole('link', { name: 'applications.title' }),
    ).toHaveAttribute('href', '/applications');
    expect(screen.getByRole('link', { name: 'cv.title' })).toHaveAttribute(
      'href',
      '/cv',
    );
    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(
      screen.queryByRole('link', { name: 'home.accountLink' }),
    ).not.toBeInTheDocument();
  });

  it('reads Applications · Profile without the CV tool', () => {
    renderTools('/applications', { cvTool: false });

    expect(labels()).toEqual(['applications.title', 'profile.title']);
  });

  it('reads Home · Profile without the interview tools', () => {
    renderHome('/home');

    expect(labels()).toEqual(['drawerMenu.home', 'profile.title']);
    expect(current()).toEqual(['drawerMenu.home']);
  });

  it.each([
    ['/applications', 'applications.title'],
    ['/applications/a1', 'applications.title'],
    ['/applications/a1/details', 'applications.title'],
    ['/cv', 'cv.title'],
    ['/cv/versions/v1', 'cv.title'],
    ['/cv/details', 'cv.title'],
    ['/profile', 'profile.title'],
    ['/profile/resources/r1', 'profile.title'],
  ])('marks only its section at %s', (route, label) => {
    renderTools(route);

    expect(current()).toEqual([label]);
  });

  it.each(['/account', '/forgot-password'])('marks nothing at %s', route => {
    renderTools(route);

    expect(current()).toEqual([]);
  });

  it('marks the profile, not the home, on a resource without the interview tools', () => {
    renderHome('/profile/resources/r1');

    expect(current()).toEqual(['profile.title']);
  });
});
