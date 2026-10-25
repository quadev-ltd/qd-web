import { ProfileError, ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';

const unavailable = () =>
  Promise.reject(new ProfileError(ProfileErrorCode.Unavailable));

/**
 * The default profile gateway: no backend is connected, so every call fails with
 * "unavailable". It makes no network request. It is what a build without the account
 * screens contains, and what a spec gets without a provider.
 */
export const unavailableProfileGateway: ProfileGateway = {
  getResources: unavailable,
  getResource: unavailable,
  getItems: unavailable,
  getExtractionsToday: unavailable,
  createResource: unavailable,
  uploadFile: unavailable,
  updateItem: unavailable,
  removeItem: unavailable,
  removeResource: unavailable,
  readLinkAgain: unavailable,
  getFileUrl: unavailable,
  getResourceText: unavailable,
  getApplications: unavailable,
  getApplication: unavailable,
  getProfileRevision: unavailable,
  createApplication: unavailable,
  updateApplication: unavailable,
  removeApplication: unavailable,
  prepareBrief: unavailable,
  readPostingAgain: unavailable,
  getBriefsToday: unavailable,
  getInterviews: unavailable,
  getInterview: unavailable,
  createInterview: unavailable,
  updateInterview: unavailable,
  removeInterview: unavailable,
  writeInterviewQuestions: unavailable,
  getInterviewQuestionsToday: unavailable,
  getCvVersions: unavailable,
  getCvVersion: unavailable,
  createCvVersion: unavailable,
  removeCvVersion: unavailable,
  getCvVersionsToday: unavailable,
  decideCvChange: unavailable,
  answerCvQuestion: unavailable,
  markCvVersionSent: unavailable,
  copyCvVersion: unavailable,
  reviseCvLine: unavailable,
  rewriteCvVersion: unavailable,
  getUsageLimits: unavailable,
  getCvDetails: unavailable,
  updateCvDetails: unavailable,
};

export default unavailableProfileGateway;
