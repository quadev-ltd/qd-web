import {
  createApplication,
  getApplication,
  getApplications,
  getProfileRevision,
  removeApplication,
  updateApplication,
} from './applications';
import {
  createResource,
  getExtractionsToday,
  getFileUrl,
  getItems,
  getResource,
  getResources,
  removeItem,
  removeResource,
  updateItem,
  uploadFile,
} from './interviewProfile';

import { type ProfileGateway } from '@/core/profile/gateway';

/**
 * The profile gateway backed by Firebase: the owner's documents in Firestore, the callables
 * of quadev-backend and Cloud Storage.
 *
 * It is loaded with a dynamic import by the first profile page, only when the account
 * screens are on and VITE_AUTH_GATEWAY=firebase (src/core/profile/selectProfileGateway.ts).
 * It is what brings the Functions, App Check and Storage parts of the SDK into a page.
 */
export const createFirebaseProfileGateway = (): ProfileGateway => ({
  getResources,
  getResource,
  getItems,
  getExtractionsToday,
  createResource,
  uploadFile,
  updateItem,
  removeItem,
  removeResource,
  getFileUrl,
  getApplications,
  getApplication,
  getProfileRevision,
  createApplication,
  updateApplication,
  removeApplication,
});

export default createFirebaseProfileGateway;
