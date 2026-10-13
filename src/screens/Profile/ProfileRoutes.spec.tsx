import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router';

import { ProfileRoutes } from './ProfileRoutes';

import { type ProfileGateway } from '@/core/profile/gateway';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { selectProfileGateway } from '@/core/profile/selectProfileGateway';
import { unavailableProfileGateway } from '@/core/profile/unavailableProfileGateway';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));
vi.mock('@/core/profile/selectProfileGateway', () => ({
  selectProfileGateway: vi.fn(),
}));

const Page = () => {
  const gateway = useProfileGateway();
  return (
    <p>
      {gateway === unavailableProfileGateway
        ? 'a page without a gateway'
        : 'a page with its gateway'}
    </p>
  );
};

const renderRoutes = (
  options: { flags?: { interviewAssistant: boolean }; flagsReady?: boolean },
  route = '/profile',
) =>
  renderWithProviders(
    <Routes>
      <Route element={<ProfileRoutes />}>
        <Route path="/profile" element={<Page />} />
        <Route path="/profile/skill-map" element={<Page />} />
      </Route>
    </Routes>,
    {
      route,
      session: {
        status: SessionStatus.Ready,
        profile: { firstName: 'Maya', lastName: 'Okafor' },
      },
      ...options,
    },
  );

beforeEach(() => {
  vi.mocked(selectProfileGateway).mockReset();
  vi.mocked(selectProfileGateway).mockReturnValue(createMockProfileGateway());
});

describe('ProfileRoutes', () => {
  it('waits while the flags of the user are being read, instead of saying "not available"', () => {
    renderRoutes({ flagsReady: false });

    expect(
      screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('access.notAvailableChip'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/a page/)).not.toBeInTheDocument();
    expect(selectProfileGateway).not.toHaveBeenCalled();
    expect(document.title).toBe('profile.documentTitle');
  });

  it.each(['/profile', '/profile/skill-map'])(
    'says "not available for your account yet" at %s while the flag is off',
    route => {
      renderRoutes({ flags: { interviewAssistant: false } }, route);

      expect(
        screen.getByRole('heading', { level: 1, name: 'profile.title' }),
      ).toBeInTheDocument();
      expect(screen.getByText('access.notAvailableChip')).toBeInTheDocument();
      expect(
        screen.getByText('profile.notAvailableDescription'),
      ).toBeInTheDocument();
      expect(screen.queryByText(/a page/)).not.toBeInTheDocument();
      // The signed-in frame is still there: the user can go elsewhere.
      expect(
        screen.getByRole('link', { name: 'drawerMenu.home' }),
      ).toBeInTheDocument();
    },
  );

  it('loads nothing of the profile for an account without the flag', () => {
    renderRoutes({});

    expect(screen.getByText('access.notAvailableChip')).toBeInTheDocument();
    expect(selectProfileGateway).not.toHaveBeenCalled();
  });

  it('shows the page, with the profile gateway, when the flag is on', () => {
    renderRoutes({ flags: { interviewAssistant: true } });

    expect(screen.getByText('a page with its gateway')).toBeInTheDocument();
    expect(
      screen.queryByText('access.notAvailableChip'),
    ).not.toBeInTheDocument();
    expect(selectProfileGateway).toHaveBeenCalledTimes(1);
  });

  it('waits while the gateway is being loaded', async () => {
    let arrive: (gateway: ProfileGateway) => void = () => undefined;
    vi.mocked(selectProfileGateway).mockReturnValue(
      new Promise<ProfileGateway>(resolve => {
        arrive = resolve;
      }),
    );

    renderRoutes({ flags: { interviewAssistant: true } });

    expect(
      screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/a page/)).not.toBeInTheDocument();

    arrive(createMockProfileGateway());

    expect(
      await screen.findByText('a page with its gateway'),
    ).toBeInTheDocument();
  });
});
