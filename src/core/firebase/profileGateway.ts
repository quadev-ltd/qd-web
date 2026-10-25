import {
  createApplication,
  getApplication,
  getApplications,
  getBriefsToday,
  getProfileRevision,
  prepareBrief,
  readPostingAgain,
  removeApplication,
  updateApplication,
} from './applications';
import { getCvDetails, updateCvDetails } from './cvDetails';
import {
  answerCvQuestion,
  copyCvVersion,
  createCvVersion,
  decideCvChange,
  getCvVersion,
  getCvVersions,
  getCvVersionsToday,
  markCvVersionSent,
  removeCvVersion,
  reviseCvLine,
  rewriteCvVersion,
} from './cvVersions';
import {
  createResource,
  getExtractionsToday,
  getFileUrl,
  getItems,
  getResource,
  getResources,
  getResourceText,
  readLinkAgain,
  removeItem,
  removeResource,
  updateItem,
  uploadFile,
} from './interviewProfile';
import {
  createInterview,
  getInterview,
  getInterviewQuestionsToday,
  getInterviews,
  removeInterview,
  updateInterview,
  writeInterviewQuestions,
} from './interviews';
import { getUsageLimits } from './usageLimits';

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
  readLinkAgain,
  getFileUrl,
  getResourceText,
  getApplications,
  getApplication,
  getProfileRevision,
  createApplication,
  updateApplication,
  removeApplication,
  prepareBrief,
  readPostingAgain,
  getBriefsToday,
  getInterviews,
  getInterview,
  createInterview,
  updateInterview,
  removeInterview,
  writeInterviewQuestions,
  getInterviewQuestionsToday,
  getCvVersions,
  getCvVersion,
  createCvVersion,
  removeCvVersion,
  getCvVersionsToday,
  decideCvChange,
  answerCvQuestion,
  markCvVersionSent,
  copyCvVersion,
  reviseCvLine,
  rewriteCvVersion,
  getUsageLimits,
  getCvDetails,
  updateCvDetails,
});

export default createFirebaseProfileGateway;
