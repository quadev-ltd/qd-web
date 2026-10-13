import { screen } from '@testing-library/react';

import { ProfileScreen } from './ProfileScreen';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const renderProfile = () =>
  renderWithProviders(<ProfileScreen />, {
    route: '/profile',
    flags: { interviewAssistant: true },
    session: {
      status: SessionStatus.Ready,
      profile: { firstName: 'Maya', lastName: 'Okafor' },
    },
  });

describe('ProfileScreen', () => {
  it('has the page heading and says what the profile is for', () => {
    renderProfile();

    expect(
      screen.getByRole('heading', { level: 1, name: 'profile.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('profile.description')).toBeInTheDocument();
    expect(document.title).toBe('profile.documentTitle');
  });

  it('sits in the signed-in frame, with the profile marked in the navigation', () => {
    renderProfile();

    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', {
        name: 'header.accountMenuAccessibilityLabel',
      }),
    ).toHaveTextContent('Maya');
  });
});
