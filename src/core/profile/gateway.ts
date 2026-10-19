import {
  type CreateJobApplicationRequest,
  type JobApplication,
  type UpdateJobApplicationRequest,
} from './applications';
import {
  type CreateProfileResourceRequest,
  type ProfileResource,
  type ProfileResourceText,
  type ProfileUploadContentType,
  type SkillMapItem,
} from './contract';
import {
  type CvDetails,
  type CvDetailsField,
  type UpdateCvDetailsRequest,
} from './cvDetails';
import {
  type CreateCvVersionRequest,
  type CvChangeDecisionRequest,
  type CvVersion,
  type CvVersionStatus,
} from './cvVersions';

/** Where a file goes, as `createResource` answers for a file. */
export interface UploadTarget {
  /** Cloud Storage path in the default bucket. */
  path: string;
  contentType: ProfileUploadContentType;
  maxBytes: number;
}

export interface CreatedResource {
  resourceId: string;
  /** Only for a file: upload it here, once. */
  upload?: UploadTarget;
}

export interface UploadOptions {
  /** Called as the file goes up, with the part sent so far (0 to 1). */
  onProgress?: (fraction: number) => void;
  /** Stops the upload; it then rejects with ProfileErrorCode.UploadCancelled. */
  signal?: AbortSignal;
}

/** One change at least: new text, a star, or hiding the item. */
export interface ItemChange {
  text?: string;
  starred?: boolean;
  hidden?: boolean;
}

/**
 * The boundary between the profile screens and the backend of the interview profile
 * (quadev-backend, codebase `interview-profile`), as AuthGateway is for the account
 * (docs/adr/0007-interview-profile.md).
 *
 * Reads go straight to the owner's documents; every change is a callable. A resource is
 * read by the backend after it is created, so its status is followed by reading it again
 * (`getResource`): there is no live listener.
 *
 * Every function rejects with a ProfileError (./errors.ts). Implementations:
 * - `unavailableProfileGateway`: the default; every call fails with "unavailable".
 * - `previewProfileGateway`: an in-memory fake for local preview and tests only.
 * - the Firebase one (`src/core/firebase/profileGateway.ts`).
 */
export interface ProfileGateway {
  // ---------- Reads ----------

  /** The resources of the profile, newest first. */
  getResources(uid: string): Promise<ProfileResource[]>;
  /** One resource; `null` when it does not exist (any more). */
  getResource(uid: string, resourceId: string): Promise<ProfileResource | null>;
  /**
   * Every item of the skill map, in no particular order: the pages sort them. Each item
   * is a billed read, so call this when a page opens and after a change, not while waiting
   * for a resource.
   */
  getItems(uid: string): Promise<SkillMapItem[]>;
  /** How many resources were read for this user today (UTC), for the daily limit. */
  getExtractionsToday(uid: string): Promise<number>;

  // ---------- Changes ----------

  /**
   * Adds a resource. Text and links are stored and read by the backend straight away. A
   * file is not sent here: the answer says where to upload it (`uploadFile`).
   */
  createResource(
    request: CreateProfileResourceRequest,
  ): Promise<CreatedResource>;
  /**
   * Uploads the file of a resource to the place `createResource` answered, with its
   * content type, once. A finished upload cannot be repeated: a new attempt is a new
   * resource.
   */
  uploadFile(
    target: UploadTarget,
    file: Blob,
    options?: UploadOptions,
  ): Promise<void>;
  /** Changes one item of the skill map. */
  updateItem(itemId: string, change: ItemChange): Promise<void>;
  removeItem(itemId: string): Promise<void>;
  /** Removes a resource, its stored content and every item that came from it. */
  removeResource(resourceId: string): Promise<{ itemsRemoved: number }>;
  /**
   * Reads the page of a link again, in the background (D78, research doc 17): a link that was
   * read keeps its copy until the new one is in (`refresh`); one whose first reading failed is
   * read from the start (`status`). Resolves once it has started: follow the resource.
   */
  readLinkAgain(resourceId: string): Promise<void>;

  // ---------- The original file ----------

  /** An address that downloads the file of a resource, to open as a normal link. */
  getFileUrl(resource: Pick<ProfileResource, 'storagePath'>): Promise<string>;
  /**
   * The text kept of one resource (D78), when it has `textAt`; `null` when there is none.
   * Read one at a time, on the resource's page: a list never loads texts.
   */
  getResourceText(
    uid: string,
    resourceId: string,
  ): Promise<ProfileResourceText | null>;

