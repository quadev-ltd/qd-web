// Keeps the `applications` slice in step with the profile gateway, as InterviewProfileProvider
// does for the resources: it reads the applications, with the profile's revision, when the
// first page that shows them opens, reads the revision again on each page after that, and
// gives the pages what they ask for by name.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { isJobPending, type JobApplication } from './applications';
import { logProfileError } from './errors';
import {
  RESOURCE_POLL_MS,
  RESOURCE_WATCH_MS,
} from './InterviewProfileProvider';
import { useProfileGateway } from './ProfileGatewayProvider';

import { useSessionUser } from '@/core/session/hooks';
import { useAppDispatch, useAppSelector } from '@/core/state/hooks';
import { selectApplications } from '@/core/state/selectors/applications';
import {
  applicationChanged,
  applicationRemoved,
  applicationsLoaded,
  applicationsLoadFailed,
  applicationsLoadStarted,
  profileRevisionRead,
} from '@/core/state/slices/applicationsSlice';

export interface ApplicationsActions {
  /** Reads the applications again (after "could not load"). */
  reload(): Promise<void>;
  /**
   * Reads one application again and puts the answer in the list; takes it out when it no
   * longer exists. Resolves the application, or `null`.
   */
  refreshApplication(applicationId: string): Promise<JobApplication | null>;
  /** Reads the profile's revision again, after the page changed the profile. */
  refreshProfileRevision(): Promise<void>;
}

const notMounted = () =>
  Promise.reject(new Error('ApplicationsProvider is not mounted'));

const ApplicationsContext = createContext<ApplicationsActions>({
  reload: notMounted,
  refreshApplication: notMounted,
  refreshProfileRevision: notMounted,
});

/**
 * Mount it inside ProfileGatewayProvider, around the pages that show applications. The first
 * of them in a session reads the applications; the next ones use what the store has.
 */
export const ApplicationsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const gateway = useProfileGateway();
  const dispatch = useAppDispatch();
  const uid = useSessionUser()?.uid ?? null;
  const {
    uid: loadedFor,
    status,
    applications,
  } = useAppSelector(selectApplications);
  // The polling reads the latest list without restarting at every change of it.
  const latest = useRef(applications);
  useEffect(() => {
    latest.current = applications;
  }, [applications]);

  const reload = useCallback(async () => {
    if (!uid) {
      return;
    }
    dispatch(applicationsLoadStarted(uid));
    try {
      const [applications, profileRevision] = await Promise.all([
        gateway.getApplications(uid),
        // Only used to say a brief is out of date: without it, none is said to be.
        gateway.getProfileRevision(uid).catch(() => null),
      ]);
      dispatch(applicationsLoaded({ uid, applications, profileRevision }));
    } catch (error) {
      logProfileError('getApplications', error, uid);
      dispatch(applicationsLoadFailed(uid));
    }
  }, [dispatch, gateway, uid]);

  const refreshApplication = useCallback(
    async (applicationId: string) => {
      if (!uid) {
        return null;
      }
      const application = await gateway.getApplication(uid, applicationId);
      dispatch(
        application
          ? applicationChanged(application)
          : applicationRemoved(applicationId),
      );
      return application;
    },
    [dispatch, gateway, uid],
  );

  const refreshProfileRevision = useCallback(async () => {
    if (!uid) {
      return;
    }
    try {
      dispatch(profileRevisionRead(await gateway.getProfileRevision(uid)));
    } catch {
      // The revision on screen stays: a brief is said to be out of date a little later.
    }
  }, [dispatch, gateway, uid]);

  useEffect(() => {
    if (uid && (loadedFor !== uid || status === 'idle')) {
      reload();
    } else if (uid && status === 'loaded') {
      // Coming back from the profile: one read says whether briefs went out of date.
      refreshProfileRevision();
    }
    // Once per mount and per user: `status` changes while this effect's own work runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // While the backend reads the job of an application, read it again every 2 seconds, for
  // as long as a resource is followed (the backend gives a reading 3 minutes).
  const pendingIds = applications
    .filter(isJobPending)
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
      const time = Date.now();
      const followed = latest.current.filter(
        application =>
          isJobPending(application) &&
          time - (application.updatedAt ?? application.createdAt ?? 0) <
            RESOURCE_WATCH_MS,
      );
      if (followed.length === 0) {
        return;
      }
      busy = true;
      try {
        await Promise.all(
          followed.map(({ id }) => refreshApplication(id).catch(() => null)),
        );
      } finally {
        busy = false;
      }
    }, RESOURCE_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [pendingIds, refreshApplication, uid]);

  const actions = useMemo<ApplicationsActions>(
    () => ({ reload, refreshApplication, refreshProfileRevision }),
    [refreshApplication, refreshProfileRevision, reload],
  );

  return (
    <ApplicationsContext.Provider value={actions}>
      {children}
    </ApplicationsContext.Provider>
  );
};

/** The applications as the pages last read them. */
export const useApplications = () => useAppSelector(selectApplications);

/** What an application page can ask for: see ApplicationsActions. */
export const useApplicationsActions = (): ApplicationsActions =>
  useContext(ApplicationsContext);

export default ApplicationsProvider;
