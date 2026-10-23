import { screen, within } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router';

import { HomeScreen } from './HomeScreen';

import { type FlagValues } from '@/core/flags/registry';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const LocationProbe = () => {
  const { pathname, hash } = useLocation();
  return <p>{`at ${pathname}${hash}`}</p>;
};

const renderHome = ({
  flags = {},
  flagsReady = true,
  route = '/home',
}: { flags?: FlagValues; flagsReady?: boolean; route?: string } = {}) =>
  renderWithProviders(
    <Routes>
      <Route path="/home" element={<HomeScreen />} />
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    {
      route,
      flags,
      flagsReady,
      session: {
        status: SessionStatus.Ready,
        authResolved: true,
        profile: { firstName: 'Grace', lastName: 'Hopper' },
        profileStatus: 'loaded',
      },
    },
  );

const cards = () => screen.getAllByRole('article');

describe('HomeScreen', () => {
  describe('without the interview tools', () => {
    it('welcomes the user and sets the browser tab title', () => {
      renderHome();

      expect(
        screen.getByRole('heading', { level: 1, name: 'home.welcomeTitle' }),
      ).toBeInTheDocument();
      expect(screen.getByText('home.welcomeDescription')).toBeInTheDocument();
      expect(document.title).toBe('home.documentTitle');
    });

    it('has Home · Profile in the bar, with the home marked', () => {
      renderHome();

      const nav = screen.getByRole('navigation', {
        name: 'header.mainNavAccessibilityLabel',
      });
      expect(
        within(nav)
          .getAllByRole('link')
          .map(link => link.textContent),
      ).toEqual(['drawerMenu.home', 'profile.title']);
      expect(
        within(nav).getByRole('link', { name: 'drawerMenu.home' }),
      ).toHaveAttribute('aria-current', 'page');
    });

    it('shows the three tools, in order, each "Coming soon", and no account cards (D85)', () => {
      renderHome();

      expect(
        screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
      ).toEqual([
        'home.mockInterviewTitle',
        'home.liveInterviewTitle',
        'home.cvToolTitle',
      ]);
      expect(cards()).toHaveLength(3);
      for (const card of cards()) {
        expect(card).toHaveTextContent('home.comingSoonChip');
      }
      expect(screen.queryByText('home.securityTitle')).not.toBeInTheDocument();
    });
  });

  it('sends an account with the interview tools to its applications (D85)', () => {
    renderHome({ flags: { interviewAssistant: true } });

    expect(screen.getByText('at /applications')).toBeInTheDocument();
  });

  it('waits for the flags before it decides', () => {
    renderHome({ flags: { interviewAssistant: true }, flagsReady: false });

    expect(screen.queryByText(/^at /)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'home.welcomeTitle' }),
    ).not.toBeInTheDocument();
  });

  it.each<FlagValues>([{ interviewAssistant: true }, {}])(
    'sends an old link to its account section to the account page (%j)',
    flags => {
      renderHome({ flags, route: '/home#account' });

      expect(screen.getByText('at /account')).toBeInTheDocument();
    },
  );
});