  // ---------- Job applications (delivery 2a) ----------

  /** The applications, the most recently changed first. */
  getApplications(uid: string): Promise<JobApplication[]>;
  /** One application; `null` when it does not exist (any more). */
  getApplication(
    uid: string,
    applicationId: string,
  ): Promise<JobApplication | null>;
  /**
   * The profile's revision, which goes up with every change to its resources and items. A
   * brief built from an older one is out of date. 0 before anything was added.
   */
  getProfileRevision(uid: string): Promise<number>;
  /**
   * Adds an application from its job. Text and links are read by the backend straight away; a
   * file is not sent here: the answer says where to upload it (`uploadFile`), and it is read
   * once it arrives. The application's `job.status` says when its text and names are there.
   */
  createApplication(
    request: CreateJobApplicationRequest,
  ): Promise<{ applicationId: string; upload?: UploadTarget }>;
  /** Resolves the application's revision after the change. */
  updateApplication(
    request: UpdateJobApplicationRequest,
  ): Promise<{ revision: number }>;
  /** Removes an application and its brief. */
  removeApplication(applicationId: string): Promise<void>;
  /**
   * Prepares the brief of an application, replacing the one it had: one model call, up to a
   * minute. The brief is then on the application (`getApplication`).
   */
  prepareBrief(applicationId: string): Promise<void>;
  /**
   * Reads the posting of a job from a link again, as readLinkAgain does (`job.refresh`, or
   * `job.status` after a failed first reading). Over a text the candidate edited, only with
   * `replaceEdited`: without it, ProfileErrorCode.JobEdited.
   */
  readPostingAgain(
    applicationId: string,
    options?: { replaceEdited?: boolean },
  ): Promise<void>;
  /** How many briefs were prepared for this user today (UTC), for the daily limit. */
  getBriefsToday(uid: string): Promise<number>;

  // ---------- CV versions (delivery 2b) ----------

  /** The CV versions, the newest first. */
  getCvVersions(uid: string): Promise<CvVersion[]>;
  /** One version; `null` when it does not exist (any more). */
  getCvVersion(uid: string, versionId: string): Promise<CvVersion | null>;
  /**
   * Makes a new version: stored as `creating` at once, then made by the model (about a minute)
   * and `ready` or `failed`. Resolves when it is made; the document says the same meanwhile.
   */
  createCvVersion(
    request: CreateCvVersionRequest,
  ): Promise<{ versionId: string; status: CvVersionStatus }>;
  /** Removes a version. Nothing else changes: not the CV, the profile or the other versions. */
  removeCvVersion(versionId: string): Promise<void>;
  /** How many versions were made for this user today (UTC), for the daily limit. */
  getCvVersionsToday(uid: string): Promise<number>;
  /**
   * The candidate's decision on one change of a ready version: `text` goes with `edit`, and only
   * with it. Resolves how many changes and questions are still open.
   */
  decideCvChange(
    versionId: string,
    changeId: string,
    decision: CvChangeDecisionRequest,
    text?: string,
  ): Promise<{ open: number }>;
  /** Answers a question in the candidate's words, or skips it (no answer). */
  answerCvQuestion(
    versionId: string,
    questionId: string,
    answer?: string,
  ): Promise<{ open: number }>;
  /**
   * Marks a version for a job as the one sent with the application, or not. One per
   * application: marking one unmarks the others.
   */
  markCvVersionSent(versionId: string, sent: boolean): Promise<void>;
  /**
   * "Restore": a copy of a version, with every decision and answer, which becomes the newest.
   * The version copied does not change. Resolves the copy's id.
   */
  copyCvVersion(versionId: string): Promise<{ versionId: string }>;

  // ---------- The CV's details (doc 19 §3.1) ----------

  /** The name and contact lines at the top of a CV; `null` until a field is filled. */
  getCvDetails(uid: string): Promise<CvDetails | null>;
  /**
   * Sets or clears the fields given, which a later reading of a resource then never changes.
   * Resolves the fields whose value changed.
   */
  updateCvDetails(
    request: UpdateCvDetailsRequest,
  ): Promise<{ changed: CvDetailsField[] }>;
}
