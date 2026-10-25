// Where the CV pages lead (D96): a version opened from an application's CV tab keeps the
// application in its address, so its way back, removing it, comparing and the versions it opens
// stay under that application. Opened from CVs, the CV section's own addresses.
import { useMemo } from 'react';
import { useParams } from 'react-router';

import {
  applicationCvComparePath,
  applicationCvPath,
  applicationCvVersionPath,
  CV_PATH,
  cvComparePath,
  cvVersionPath,
} from '@/core/profile/paths';

export interface CvPaths {
  /** The application whose CV tab the page belongs to; none in the CV section. */
  applicationId?: string;
  /** The list the versions are in: the application's CV tab, or CVs. */
  list: string;
  version: (versionId: string) => string;
  compare: (later: string, earlier?: string) => string;
}

/** The paths of where the page is, or of the application given (its CV tab knows it). */
export const useCvPaths = (forApplication?: string): CvPaths => {
  const params = useParams();
  const applicationId = forApplication ?? params.applicationId;
  return useMemo(
    () =>
      applicationId
        ? {
            applicationId,
            list: applicationCvPath(applicationId),
            version: versionId =>
              applicationCvVersionPath(applicationId, versionId),
            compare: (later, earlier) =>
              applicationCvComparePath(applicationId, later, earlier),
          }
        : { list: CV_PATH, version: cvVersionPath, compare: cvComparePath },
    [applicationId],
  );
};

export default useCvPaths;
