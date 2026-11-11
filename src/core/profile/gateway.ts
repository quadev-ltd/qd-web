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
  type CoverLetter,
  type CreateCoverLetterRequest,
  type ReviseCoverLetterSentenceRequest,
  type RewriteCoverLetterRequest,
} from './coverLetters';
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
  type ReviseCvLineRequest,
} from './cvVersions';
import {
  type ApplicationInterview,
  type CreateInterviewRequest,
  type UpdateInterviewRequest,
} from './interviews';
import {
  type AnswerMockQuestionRequest,
  type MockLineRequest,
  type MockLines,
  type MockPlayed,
  type MockSession,
  type PauseMockInterviewRequest,
  type RetryMockFeedbackRequest,
  type SendMockFeedbackRequest,
  type StartMockInterviewRequest,
} from './mockInterviews';
import {
  type AnswerPracticeTurnRequest,
  type DictatePracticeAnswerRequest,
  type PracticeTurn,
  type StartPracticeTurnRequest,
} from './practice';
import { type StoredUsageLimits } from './usageLimits';

import { type LiveSocket, type LiveTokens } from '@/core/mock/liveProtocol';

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
  /**
   * Removes an application, its brief and its interviews. Its practice stays, marked, unless
   * `removePractice` (D99).
   */
  removeApplication(
    applicationId: string,
    options?: { removePractice?: boolean },
  ): Promise<void>;
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

  // ---------- The interviews of an application (D89) ----------

  /** The interviews of one application, the earliest first. */
  getInterviews(
    uid: string,
    applicationId: string,
  ): Promise<ApplicationInterview[]>;
  /** One interview; `null` when it does not exist (any more). */
  getInterview(
    uid: string,
    applicationId: string,
    interviewId: string,
  ): Promise<ApplicationInterview | null>;
  /**
   * Adds an interview. The backend works out when it starts from the date, the time and the
   * zone, and adds it to the application's `interviewTimes`.
   */
  createInterview(
    request: CreateInterviewRequest,
  ): Promise<{ interviewId: string }>;
  /** Resolves the interview's revision after the change. */
  updateInterview(
    request: UpdateInterviewRequest,
  ): Promise<{ revision: number }>;
  removeInterview(applicationId: string, interviewId: string): Promise<void>;
  /**
   * Writes an interview's likely questions (text practice, D94), replacing the ones it had: one
   * model call, 5 to 15 seconds. The list is then on the interview (`getInterview`).
   */
  writeInterviewQuestions(
    applicationId: string,
    interviewId: string,
  ): Promise<{ questions: number }>;
  /** How many lists of likely questions were written for this user today (UTC), for the limit. */
  getInterviewQuestionsToday(uid: string): Promise<number>;

  // ---------- Cover letters (D98) ----------

  /** The letters of one application, in no order. */
  getApplicationLetters(
    uid: string,
    applicationId: string,
  ): Promise<CoverLetter[]>;
  /** One letter; `null` when it does not exist (any more). */
  getCoverLetter(uid: string, letterId: string): Promise<CoverLetter | null>;
  /**
   * Asks for a letter: stored as `creating` at once, then written by the model in the background
   * (under a minute) and `ready` or `failed`. Resolves its id.
   */
  createCoverLetter(
    request: CreateCoverLetterRequest,
  ): Promise<{ letterId: string }>;
  /** Marks a ready letter as the one sent with its application, or not; one per application. */
  markCoverLetterSent(letterId: string, sent: boolean): Promise<void>;
  /** Removes a letter, in any state. */
  removeCoverLetter(letterId: string): Promise<void>;
  /** How many letters were written for this user today (UTC), for the limit. */
  getCoverLettersToday(uid: string): Promise<number>;
  /**
   * "Write this letter again" from a ready letter: a new letter, written in the background, with
   * the candidate's answers and edits; the original doesn't change. Resolves the new one's id.
   */
  rewriteCoverLetter(
    letterId: string,
    request: RewriteCoverLetterRequest,
  ): Promise<{ letterId: string }>;
  /** Edits one sentence of a ready letter, removes it (kept to restore), or restores it. */
  reviseCoverLetterSentence(
    letterId: string,
    sentenceId: string,
    request: ReviseCoverLetterSentenceRequest,
  ): Promise<void>;
  /** Answers one question, or skips it without an answer. Resolves how many are still open. */
  answerCoverLetterQuestion(
    letterId: string,
    questionId: string,
    answer?: string,
  ): Promise<{ open: number }>;
  /** "Save my version": the body as the candidate wrote it, in place. */
  saveCoverLetterText(letterId: string, text: string): Promise<void>;
  /** "Restore the written letter" after "Save my version". */
  restoreCoverLetterText(letterId: string): Promise<void>;

  // ---------- Text practice (D94) ----------

  /** Every practice turn (500 at most), the most recently practised first: Sessions. */
  getPracticeTurns(uid: string): Promise<PracticeTurn[]>;
  /** How many practice turns one application has, there or removed (D99). */
  countApplicationPractice(uid: string, applicationId: string): Promise<number>;
  /**
   * Removes every practice turn and mock interview of one application, there or removed (D99,
   * D100).
   */
  removeApplicationPractice(
    applicationId: string,
  ): Promise<{ removed: number; removedSessions: number }>;
  /** One practice turn; `null` when it does not exist (any more). */
  getPracticeTurn(uid: string, turnId: string): Promise<PracticeTurn | null>;
  /** The turns of one list of an interview's likely questions (its `listId`), in no order. */
  getListPracticeTurns(
    uid: string,
    interviewId: string,
    listId: string,
  ): Promise<PracticeTurn[]>;
  /** The turns of an application's brief questions, in no order. */
  getBriefPracticeTurns(
    uid: string,
    applicationId: string,
  ): Promise<PracticeTurn[]>;
  /**
   * Starts practising a question: its key points are written from the profile (one model call,
   * 5 to 15 seconds) and the turn is stored. A question of an interview's list without a
   * `listId` gives the list one: read the interview again after.
   */
  startPracticeTurn(
    request: StartPracticeTurnRequest,
  ): Promise<{ turnId: string }>;
  /**
   * Gets feedback on a typed answer (one model call, 5 to 15 seconds, a minute at most), stored
   * as the turn's last attempt: read the turn again after. A failed attempt stores nothing.
   */
  answerPracticeTurn(
    request: AnswerPracticeTurnRequest,
  ): Promise<{ attempts: number }>;
  removePracticeTurn(turnId: string): Promise<void>;
  /** How many practice calls were made for this user today (UTC), for the limit. */
  getPracticeToday(uid: string): Promise<number>;
  /**
   * Turns a recorded answer into its words (D102, a few seconds), for the page to add to the
   * answer. Nothing is stored.
   */
  dictatePracticeAnswer(
    request: DictatePracticeAnswerRequest,
  ): Promise<{ text: string; words: number }>;
  /** How many dictations were made for this user today (UTC), for their own limit. */
  getDictationsToday(uid: string): Promise<number>;

  // ---------- Mock interviews (D100) ----------

  /** Every mock interview (200 at most), the most recently changed first: Sessions. */
  getMockSessions(uid: string): Promise<MockSession[]>;
  /** One interview's mock interviews (doc 24 §19), in no order. */
  getInterviewMockSessions(
    uid: string,
    interviewId: string,
  ): Promise<MockSession[]>;
  /** One mock interview; `null` when it does not exist (any more). */
  getMockSession(uid: string, sessionId: string): Promise<MockSession | null>;
  /** How many mock interviews the account keeps: none yet shows "Before you start". */
  countMockSessions(uid: string): Promise<number>;
  /** How many mock interviews one application has, there or removed (D99). */
  countApplicationMockSessions(
    uid: string,
    applicationId: string,
  ): Promise<number>;
  /**
   * Starts a mock interview: its question plan is written (one model call) and its first two
   * lines voiced, 5 to 15 seconds. Stored only when it succeeds; counts as one session today. The
   * real-time ways voice nothing here: `connect.url` is where the interview is spoken (§15.2).
   */
  startMockInterview(
    request: StartMockInterviewRequest,
  ): Promise<{ sessionId: string; connect?: { url: string } } & MockLines>;
  /** Sends a recorded answer; resolves the next line: a follow-up, the next question or the closing. */
  answerMockQuestion(
    request: AnswerMockQuestionRequest,
  ): Promise<{ turnId: string; transcript: string } & MockLines>;
  /** "Say it differently": the question's other wording, which becomes the line to answer. */
  rephraseMockQuestion(request: MockLineRequest): Promise<MockLines>;
  /** Skips the question: the next one, or the closing. */
  skipMockQuestion(request: MockLineRequest): Promise<MockLines>;
  /** Stops or starts the session's clock (the tab left, or back). */
  pauseMockInterview(
    request: PauseMockInterviewRequest,
  ): Promise<{ paused: boolean; timeLeftMs: number }>;
  /**
   * After a reload or a lost connection: the line waiting for an answer, voiced again. The
   * real-time ways say nothing here: `connect.url` is where to connect again.
   */
  resumeMockInterview(
    sessionId: string,
  ): Promise<MockLines & { paused: boolean; connect?: { url: string } }>;
  /** Ends it now ("End interview"). Ending it twice is the same as once. */
  endMockInterview(sessionId: string, played?: MockPlayed[]): Promise<void>;
  /** "How did it go?", once it ended. Sending again replaces it. */
  sendMockFeedback(request: SendMockFeedbackRequest): Promise<void>;
  /**
   * "Try again" on an answer's feedback or the overall view (D101): it answers at once, and the
   * backend writes it again in the background.
   */
  retryMockFeedback(request: RetryMockFeedbackRequest): Promise<void>;
  removeMockSession(sessionId: string): Promise<void>;
  /** How many mock interviews were started today (UTC), for the limit. */
  getMockInterviewsToday(uid: string): Promise<number>;
  /** The real-time ways: what the relay's `hello` proves the page and its user with (§15.2). */
  getLiveTokens(): Promise<LiveTokens>;
  /** The real-time ways: a connection to the relay at `url`. */
  openLiveSocket(url: string): LiveSocket;

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
  /**
   * Revises one line or one role of a written version (D83): edits it in the candidate's words,
   * removes it (kept, to be restored), or restores what was written.
   */
  reviseCvLine(versionId: string, request: ReviseCvLineRequest): Promise<void>;
  /**
   * "Write again": a new written version for the same target and length, from the profile as it
   * is now, the answers, and the lines edited and removed. Made in the background, like a new
   * one; the version written again from doesn't change. Resolves the new one's id.
   */
  rewriteCvVersion(
    versionId: string,
    /** What the candidate asks of it (D97), as the panel shows it; empty: nothing. */
    asked?: string,
  ): Promise<{ versionId: string }>;
  /**
   * "Add it to my profile as a note" (D97): one line of what was asked (`N…`) as a note resource,
   * read as any note is. The statement then has its `resourceId`.
   */
  addCvNoteToProfile(
    versionId: string,
    statementId: string,
    title: string,
  ): Promise<{ resourceId: string }>;

  /**
   * The user's overrides of the AI services' daily limits (`usageLimits/{uid}`); `null` when
   * there are none, and the defaults apply.
   */
  getUsageLimits(uid: string): Promise<StoredUsageLimits | null>;

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
