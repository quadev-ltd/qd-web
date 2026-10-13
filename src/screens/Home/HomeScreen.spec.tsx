import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { HomeScreen } from './HomeScreen';

import { type SessionUser, type UserProfile } from '@/core/auth/types';
import { useFlag } from '@/core/flags/FlagsProvider';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));
// Only `useFlag` is replaced: the render helper uses the rest of the module.
vi.mock(import('@/core/flags/FlagsProvider'), async importOriginal => ({
  ...(await importOriginal()),
  useFlag: vi.fn(() => false),
}));

const mockUseFlag = vi.mocked(useFlag);

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

const renderHome = ({
  profile = { firstName: 'Grace', lastName: 'Hopper' },
  sessionUser = user,
}: { profile?: UserProfile; sessionUser?: SessionUser } = {}) => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/home" element={<HomeScreen />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    {
      route: '/home',
      gateway,
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

const cards = () => screen.getAllByRole('article');

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFlag.mockReturnValue(false);
  });

  it('welcomes the user and sets the browser tab title', () => {
    renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: 'home.welcomeTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('home.welcomeDescription')).toBeInTheDocument();
    expect(document.title).toBe('home.documentTitle');
  });

  it('shows the main navigation with the home as the current page', () => {
    renderHome();

    const nav = screen.getByRole('navigation', {
      name: 'header.mainNavAccessibilityLabel',
    });
    expect(
      within(nav).getByRole('link', { name: 'drawerMenu.home' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'home.accountLink' }),
    ).toHaveAttribute('href', '/home#account');
  });

  it("shows the user's first name and initials on the account menu button", () => {
    renderHome();

    const button = screen.getByRole('button', {
      name: 'header.accountMenuAccessibilityLabel',
    });
    expect(button).toHaveTextContent('Grace');
    expect(button).toHaveTextContent('GH');
  });

  describe('tools', () => {
    it('shows the three tools, in order', () => {
      renderHome();

      expect(
        screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
      ).toEqual([
        'home.mockInterviewTitle',
        'home.liveInterviewTitle',
        'home.cvToolTitle',
        'home.accountTitle',
      ]);
      expect(cards()).toHaveLength(3);
    });

    it('says "Coming soon" on every tool while the interviewAssistant flag is off', () => {
      renderHome();

      expect(mockUseFlag).toHaveBeenCalledWith('interviewAssistant');
      for (const card of cards()) {
        expect(card).toHaveTextContent('home.comingSoonChip');
      }
    });

    it('marks the two interview tools as available when the interviewAssistant flag is on; the CV tool has no flag yet', () => {
      mockUseFlag.mockImplementation(key => key === 'interviewAssistant');
      renderHome();

      const [mockInterview, liveInterview, cvTool] = cards();
      expect(mockInterview).toHaveTextContent('home.availableChip');
      expect(liveInterview).toHaveTextContent('home.availableChip');
      expect(cvTool).toHaveTextContent('home.comingSoonChip');
      expect(cvTool).not.toHaveTextContent('home.availableChip');
    });

    it('reads no other flag', () => {
      renderHome();

      expect(
        mockUseFlag.mock.calls.every(([key]) => key === 'interviewAssistant'),
      ).toBe(true);
    });
  });

  describe('profile', () => {
    it("shows the user's name and email from the session", () => {
      renderHome();

      const section = screen.getByRole('region', { name: 'home.accountTitle' });
      expect(section).toHaveAttribute('id', 'account');
      expect(detail('home.nameLabel')).toHaveTextContent('Grace Hopper');
      expect(detail('home.emailLabel')).toHaveTextContent('grace@example.com');
    });

    it('says that the date of birth is not set when the profile has none', () => {
      renderHome();

      expect(detail('home.dobLabel')).toHaveTextContent('home.dobNotSet');
    });

    it('shows the date of birth as DD/MM/YYYY when the profile has one', () => {
      renderHome({
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
      renderHome({
        profile: {
          firstName: 'Grace',
          lastName: 'Hopper',
          dateOfBirth: 'yesterday',
        },
      });

      expect(detail('home.dobLabel')).toHaveTextContent('home.dobNotSet');
    });

    it('shows another user with their own data', () => {
      renderHome({
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
      renderHome({ sessionUser: { ...user, providerIds } });

      expect(detail('home.signInMethodsLabel')).toHaveTextContent(methods);
    });

    it('links to the password reset with the email filled in', async () => {
      renderHome();

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
      renderHome({ sessionUser: { ...user, providerIds: ['google.com'] } });

      expect(
        screen.queryByRole('link', { name: 'home.changePasswordLink' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('home.passwordLabel')).not.toBeInTheDocument();
    });

    it('links to the page where the account is deleted', () => {
      renderHome();

      expect(
        screen.getByRole('link', { name: 'drawerMenu.deleteAccount' }),
      ).toHaveAttribute('href', '/account/delete');
    });

    it('signs out from the card', async () => {
      const { gateway } = renderHome();

      await userEvent.click(
        screen.getByRole('button', { name: 'drawerMenu.signOut' }),
      );

      expect(gateway.signOut).toHaveBeenCalledTimes(1);
    });

    it('signs out from the account menu', async () => {
      const { gateway } = renderHome();

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
      const { gateway } = renderHome();
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
