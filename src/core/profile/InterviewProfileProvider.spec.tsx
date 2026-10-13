import { act, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, useEffect } from 'react';
import { Provider } from 'react-redux';

import { type ProfileResource } from './contract';
import { ProfileError, ProfileErrorCode } from './errors';
import {
  type InterviewProfileActions,
  InterviewProfileProvider,
  isPending,
  RESOURCE_POLL_MS,
  RESOURCE_WATCH_MS,
  useInterviewProfile,
  useInterviewProfileActions,
} from './InterviewProfileProvider';
import { ProfileGatewayProvider } from './ProfileGatewayProvider';

import { type SessionUser } from '@/core/auth/types';
import {
  initialInterviewProfileState,
  type InterviewProfileState,
} from '@/core/state/slices/interviewProfileSlice';
import {
  authStateChanged,
  initialSessionState,
} from '@/core/state/slices/sessionSlice';
import { createStore } from '@/core/state/store';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const user = (uid: string): SessionUser => ({
  uid,
  email: `${uid}@example.com`,
  emailVerified: true,
  displayName: null,
  providerIds: ['password'],
});

let actions: InterviewProfileActions;
const Probe = () => {
  const { status, resources, items } = useInterviewProfile();
  const current = useInterviewProfileActions();
  // What a page would call, kept for the spec to call.
  useEffect(() => {
    actions = current;
  }, [current]);
  return (
    <p>{`${status}: [${resources.map(r => `${r.id}=${r.status}`).join(' ')}] ${items.length} items`}</p>
  );
};

