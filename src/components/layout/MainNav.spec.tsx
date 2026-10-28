import { screen, within } from '@testing-library/react';

import { MainNav } from './MainNav';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

/** With the interview tools: Profile · Applications · CVs (with the CV tool) (D85, D91). */
const renderTools = (
  route: string,
  { cvTool = true, textPractice = false } = {},
) =>
  renderWithProviders(
    <MainNav
      applicationsPath="/applications"
      cvPath={cvTool ? '/cv' : undefined}
      sessionsPath={textPractice ? '/sessions' : undefined}
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
  it('reads Profile · Applications · CVs with the interview and CV tools, and has no Account', () => {
    renderTools('/applications');

    expect(labels()).toEqual([
      'profile.title',
      'applications.title',
      'cv.title',
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

  it('reads Profile · Applications · CVs · Sessions with text practice, and marks Sessions on a practice opened there', () => {
    renderTools('/sessions/turn-1', { textPractice: true });

    expect(labels()).toEqual([
      'profile.title',
      'applications.title',
      'cv.title',
      'sessions.title',
    ]);
    expect(current()).toEqual(['sessions.title']);
  });

  it('reads Profile · Applications without the CV tool', () => {
    renderTools('/applications', { cvTool: false });

    expect(labels()).toEqual(['profile.title', 'applications.title']);
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
