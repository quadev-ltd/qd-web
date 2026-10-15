// Keeps the `applications` slice in step with the profile gateway, as InterviewProfileProvider
// does for the resources: it reads the applications, with the profile's revision, when the
// first page that shows them opens, and gives the pages what they ask for by name.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { type JobApplication } from './applications';
import { logProfileError } from './errors';
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
} from '@/core/state/slices/applicationsSlice';

export interface ApplicationsActions {
  /** Reads the applications again (after "could not load"). */
  reload(): Promise<void>;
  /**
   * Reads one application again and puts the answer in the list; takes it out when it no
   * longer exists. Resolves the application, or `null`.
   */
  refreshApplication(applicationId: string): Promise<JobApplication | null>;
}

const notMounted = () =>
  Promise.reject(new Error('ApplicationsProvider is not mounted'));

const ApplicationsContext = createContext<ApplicationsActions>({
  reload: notMounted,
  refreshApplication: notMounted,
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
  const { uid: loadedFor, status } = useAppSelector(selectApplications);

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

  useEffect(() => {
    if (uid && (loadedFor !== uid || status === 'idle')) {
      reload();
    }
    // Once per mount and per user: `status` changes while this effect's own work runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  const actions = useMemo<ApplicationsActions>(
    () => ({ reload, refreshApplication }),
    [refreshApplication, reload],
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