const setUp = ({
  uid = 'uid-1' as string | null,
  interviewProfile,
}: {
  uid?: string | null;
  interviewProfile?: Partial<InterviewProfileState>;
} = {}) => {
  const gateway = createMockProfileGateway();
  const store = createStore({
    session: { ...initialSessionState, user: uid ? user(uid) : null },
    interviewProfile: { ...initialInterviewProfileState, ...interviewProfile },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <ProfileGatewayProvider gateway={gateway}>
        <InterviewProfileProvider>{children}</InterviewProfileProvider>
      </ProfileGatewayProvider>
    </Provider>
  );
  return { gateway, store, mount: () => render(<Probe />, { wrapper }) };
};

const processing = (overrides: Partial<ProfileResource> = {}) =>
  resourceFixture({
    id: 'r1',
    status: 'processing',
    itemCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

/** Lets the promises of a round of polling settle, with the fake clock running. */
const round = async (milliseconds = RESOURCE_POLL_MS) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isPending', () => {
  it.each([
    ['awaitingUpload', true],
    ['processing', true],
    ['ready', false],
    ['failed', false],
  ] as const)('%s: %s', (status, expected) => {
    expect(isPending({ status })).toBe(expected);
  });
});

describe('InterviewProfileProvider', () => {
  describe('the first profile page of the session', () => {
    it('reads the resources, the skill map and today’s count, once', async () => {
      const { gateway, store, mount } = setUp();
      gateway.getResources.mockResolvedValue([resourceFixture()]);
      gateway.getItems.mockResolvedValue([itemFixture()]);
      gateway.getExtractionsToday.mockResolvedValue(3);

      mount();

      expect(screen.getByText(/^loading:/)).toBeInTheDocument();
      expect(
        await screen.findByText('loaded: [r1=ready] 1 items'),
      ).toBeInTheDocument();
      expect(store.getState().interviewProfile).toMatchObject({
        uid: 'uid-1',
        extractionsToday: 3,
      });
      expect(gateway.getResources).toHaveBeenCalledExactlyOnceWith('uid-1');
      expect(gateway.getItems).toHaveBeenCalledExactlyOnceWith('uid-1');
      expect(gateway.getExtractionsToday).toHaveBeenCalledExactlyOnceWith(
        'uid-1',
      );
    });

    it('says the profile could not be loaded, and logs the code and the uid only', async () => {
      const { gateway, mount } = setUp();
      gateway.getResources.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );

      mount();

      expect(await screen.findByText(/^error:/)).toBeInTheDocument();
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        'loadProfile failed: code=profile/network uid=uid-1',
      );
    });

    it('still loads the profile when today’s count cannot be read', async () => {
      const { gateway, store, mount } = setUp();
      gateway.getResources.mockResolvedValue([resourceFixture()]);
      gateway.getExtractionsToday.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );

      mount();

      expect(await screen.findByText(/^loaded:/)).toBeInTheDocument();
      expect(store.getState().interviewProfile.extractionsToday).toBe(0);
    });

    it('reads nothing while nobody is signed in', () => {
      const { gateway, mount } = setUp({ uid: null });

      mount();

      expect(screen.getByText(/^idle:/)).toBeInTheDocument();
      expect(gateway.getResources).not.toHaveBeenCalled();
    });

    it('reads it again for another user', async () => {
      const { gateway, store, mount } = setUp({
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          resources: [resourceFixture()],
        },
      });
      mount();
      gateway.getResources.mockResolvedValue([resourceFixture({ id: 'r9' })]);

      act(() => {
        store.dispatch(authStateChanged(user('uid-2')));
      });

      expect(
        await screen.findByText('loaded: [r9=ready] 0 items'),
      ).toBeInTheDocument();
      expect(gateway.getResources).toHaveBeenCalledExactlyOnceWith('uid-2');
    });
  });

  describe('coming back to the profile', () => {
    it('reads nothing again when everything was finished', async () => {
      const { gateway, mount } = setUp({
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          resources: [resourceFixture()],
          items: [itemFixture()],
        },
      });

      mount();

      expect(
        screen.getByText('loaded: [r1=ready] 1 items'),
      ).toBeInTheDocument();
      await waitFor(() => expect(gateway.getResources).not.toHaveBeenCalled());
      expect(gateway.getResource).not.toHaveBeenCalled();
      expect(gateway.getItems).not.toHaveBeenCalled();
    });

    it('reads again only what was unfinished, and the skill map when that was read meanwhile', async () => {
      const { gateway, mount } = setUp({
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          resources: [
            resourceFixture({ id: 'done' }),
            // Unfinished long ago: too old to be polled, but worth one look.
            processing({ id: 'r1', createdAt: 1, updatedAt: 1 }),
          ],
        },
      });
      gateway.getResource.mockResolvedValue(
        resourceFixture({ id: 'r1', status: 'ready', itemCount: 2 }),
      );
      gateway.getItems.mockResolvedValue([itemFixture(), itemFixture()]);

      mount();

      expect(
        await screen.findByText('loaded: [done=ready r1=ready] 2 items'),
      ).toBeInTheDocument();
      expect(gateway.getResource).toHaveBeenCalledExactlyOnceWith(
        'uid-1',
        'r1',
      );
      expect(gateway.getResources).not.toHaveBeenCalled();
    });
  });

  describe('while the backend reads a resource', () => {
    const withProcessing = (resource = processing()) =>
      setUp({
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          resources: [resource],
        },
      });

    it('reads it again every 2 seconds until it is ready, then the skill map once', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockResolvedValue(processing());
      mount();
      await round(0);
      gateway.getResource.mockClear();

      await round();
      await round();

      expect(gateway.getResource).toHaveBeenCalledTimes(2);
      expect(gateway.getItems).not.toHaveBeenCalled();
      expect(screen.getByText(/r1=processing/)).toBeInTheDocument();

      gateway.getResource.mockResolvedValue(
        resourceFixture({ id: 'r1', status: 'ready', itemCount: 4 }),
      );
      gateway.getItems.mockResolvedValue([itemFixture()]);
      await round();

      expect(
        screen.getByText('loaded: [r1=ready] 1 items'),
      ).toBeInTheDocument();
      expect(gateway.getItems).toHaveBeenCalledTimes(1);

      // Nothing is left to follow.
      gateway.getResource.mockClear();
      await round();
      await round();
      expect(gateway.getResource).not.toHaveBeenCalled();
    });

    it('does not read the skill map for a resource that failed, or that added nothing', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockResolvedValue(
        resourceFixture({
          id: 'r1',
          status: 'failed',
          failure: 'too-long',
          itemCount: 0,
        }),
      );
      mount();
      await round();

      expect(screen.getByText(/r1=failed/)).toBeInTheDocument();
      expect(gateway.getItems).not.toHaveBeenCalled();
    });

    it('takes out of the list a resource that no longer exists', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockResolvedValue(null);
      mount();
      await round();

      expect(screen.getByText('loaded: [] 0 items')).toBeInTheDocument();
    });

    it('tries again at the next round after a failed read', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );
      mount();
      await round();
      await round();

      expect(screen.getByText(/r1=processing/)).toBeInTheDocument();

      gateway.getResource.mockResolvedValue(
        resourceFixture({ id: 'r1', status: 'ready', itemCount: 0 }),
      );
      await round();

      expect(screen.getByText(/r1=ready/)).toBeInTheDocument();
    });

    it('does not start a round while the last one is still out', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockResolvedValue(processing());
      mount();
      await round(0);
      gateway.getResource.mockClear();
      gateway.getResource.mockReturnValue(new Promise(() => {}));

      await round();
      await round();
      await round();

      expect(gateway.getResource).toHaveBeenCalledTimes(1);
    });

    it('stops following a resource after 3 minutes: it is stuck', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockImplementation(async () =>
        processing({ updatedAt: Date.now() - 1 }),
      );
      mount();
      await round(0);
      gateway.getResource.mockClear();
      // The resource the backend last touched 3 minutes ago, however often it is read.
      gateway.getResource.mockResolvedValue(
        processing({ updatedAt: Date.now() }),
      );

      await round(RESOURCE_WATCH_MS - RESOURCE_POLL_MS);
      const callsWithinTheWindow = gateway.getResource.mock.calls.length;
      expect(callsWithinTheWindow).toBeGreaterThan(80);

      await round(10 * RESOURCE_POLL_MS);
      expect(gateway.getResource.mock.calls.length).toBeLessThanOrEqual(
        callsWithinTheWindow + 1,
      );
    });

    it('does not follow a resource that was already stuck when the page opened', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing(
        processing({
          status: 'awaitingUpload',
          createdAt: Date.now() - RESOURCE_WATCH_MS - 1,
          updatedAt: Date.now() - RESOURCE_WATCH_MS - 1,
        }),
      );
      gateway.getResource.mockImplementation(async () =>
        processing({
          status: 'awaitingUpload',
          createdAt: 1,
          updatedAt: 1,
        }),
      );
      mount();
      await round(0);
      gateway.getResource.mockClear();

      await round();
      await round();

      expect(gateway.getResource).not.toHaveBeenCalled();
    });

    it('follows a resource the page just added, whatever the backend’s clock says', async () => {
      vi.useFakeTimers();
      // A date far in the past, as a visitor whose clock is far ahead would see it.
      const added = processing({ createdAt: 1, updatedAt: 1 });
      const { gateway, mount } = setUp({
        interviewProfile: { uid: 'uid-1', status: 'loaded' },
      });
      gateway.getResource.mockResolvedValue(added);
      mount();

      act(() => {
        actions.watchResource('r1');
      });
      await act(async () => {
        await actions.refreshResource('r1');
      });
      gateway.getResource.mockClear();
      await round();

      expect(gateway.getResource).toHaveBeenCalledWith('uid-1', 'r1');
    });

    it('stops when the user leaves the profile pages', async () => {
      vi.useFakeTimers();
      const { gateway, mount } = withProcessing();
      gateway.getResource.mockResolvedValue(processing());
      const { unmount } = mount();
      await round();
      gateway.getResource.mockClear();

      unmount();
      await round();
      await round();

      expect(gateway.getResource).not.toHaveBeenCalled();
    });
  });

  describe('what a page can ask for', () => {
    const loaded = () =>
      setUp({ interviewProfile: { uid: 'uid-1', status: 'loaded' } });

    it('reads one resource again and puts it in the list', async () => {
      const { gateway, mount } = loaded();
      mount();
      gateway.getResource.mockResolvedValue(resourceFixture({ id: 'r7' }));

      let answer: ProfileResource | null = null;
      await act(async () => {
        answer = await actions.refreshResource('r7');
      });

      expect(answer).toEqual(resourceFixture({ id: 'r7' }));
      expect(
        screen.getByText('loaded: [r7=ready] 0 items'),
      ).toBeInTheDocument();
    });

    it('passes a failed read of one resource on to the page that asked', async () => {
      const { gateway, mount } = loaded();
      mount();
      const failure = new ProfileError(ProfileErrorCode.Network);
      gateway.getResource.mockRejectedValue(failure);

      await expect(actions.refreshResource('r7')).rejects.toBe(failure);
    });

    it('reads the skill map again', async () => {
      const { gateway, mount } = loaded();
      mount();
      gateway.getItems.mockResolvedValue([itemFixture(), itemFixture()]);

      await act(async () => {
        await actions.refreshItems();
      });

      expect(screen.getByText('loaded: [] 2 items')).toBeInTheDocument();
    });

    it('keeps the skill map it has when it cannot be read again', async () => {
      const { gateway, mount } = setUp({
        interviewProfile: {
          uid: 'uid-1',
          status: 'loaded',
          items: [itemFixture()],
        },
      });
      mount();
      gateway.getItems.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Unknown),
      );

      await act(async () => {
        await actions.refreshItems();
      });

      expect(screen.getByText('loaded: [] 1 items')).toBeInTheDocument();
      expect(mockLogger.logError).toHaveBeenCalledWith(
        new Error('getItems failed: code=profile/unknown uid=uid-1'),
      );
    });

    it('reads everything again after a failed load', async () => {
      const { gateway, mount } = setUp();
      gateway.getResources.mockRejectedValueOnce(
        new ProfileError(ProfileErrorCode.Network),
      );
      mount();
      await screen.findByText(/^error:/);
      gateway.getResources.mockResolvedValue([resourceFixture()]);

      await act(async () => {
        await actions.reload();
      });

      expect(
        screen.getByText('loaded: [r1=ready] 0 items'),
      ).toBeInTheDocument();
    });

    it('does nothing without a provider, and says so when asked to read', async () => {
      const Bare = () => {
        const bare = useInterviewProfileActions();
        return (
          <button
            type="button"
            onClick={() => {
              bare.watchResource('r1');
              bare.reload().catch(() => undefined);
            }}>
            go
          </button>
        );
      };
      const store = createStore();
      render(
        <Provider store={store}>
          <Bare />
        </Provider>,
      );

      expect(() => screen.getByRole('button').click()).not.toThrow();
    });
  });
});
