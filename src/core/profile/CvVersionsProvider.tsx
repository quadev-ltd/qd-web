// Keeps the `cvVersions` slice in step with the profile gateway, as ApplicationsProvider does
// for the applications: it reads the versions and today's count when the first CV page opens,
// follows a version while the backend makes it, and gives the pages what they ask for by name.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { type CvDetailsField, type UpdateCvDetailsRequest } from './cvDetails';
import { type CvVersion, isCreating } from './cvVersions';
import { logProfileError } from './errors';
import { RESOURCE_POLL_MS } from './InterviewProfileProvider';
import { useProfileGateway } from './ProfileGatewayProvider';
import {
  CV_VERSION_DAILY_LIMIT,
  effectiveLimits,
  USAGE_SERVICES,
} from './usageLimits';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectCvVersions } from '@/core/state/selectors/cvVersions';
import {
  cvDetailsLoaded,
  cvDetailsLoadFailed,
  cvDetailsLoadStarted,
  cvVersionChanged,
  cvVersionRemoved,
  cvVersionsLoaded,
  cvVersionsLoadFailed,
  cvVersionsLoadStarted,
  cvVersionsTodayRead,
} from '@/core/state/slices/cvVersionsSlice';

export interface CvVersionsActions {
  /** Reads the versions again (after "could not load"). */
  reload(): Promise<void>;
  /**
   * Reads one version again and puts the answer in the list; takes it out when it no longer
   * exists. Resolves the version, or `null`.
   */
  refreshVersion(versionId: string): Promise<CvVersion | null>;
  /** Reads today's count again, after a version was asked for. */
  refreshToday(): Promise<void>;
  /** Reads the CV's details again (after "could not load"). */
  reloadDetails(): Promise<void>;
  /**
   * Saves the fields given (only those the candidate changed: each is then kept from a later
   * reading) and reads the details again. Resolves the fields whose value changed.
   */
  saveDetails(request: UpdateCvDetailsRequest): Promise<CvDetailsField[]>;
}

const notMounted = () =>
  Promise.reject(new Error('CvVersionsProvider is not mounted'));

const CvVersionsContext = createContext<CvVersionsActions>({
  reload: notMounted,
  refreshVersion: notMounted,
  refreshToday: notMounted,
  reloadDetails: notMounted,
  saveDetails: notMounted,
});

/**
 * Mount it inside ProfileGatewayProvider, around the CV pages. The first of them in a session
 * reads the versions; the next ones use what the store has. The CV's details are read each time
 * the CV pages open, since reading a resource in the profile can fill them meanwhile.
 */
export const CvVersionsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const { uid: loadedFor, status, versions } = useAppSelector(selectCvVersions);
  // The polling reads the latest list without restarting at every change of it.
  const latest = useRef(versions);
  useEffect(() => {
    latest.current = versions;
  }, [versions]);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(cvVersionsLoadStarted(uid));
    try {
      const [loaded, madeToday, limits] = await Promise.all([
        gateway.getCvVersions(uid),
        // Only used to say "4 of 5 left today": the backend refuses anyway.
        gateway.getCvVersionsToday(uid).catch(() => null),
        gateway.getUsageLimits(uid).catch(() => null),
      ]);
      dispatch(cvVersionsLoaded({ uid, versions: loaded, madeToday, limits }));
    } catch (error) {
      logProfileError('getCvVersions', error, uid);
      dispatch(cvVersionsLoadFailed(uid));
    }
  }, [dispatch, gateway, uid]);

  const refreshVersion = useCallback(
    async (versionId: string) => {
      if (!uid) {
        return null;
      }
      const version = await gateway.getCvVersion(uid, versionId);
      dispatch(
        version ? cvVersionChanged(version) : cvVersionRemoved(versionId),
      );
      return version;
    },
    [dispatch, gateway, uid],
  );

  const refreshToday = useCallback(async () => {
    if (!uid) {
      return;
    }
    try {
      const [madeToday, limits] = await Promise.all([
        gateway.getCvVersionsToday(uid),
        gateway.getUsageLimits(uid).catch(() => null),
      ]);
      dispatch(cvVersionsTodayRead({ madeToday, limits }));
    } catch {
      // The count on screen stays; the backend refuses a version over the limit anyway.
    }
  }, [dispatch, gateway, uid]);

  const reloadDetails = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(cvDetailsLoadStarted(uid));
    try {
      dispatch(
        cvDetailsLoaded({ uid, details: await gateway.getCvDetails(uid) }),
      );
    } catch (error) {
      logProfileError('getCvDetails', error, uid);
      dispatch(cvDetailsLoadFailed(uid));
    }
  }, [dispatch, gateway, uid]);

  const saveDetails = useCallback(
    async (request: UpdateCvDetailsRequest) => {
      const { changed } = await gateway.updateCvDetails(request);
      await reloadDetails();
      return changed;
    },
    [gateway, reloadDetails],
  );

  // The first CV page of the session reads the versions; coming back, the store has them.
  useEffect(() => {
    if (uid && (loadedFor !== uid || status === 'idle')) {
      reload();
    }
    reloadDetails();
    // Once per mount and per user: `status` changes while this effect's own work runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // While the backend makes a version, read it again every 2 seconds, until it is made or lost.
  const creatingIds = versions
    .filter(version => isCreating(version))
    .map(({ id }) => id)
    .join(',');
  useEffect(() => {
    if (!uid || !creatingIds) {
      return undefined;
    }
    let busy = false;
    const timer = setInterval(async () => {
      const followed = latest.current.filter(version => isCreating(version));
      if (busy || followed.length === 0) {
        return;
      }
      busy = true;
      try {
        const read = await Promise.all(
          followed.map(({ id }) => refreshVersion(id).catch(() => null)),
        );
        // A version made counts towards today's limit.
        if (read.some(version => version && version.status !== 'creating')) {
          await refreshToday();
        }
      } finally {
        busy = false;
      }
    }, RESOURCE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [creatingIds, refreshToday, refreshVersion, uid]);

  const actions = useMemo<CvVersionsActions>(
    () => ({
      reload,
      refreshVersion,
      refreshToday,
      reloadDetails,
      saveDetails,
    }),
    [refreshToday, refreshVersion, reload, reloadDetails, saveDetails],
  );

  return (
    <CvVersionsContext.Provider value={actions}>
      {children}
    </CvVersionsContext.Provider>
  );
};

export const useCvVersions = () => useAppSelector(selectCvVersions);

/**
 * How many CV versions the user can have made today: their override (`usageLimits/{uid}`) on
 * top of the default, capped at the ceiling, as the backend counts it.
 */
export const useCvDailyLimit = (): number => {
  const { limits } = useAppSelector(selectCvVersions);
  return effectiveLimits(
    CV_VERSION_DAILY_LIMIT,
    limits?.services[USAGE_SERVICES.cvVersion],
  ).maxCallsPerDay;
};

export const useCvVersionsActions = (): CvVersionsActions =>
  useContext(CvVersionsContext);

export default CvVersionsProvider;
