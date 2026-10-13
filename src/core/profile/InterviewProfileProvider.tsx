// Keeps the `interviewProfile` slice in step with the profile gateway, as SessionProvider
// does for the session: it reads the profile when the first profile page opens, follows the
// resources the backend is still reading, and gives the pages the few things they ask for
// by name (read this resource again, read the skill map again).
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { type ProfileResource } from './contract';
import { logProfileError } from './errors';
import { useProfileGateway } from './ProfileGatewayProvider';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectInterviewProfile } from '@/core/state/selectors/interviewProfile';
import {
  itemsLoaded,
  profileLoaded,
  profileLoadFailed,
  profileLoadStarted,
  resourceChanged,
  resourceRemoved,
} from '@/core/state/slices/interviewProfileSlice';

/** How often a resource that is being read is read again. */
export const RESOURCE_POLL_MS = 2000;
/**
 * How long a resource is followed. The backend gives a reading 3 minutes; after that the
 * resource is stuck, and reading it again every 2 seconds would go on for ever.
 */
export const RESOURCE_WATCH_MS = 3 * 60 * 1000;

/** The backend has not finished with it: its content has not arrived, or is being read. */
export const isPending = ({ status }: Pick<ProfileResource, 'status'>) =>
  status === 'awaitingUpload' || status === 'processing';

export interface InterviewProfileActions {
  /** Reads the whole profile again (after "could not load"). */
  reload(): Promise<void>;
  /**
   * Reads one resource again and puts the answer in the list; removes it from the list when
   * it no longer exists. Resolves the resource, or `null`.
   */
  refreshResource(resourceId: string): Promise<ProfileResource | null>;
  /** Reads the skill map again. */
  refreshItems(): Promise<void>;
  /** Follows a resource this page just added until it is read, whatever its clock says. */
  watchResource(resourceId: string): void;
}

const notMounted = () =>
  Promise.reject(new Error('InterviewProfileProvider is not mounted'));

const InterviewProfileContext = createContext<InterviewProfileActions>({
  reload: notMounted,
  refreshResource: notMounted,
  refreshItems: notMounted,
  watchResource: () => undefined,
});

/**
 * Mount it inside ProfileGatewayProvider, around the profile pages. It stops following the
 * profile when the user leaves those pages, and catches up when they come back.
 */
export const InterviewProfileProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const profile = useAppSelector(selectInterviewProfile);
  // The polling reads the latest list without restarting at every change of it.
  const resources = useRef(profile.resources);
  useEffect(() => {
    resources.current = profile.resources;
  }, [profile.resources]);
  // When this page started following a resource it added (its own clock).
  const watchedSince = useRef(new Map<string, number>());

  const refreshItems = useCallback(async () => {
    if (!uid) {
      return;
    }
    try {
      dispatch(itemsLoaded(await gateway.getItems(uid)));
    } catch (error) {
      // The list on screen is older than it could be; the next change reads it again.
      logProfileError('getItems', error, uid);
    }
  }, [dispatch, gateway, uid]);

  const refreshResource = useCallback(
    async (resourceId: string) => {
      if (!uid) {
        return null;
      }
      const resource = await gateway.getResource(uid, resourceId);
      dispatch(
        resource ? resourceChanged(resource) : resourceRemoved(resourceId),
      );
      return resource;
    },
    [dispatch, gateway, uid],
  );

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(profileLoadStarted(uid));
    try {
      const [loaded, items, extractionsToday] = await Promise.all([
        gateway.getResources(uid),
        gateway.getItems(uid),
        // Only used to say "today's limit is reached" early: the backend refuses anyway.
        gateway.getExtractionsToday(uid).catch(() => 0),
      ]);
      dispatch(
        profileLoaded({ uid, resources: loaded, items, extractionsToday }),
      );
    } catch (error) {
      logProfileError('loadProfile', error, uid);
      dispatch(profileLoadFailed(uid));
    }
  }, [dispatch, gateway, uid]);

  /** Reads again the resources given, and the skill map when one of them was just read. */
  const catchUp = useCallback(
    async (pending: ProfileResource[]) => {
      const answers = await Promise.all(
        pending.map(({ id }) =>
          refreshResource(id).catch(() => undefined as undefined),
        ),
      );
      // A failed read is tried again at the next round. A resource that added nothing
      // leaves the skill map as it is.
      if (
        answers.some(
          answer => answer?.status === 'ready' && answer.itemCount > 0,
        )
      ) {
        await refreshItems();
      }
    },
    [refreshItems, refreshResource],
  );

  // The first profile page of the session reads everything. Coming back to the profile
  // later, only what was unfinished is read again.
  const { status } = profile;
  const loadedFor = profile.uid;
  useEffect(() => {
    if (!uid) {
      return;
    }
    if (loadedFor !== uid || status === 'idle') {
      reload();
    } else if (status === 'loaded') {
      catchUp(resources.current.filter(isPending));
    }
    // Once per mount and per user: `status` changes while this effect's own work runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // While the backend reads a resource, read it again every 2 seconds. The list of items is
  // not read here: each item is a billed read (see `catchUp`).
  const pendingIds = profile.resources
    .filter(isPending)
    .map(({ id }) => id)
    .join(',');
  useEffect(() => {
    if (!uid || !pendingIds) {
      return undefined;
    }
    let busy = false;
    const timer = setInterval(async () => {
      if (busy) {
        return;
      }
      const now = Date.now();
      const followed = resources.current.filter(resource => {
        const since =
          watchedSince.current.get(resource.id) ??
          resource.updatedAt ??
          resource.createdAt ??
          0;
        return isPending(resource) && now - since < RESOURCE_WATCH_MS;
      });
      if (followed.length === 0) {
        return;
      }
      busy = true;
      try {
        await catchUp(followed);
      } finally {
        busy = false;
      }
    }, RESOURCE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [catchUp, pendingIds, uid]);

  const actions = useMemo<InterviewProfileActions>(
    () => ({
      reload,
      refreshResource,
      refreshItems,
      watchResource: resourceId => {
        watchedSince.current.set(resourceId, Date.now());
      },
    }),
    [refreshItems, refreshResource, reload],
  );

  return (
    <InterviewProfileContext.Provider value={actions}>
      {children}
    </InterviewProfileContext.Provider>
  );
};

/** The interview profile as the pages last read it. */
export const useInterviewProfile = () => useAppSelector(selectInterviewProfile);

/** What a profile page can ask for: see InterviewProfileActions. */
export const useInterviewProfileActions = (): InterviewProfileActions =>
  useContext(InterviewProfileContext);

export default InterviewProfileProvider;
