import { act, render, screen } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { Provider } from 'react-redux';

import {
  type ApplicationsActions,
  ApplicationsProvider,
  useApplications,
  useApplicationsActions,
} from './ApplicationsProvider';
import { ProfileError, ProfileErrorCode } from './errors';
import { ProfileGatewayProvider } from './ProfileGatewayProvider';

import {
  type ApplicationsState,
  initialApplicationsState,
} from '@/core/state/slices/applicationsSlice';
import { initialSessionState } from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

let actions: ApplicationsActions;
const Probe = () => {
  const { status, applications, profileRevision } = useApplications();
  const current = useApplicationsActions();
  useEffect(() => {
    actions = current;
  }, [current]);
  return (
    <p>{`${status}: [${applications.map(({ id }) => id).join(' ')}] revision ${profileRevision}`}</p>
  );
};

const setUp = (applications?: Partial<ApplicationsState>) => {
  const gateway = createMockProfileGateway();
  const store = createStore({
    session: {
      ...initialSessionState,
      user: {
        uid: 'uid-1',
        email: 'maya@example.com',
        emailVerified: true,
        displayName: null,
        providerIds: ['password'],
      },
    },
    applications: { ...initialApplicationsState, ...applications },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <ProfileGatewayProvider gateway={gateway}>
        <ApplicationsProvider>{children}</ApplicationsProvider>
      </ProfileGatewayProvider>
    </Provider>
  );
  return { gateway, store, mount: () => render(<Probe />, { wrapper }) };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ApplicationsProvider', () => {
  it('reads the applications and the profile’s revision once', async () => {
    const { gateway, mount } = setUp();
    gateway.getApplications.mockResolvedValue([applicationFixture()]);
    gateway.getProfileRevision.mockResolvedValue(4);

    mount();

    expect(
      await screen.findByText('loaded: [a1] revision 4'),
    ).toBeInTheDocument();
    expect(gateway.getApplications).toHaveBeenCalledExactlyOnceWith('uid-1');
  });

  it('reads only the profile’s revision again when the store already has the applications', async () => {
    const { gateway, mount } = setUp({
      uid: 'uid-1',
      status: 'loaded',
      applications: [applicationFixture()],
      profileRevision: 2,
    });
    gateway.getProfileRevision.mockResolvedValue(3);

    mount();

    expect(
      await screen.findByText('loaded: [a1] revision 3'),
    ).toBeInTheDocument();
    expect(gateway.getApplications).not.toHaveBeenCalled();
  });

  it('still shows the applications when the profile’s revision cannot be read', async () => {
    const { gateway, mount } = setUp();
    gateway.getApplications.mockResolvedValue([applicationFixture()]);
    gateway.getProfileRevision.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );

    mount();

    expect(
      await screen.findByText('loaded: [a1] revision null'),
    ).toBeInTheDocument();
  });

  it('says they could not be read, logs the code and the uid only, and reads them again on reload', async () => {
    const { gateway, mount } = setUp();
    gateway.getApplications.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );

    mount();

    expect(await screen.findByText(/^error:/)).toBeInTheDocument();
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'getApplications failed: code=profile/network uid=uid-1',
    );

    gateway.getApplications.mockResolvedValue([applicationFixture()]);
    await act(async () => {
      await actions.reload();
    });
    expect(screen.getByText(/^loaded: \[a1\]/)).toBeInTheDocument();
  });

  it('reads one application again, and takes it out when it is gone', async () => {
    const { gateway, mount } = setUp({
      uid: 'uid-1',
      status: 'loaded',
      applications: [applicationFixture({ id: 'a1' })],
    });
    mount();

    gateway.getApplication.mockResolvedValueOnce(
      applicationFixture({ id: 'a2' }),
    );
    await act(async () => {
      await actions.refreshApplication('a2');
    });
    expect(screen.getByText(/^loaded: \[(a2 a1|a1 a2)\]/)).toBeInTheDocument();

    gateway.getApplication.mockResolvedValueOnce(null);
    await act(async () => {
      await actions.refreshApplication('a1');
    });
    expect(screen.getByText(/^loaded: \[a2\]/)).toBeInTheDocument();
  });

  it('reads the profile’s revision again when asked, and keeps the one it had when that fails', async () => {
    const { gateway, mount } = setUp({
      uid: 'uid-1',
      status: 'loaded',
      profileRevision: 2,
    });
    mount();

    gateway.getProfileRevision.mockResolvedValueOnce(5);
    await act(async () => {
      await actions.refreshProfileRevision();
    });
    expect(screen.getByText(/revision 5$/)).toBeInTheDocument();

    gateway.getProfileRevision.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );
    await act(async () => {
      await actions.refreshProfileRevision();
    });
    expect(screen.getByText(/revision 5$/)).toBeInTheDocument();
  });

  it('reads an application again every 2 seconds while its job is being read, and stops when it is ready', async () => {
    vi.useFakeTimers();
    try {
      const reading = applicationFixture({
        updatedAt: Date.now(),
        job: { source: 'text', status: 'reading', edited: false },
      });
      const { gateway, mount } = setUp({
        uid: 'uid-1',
        status: 'loaded',
        applications: [reading],
        profileRevision: 1,
      });
      gateway.getApplication.mockResolvedValue(reading);
      mount();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(gateway.getApplication).toHaveBeenCalledTimes(1);

      gateway.getApplication.mockResolvedValue(
        applicationFixture({
          title: 'Senior Backend Engineer',
          updatedAt: Date.now(),
          job: { source: 'text', status: 'ready', edited: false },
        }),
      );
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      gateway.getApplication.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000);
      });
      expect(gateway.getApplication).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
