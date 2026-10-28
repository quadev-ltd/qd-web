import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SignedInShell from './SignedInShell';

import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const session = { profile: { firstName: 'Ada', lastName: 'Lovelace' } };

describe('SignedInShell', () => {
  const renderShell = (
    options: Parameters<typeof renderWithProviders>[1] = {},
  ) =>
    renderWithProviders(
      <SignedInShell title="Page title" mainClassName="px-gutter">
        <p>Content</p>
      </SignedInShell>,
      { session, ...options },
    );

  const navLabels = () =>
    within(
      screen.getByRole('navigation', {
        name: 'header.mainNavAccessibilityLabel',
      }),
    )
      .getAllByRole('link')
      .map(link => link.textContent);

  it('frames the page: title, main navigation and the content', () => {
    renderShell();

    expect(document.title).toBe('Page title');
    expect(screen.getByRole('main')).toHaveClass('px-gutter');
    expect(screen.getByRole('main')).toHaveTextContent('Content');
    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('has Profile · Applications · CVs with the interview and CV tools, and the logo leads to the profile (D91)', () => {
    renderShell({ flags: { interviewAssistant: true, cvTool: true } });

    expect(navLabels()).toEqual([
      'profile.title',
      'applications.title',
      'cv.title',
    ]);
    expect(screen.getByRole('link', { name: 'brand.name' })).toHaveAttribute(
      'href',
      '/profile',
    );
  });

  it('has Sessions after CVs with text practice (D94)', () => {
    renderShell({
      flags: { interviewAssistant: true, cvTool: true, textPractice: true },
    });

    expect(navLabels()).toEqual([
      'profile.title',
      'applications.title',
      'cv.title',
      'sessions.title',
    ]);
  });

  it('has Profile · Applications without the CV tool', () => {
    renderShell({ flags: { interviewAssistant: true, cvTool: false } });

    expect(navLabels()).toEqual(['profile.title', 'applications.title']);
  });

  it('has Home · Profile without the interview tools, and the logo leads to the home', () => {
    renderShell({ flags: { interviewAssistant: false, cvTool: true } });

    expect(navLabels()).toEqual(['drawerMenu.home', 'profile.title']);
    expect(screen.getByRole('link', { name: 'brand.name' })).toHaveAttribute(
      'href',
      '/home',
    );
  });

  it('keeps the place of the sections empty while the flags are read', () => {
    renderShell({ flags: { interviewAssistant: true }, flagsReady: false });

    expect(
      screen.queryByRole('navigation', {
        name: 'header.mainNavAccessibilityLabel',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'drawerMenu.home' })).toBeNull();
  });

  it('has the account behind the name: name and email, Account and Sign out', async () => {
    renderShell({
      session: {
        ...session,
        user: {
          uid: 'u1',
          email: 'ada@example.com',
          emailVerified: true,
          displayName: null,
          providerIds: ['password'],
        },
      },
    });

    await userEvent.click(
      screen.getByRole('button', {
        name: 'header.accountMenuAccessibilityLabel',
      }),
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: 'home.accountLink' }),
    ).toHaveAttribute('href', '/account');
  });

  it('shows the name and the initials on the account menu, and signs out from it', async () => {
    const gateway = createMockGateway();
    renderWithProviders(
      <SignedInShell title="Page title">
        <p>Content</p>
      </SignedInShell>,
      { session, gateway },
    );

    const menuButton = screen.getByRole('button', {
      name: 'header.accountMenuAccessibilityLabel',
    });
    expect(menuButton).toHaveTextContent('AL');
    expect(menuButton).toHaveTextContent('Ada');

    await userEvent.click(menuButton);
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'drawerMenu.signOut' }),
    );

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
  });

  it('does not break while the profile is not there', () => {
    renderWithProviders(
      <SignedInShell title="Page title">
        <p>Content</p>
      </SignedInShell>,
    );

    expect(
      screen.getByRole('button', {
        name: 'header.accountMenuAccessibilityLabel',
      }),
    ).toBeInTheDocument();
  });
});
