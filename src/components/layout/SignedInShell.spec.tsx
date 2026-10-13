import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SignedInShell, { ACCOUNT_SECTION_ID } from './SignedInShell';

import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const session = { profile: { firstName: 'Ada', lastName: 'Lovelace' } };

describe('SignedInShell', () => {
  it('frames the page: title, main navigation and the content', () => {
    renderWithProviders(
      <SignedInShell title="Page title" mainClassName="px-gutter">
        <p>Content</p>
      </SignedInShell>,
      { session },
    );

    expect(document.title).toBe('Page title');
    expect(screen.getByRole('main')).toHaveClass('px-gutter');
    expect(screen.getByRole('main')).toHaveTextContent('Content');
    const nav = screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    });
    expect(nav).toContainElement(
      screen.getByRole('link', { name: 'drawerMenu.home' }),
    );
    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'href',
      '/profile',
    );
    expect(
      screen.getByRole('link', { name: 'home.accountLink' }),
    ).toHaveAttribute('href', `/home#${ACCOUNT_SECTION_ID}`);
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
