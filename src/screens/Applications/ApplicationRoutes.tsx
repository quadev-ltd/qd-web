import { Outlet } from 'react-router';

import { ApplicationsProvider } from '@/core/profile/ApplicationsProvider';

/**
 * The routes of the job applications, inside the profile's routes (ProfileRoutes): those
 * give them the flag, the gateway and the profile; this adds the applications.
 */
export const ApplicationRoutes: React.FC = () => (
  <ApplicationsProvider>
    <Outlet />
  </ApplicationsProvider>
);

export default ApplicationRoutes;
