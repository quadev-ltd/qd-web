import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { AccountScreen } from './AccountScreen';

import { type SessionUser, type UserProfile } from '@/core/auth/types';
import { type FlagValues } from '@/core/flags/registry';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const user: SessionUser = {
  uid: 'uid-1',
  email: 'grace@example.com',
  emailVerified: true,
  displayName: null,
  providerIds: ['password', 'google.com'],
};

const LocationProbe = () => {
  const { pathname, state } = useLocation();
  return <p>{`at ${pathname}, state=${JSON.stringify(state)}`}</p>;
};

const renderAccount = ({
  profile = { firstName: 'Grace', lastName: 'Hopper' },
  sessionUser = user,
  flags = {},
}: {
  profile?: UserProfile;
  sessionUser?: SessionUser;
  flags?: FlagValues;
} = {}) => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/account" element={<AccountScreen />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    {
      route: '/account',
      gateway,
      flags,
      session: {
        status: SessionStatus.Ready,
        authResolved: true,
        user: sessionUser,
        profile,
        profileStatus: 'loaded',
      },
    },
  );
  return { gateway, ...utils };
};

const detail = (label: string) => {
  const term = screen.getByText(label);
  return term.nextElementSibling as HTMLElement;
};

const personal = () =>
  screen.getByRole('region', { name: 'account.personalTitle' });

describe('AccountScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is "Your account", with its line, the two cards and the tab title (D85)', () => {
    renderAccount();

    expect(
      screen.getByRole('heading', { level: 1, name: 'home.accountTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('account.description')).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
    ).toEqual(['account.personalTitle', 'home.securityTitle']);
    expect(document.title).toBe('account.documentTitle');
  });

  it('marks no section of the bar: the account is behind the name', () => {
    renderAccount({ flags: { interviewAssistant: true, cvTool: true } });

    const nav = screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    });
    for (const link of within(nav).getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  describe('the CV details', () => {
    it('are a link away with the CV tool, with the line that says they are separate', () => {
      renderAccount({ flags: { interviewAssistant: true, cvTool: true } });

      expect(personal()).toHaveTextContent('account.personalCvNote');
      expect(
        within(personal()).getByRole('link', {
          name: 'account.openCvDetailsLink',
        }),
      ).toHaveAttribute('href', '/cv/details');
    });

    it.each<[string, FlagValues]>([
      ['without the CV tool', { interviewAssistant: true, cvTool: false }],
      [
        'without the interview tools',
        { interviewAssistant: false, cvTool: true },
      ],
    ])('are not mentioned %s: there are no CVs', (_, flags) => {
      renderAccount({ flags });

      expect(personal()).not.toHaveTextContent('account.personalCvNote');
      expect(
        screen.queryByRole('link', { name: 'account.openCvDetailsLink' }),
      ).not.toBeInTheDocument();
    });
  });

  describe('personal details', () => {
    it("shows the user's name and email from the session", () => {
      renderAccount();

      expect(detail('home.nameLabel')).toHaveTextContent('Grace Hopper');
      expect(detail('home.emailLabel')).toHaveTextContent('grace@example.com');
    });

    it('says that the date of birth is not set when the profile has none', () => {
      renderAccount();

      expect(detail('home.dobLabel')).toHaveTextContent('home.dobNotSet');
    });

    it('shows the date of birth as DD/MM/YYYY when the profile has one', () => {
      renderAccount({
        profile: {
          firstName: 'Grace',
          lastName: 'Hopper',
          dateOfBirth: '1906-12-09',
        },
      });

      expect(detail('home.dobLabel')).toHaveTextContent('09/12/1906');
      expect(screen.queryByText('home.dobNotSet')).not.toBeInTheDocument();
    });

    it('says "not set" for a date of birth it cannot read', () => {
      renderAccount({
        profile: {
          firstName: 'Grace',
          lastName: 'Hopper',
          dateOfBirth: 'yesterday',
        },
      });

      expect(detail('home.dobLabel')).toHaveTextContent('home.dobNotSet');
    });

    it('shows another user with their own data', () => {
      renderAccount({
        profile: { firstName: 'Ada', lastName: 'Lovelace' },
        sessionUser: { ...user, email: 'ada@example.com' },
      });

      expect(detail('home.nameLabel')).toHaveTextContent('Ada Lovelace');
      expect(detail('home.emailLabel')).toHaveTextContent('ada@example.com');
      expect(
        screen.getByRole('button', {
          name: 'header.accountMenuAccessibilityLabel',
        }),
      ).toHaveTextContent('AL');
    });
  });

  describe('sign-in and security', () => {
    it.each([
      [['password'], 'home.passwordMethod'],
      [['password', 'google.com'], 'home.passwordMethod, home.googleMethod'],
      [['google.com'], 'home.googleMethod'],
      [['apple.com'], 'home.appleMethod'],
      [
        ['apple.com', 'google.com', 'password'],
        'home.passwordMethod, home.googleMethod, home.appleMethod',
      ],
    ])('lists the sign-in methods of %j', (providerIds, methods) => {
      renderAccount({ sessionUser: { ...user, providerIds } });

      expect(detail('home.signInMethodsLabel')).toHaveTextContent(methods);
    });

    it('links to the password reset with the email filled in', async () => {
      renderAccount();

      await userEvent.click(
        screen.getByRole('link', { name: 'home.changePasswordLink' }),
      );

      expect(
        screen.getByText(
          'at /forgot-password, state={"email":"grace@example.com"}',
        ),
      ).toBeInTheDocument();
    });

    it('offers no password change to a user without a password', () => {
      renderAccount({ sessionUser: { ...user, providerIds: ['google.com'] } });

      expect(
        screen.queryByRole('link', { name: 'home.changePasswordLink' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('home.passwordLabel')).not.toBeInTheDocument();
    });

    it('links to the page where the account is deleted', () => {
      renderAccount();

      expect(
        screen.getByRole('link', { name: 'drawerMenu.deleteAccount' }),
      ).toHaveAttribute('href', '/account/delete');
    });

    it('signs out from the card', async () => {
      const { gateway } = renderAccount();

      await userEvent.click(
        screen.getByRole('button', { name: 'drawerMenu.signOut' }),
      );

      expect(gateway.signOut).toHaveBeenCalledTimes(1);
    });

    it('signs out from the account menu', async () => {
      const { gateway } = renderAccount();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'header.accountMenuAccessibilityLabel',
        }),
      );
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'drawerMenu.signOut' }),
      );

      expect(gateway.signOut).toHaveBeenCalledTimes(1);
    });

    it('logs a failed sign-out with the code and the uid only', async () => {
      const { gateway } = renderAccount();
      gateway.signOut.mockRejectedValue({ code: 'auth/internal-error' });

      await userEvent.click(
        screen.getByRole('button', { name: 'drawerMenu.signOut' }),
      );

      await waitFor(() =>
        expect(mockLogger.logError).toHaveBeenCalledWith(
          new Error('signOut failed: code=auth/internal-error uid=uid-1'),
        ),
      );
    });
  });
});
