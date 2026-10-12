import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SignedInActions from './SignedInActions';

import { type SessionUser } from '@/core/auth/types';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const user: SessionUser = {
  uid: 'uid-1',
  email: 'ada@example.com',
  emailVerified: false,
  displayName: null,
  providerIds: ['password'],
};

describe('SignedInActions', () => {
  it('shows the email of the account and signs out', async () => {
    const gateway = createMockGateway();
    renderWithProviders(<SignedInActions />, {
      gateway,
      session: { status: SessionStatus.NeedsEmailVerification, user },
    });

    expect(screen.getByText('ada@example.com')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'drawerMenu.signOut' }),
    );

    expect(gateway.signOut).toHaveBeenCalledTimes(1);
  });

  it('shows only the button when the account has no email', () => {
    renderWithProviders(<SignedInActions />, {
      session: { user: { ...user, email: null } },
    });

    expect(screen.queryByText('ada@example.com')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'drawerMenu.signOut' }),
    ).toBeInTheDocument();
  });
});
