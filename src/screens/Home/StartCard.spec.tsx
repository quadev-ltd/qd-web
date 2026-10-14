import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { StartCard } from './StartCard';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { selectProfileGateway } from '@/core/profile/selectProfileGateway';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { PROFILE_TEST_USER } from '@/testUtil/renderProfilePage';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));
// The card loads the profile gateway itself, as the profile's routes do.
vi.mock('@/core/profile/selectProfileGateway', () => ({
  selectProfileGateway: vi.fn(),
}));

const Location = () => {
  const { pathname, state } = useLocation();
  return <p>{`at ${pathname} ${JSON.stringify(state)}`}</p>;
};

const setUp = (interviewProfile?: Partial<InterviewProfileState>) => {
  const gateway = createMockProfileGateway();
  vi.mocked(selectProfileGateway).mockReturnValue(gateway);
  const utils = renderWithProviders(
    <Routes>
      <Route path="/home" element={<StartCard />} />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      route: '/home',
      interviewProfile,
      session: { status: SessionStatus.Ready, user: PROFILE_TEST_USER },
    },
  );
  return { gateway, ...utils };
};

const loaded = (
  overrides: Partial<InterviewProfileState> = {},
): Partial<InterviewProfileState> => ({
  uid: 'uid-1',
  status: 'loaded',
  ...overrides,
});

beforeEach(() => {
  vi.mocked(selectProfileGateway).mockReset();
});

describe('StartCard', () => {
  it('invites to add a CV while the profile has none, and opens "Add your CV" on the profile', async () => {
    setUp(loaded());

    expect(screen.getByText('home.startChip')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'home.startTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('home.startDescription')).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('link', { name: 'profile.addCvButton' }),
    );

    expect(screen.getByText('at /profile {"add":"cv"}')).toBeInTheDocument();
  });

  it('reads the profile itself when nothing has read it yet', async () => {
    const { gateway } = setUp();

    expect(
      await screen.findByRole('link', { name: 'profile.addCvButton' }),
    ).toBeInTheDocument();
    expect(gateway.getResources).toHaveBeenCalledExactlyOnceWith('uid-1');
  });

  it('says the CV is in the profile once it is, with what was read from it, and leads to its page', () => {
    setUp(
      loaded({
        resources: [resourceFixture({ id: 'r1', type: 'cv' })],
        items: [itemFixture({ id: '1' }), itemFixture({ id: '2' })],
      }),
    );

    const link = screen.getByRole('link', { name: /home\.startDoneTitle/ });
    expect(link).toHaveAttribute('href', '/profile/resources/r1');
    expect(link).toHaveTextContent('home.startDoneDescription');
    expect(screen.queryByText('home.startTitle')).not.toBeInTheDocument();
  });

  it('is about the newest CV when there are two', () => {
    setUp(
      loaded({
        resources: [
          resourceFixture({ id: 'old', type: 'cv', createdAt: 1_000 }),
          resourceFixture({ id: 'new', type: 'cv', createdAt: 9_000 }),
        ],
      }),
    );

    expect(
      screen.getByRole('link', { name: /home\.startDoneTitle/ }),
    ).toHaveAttribute('href', '/profile/resources/new');
  });

  it.each([
    ['awaitingUpload', 'profile.statusAwaitingUpload'],
    ['processing', 'profile.statusProcessing'],
  ] as const)(
    'counts a CV that is still %s as added, and says where it is',
    (status, text) => {
      setUp(
        loaded({
          resources: [resourceFixture({ type: 'cv', status, itemCount: 0 })],
        }),
      );

      const link = screen.getByRole('link', { name: /home\.startDoneTitle/ });
      expect(link).toHaveTextContent(text);
      expect(link).not.toHaveTextContent('home.startDoneDescription');
    },
  );

  it.each([
    [
      'a CV that could not be read',
      resourceFixture({ type: 'cv', status: 'failed' }),
    ],
    ['another document', resourceFixture({ type: 'document' })],
    ['a note', resourceFixture({ type: 'note', source: 'text' })],
  ])('keeps inviting with only %s in the profile', (_name, resource) => {
    setUp(loaded({ resources: [resource] }));

    expect(screen.getByText('home.startTitle')).toBeInTheDocument();
    expect(screen.queryByText('home.startDoneTitle')).not.toBeInTheDocument();
  });

  it('shows nothing while the profile is being read', () => {
    const { container } = setUp(loaded({ status: 'loading' }));

    expect(container.querySelector('section, a')).toBeNull();
    expect(screen.queryByText('home.startTitle')).not.toBeInTheDocument();
  });

  it('shows nothing when the profile cannot be read: the home stays as it was', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResources.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    vi.mocked(selectProfileGateway).mockReturnValue(gateway);
    const { store } = renderWithProviders(<StartCard />, {
      route: '/home',
      session: { status: SessionStatus.Ready, user: PROFILE_TEST_USER },
    });

    await waitFor(() =>
      expect(store.getState().interviewProfile.status).toBe('error'),
    );
    expect(screen.queryByText('home.startTitle')).not.toBeInTheDocument();
    expect(screen.queryByText('home.startDoneTitle')).not.toBeInTheDocument();
  });
});
