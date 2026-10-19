import {
  APPLICATION_NAME_MAX_CHARS,
  APPLICATION_NOTES_MAX_CHARS,
  APPLICATIONS_MAX,
  type ApplicationBrief,
  BRIEF_DAILY_LIMIT,
  type BriefQuestion,
  type BriefRequirement,
  APPLICATION_FILE_NAME_MAX_CHARS,
  type CreateJobApplicationRequest,
  isJobPending,
  JOB_DESCRIPTION_MAX_CHARS,
  type JobApplication,
  type NewJob,
} from './applications';
import {
  type CreateProfileResourceRequest,
  isRereading,
  parseProfileLink,
  PROFILE_DAILY_EXTRACTIONS,
  PROFILE_MAX_RESOURCES,
  PROFILE_TEXT_MAX_CHARS,
  PROFILE_TITLE_MAX_CHARS,
  PROFILE_UPLOAD_CONTENT_TYPES,
  PROFILE_UPLOAD_MAX_BYTES,
  type ProfileResource,
  type ProfileResourceFailure,
  type ProfileResourceText,
  RESOURCE_TYPES_BY_SOURCE,
  SKILL_MAP_ITEM_MAX_CHARS,
  type SkillMapItem,
} from './contract';
import {
  CV_DETAILS_FIELDS,
  CV_DETAILS_MAX_CHARS,
  CV_DETAILS_MAX_LINKS,
  CV_DETAILS_TEXT_FIELDS,
  type CvDetails,
  type CvDetailsField,
} from './cvDetails';
import {
  type CvDocument,
  cvDocumentLines,
  type CvEntry,
  type CvEntryFields,
  type CvLine,
} from './cvDocument';
import {
  CV_FIELD_MAX_CHARS,
  CV_LINE_MAX_CHARS,
  CV_ROLE_MAX_CHARS,
  CV_VERSIONS_MAX,
  type CvEditVersion,
  type CvStatement,
  type CvVersion,
  type CvVersionFailure,
  type CvVersionTarget,
  type CvWrittenVersion,
  isWrittenVersion,
  openReviews,
} from './cvVersions';
import { ProfileError, ProfileErrorCode } from './errors';
import { type ProfileGateway } from './gateway';
import {
  PREVIEW_CV_DETAILS,
  PREVIEW_FACTS,
  PREVIEW_SEED,
  PREVIEW_SEED_APPLICATIONS,
  type PreviewFact,
} from './previewProfileData';
import {
  CV_VERSION_DAILY_LIMIT,
  effectiveLimits,
  serviceOverride,
  type StoredUsageLimits,
  USAGE_SERVICES,
} from './usageLimits';

import { PREVIEW_GATEWAY_MARKER } from '@/core/auth/previewGateway';

/**
 * An in-memory fake of the interview profile's backend, for local preview and tests ONLY,
 * the companion of src/core/auth/previewGateway.ts. It is never part of a production
 * build: it is loaded with a dynamic import that the bundler removes unless
 * VITE_AUTH_GATEWAY=preview (./selectProfileGateway.ts), and `yarn check:bundle` looks for
 * PREVIEW_GATEWAY_MARKER, which this file carries too.
 *
 * It behaves like the backend with its fake model: a resource is "read" a moment after
 * its content arrives and gives a few fictional items (./previewProfileData.ts); a link to
 * a host ending in `.invalid` cannot be read; what the profile already has is not added
 * twice; the limits are the backend's. Profiles live in memory and in sessionStorage, per
 * account, and nothing is sent anywhere.
 *
 * `window.qdPreviewProfile` (PreviewProfileControls) stands for what a test cannot wait
 * for or cause: a reading that fails, one that never ends, a day's limit already used.
 */
const STORAGE_KEY = `${PREVIEW_GATEWAY_MARKER}-profile`;

/** How long the fake takes to "read" a resource. */
export const PREVIEW_READ_MS = 1500;
/** The fake upload: this many steps, this long each. */
const UPLOAD_STEPS = 4;
const UPLOAD_STEP_MS = 120;

interface StoredResource extends ProfileResource {
  /** When the reading ends; `null` while the content has not arrived, or never ends. */
  settlesAt: number | null;
  /** How the reading will end, decided when the resource is created. */
  outcome: ProfileResourceFailure | 'ready';
  /** For a note: what was pasted, kept as its text once it is read. */
  pasted?: string;
}

/** What the fake keeps of a file: no file is read here, so a text that says what it stands for. */
const fileTextOf = (title: string) =>
  `${title}\n\nThe text of the file, without its layout. In the real backend this is what was read from the PDF, the Word document or the text file.`;

/** What the fake keeps of a link: no page is read here, so a copy that says what it stands for. */
const pageTextOf = (url: string, again = false) =>
  `${url}\n\nThe copy of the page, as the model read it: its main text, without the menu, the cookie notice or the footer.\n\nIn the real backend\n- headings are plain lines\n- and lists are lines like these.${again ? '\n\nRead again: the page had changed.' : ''}`;

interface PreviewProfile {
  resources: StoredResource[];
  items: SkillMapItem[];
  extractionsToday: number;
  /** Absent in what an older version stored. */
  applications?: JobApplication[];
  /** Goes up with every change to the resources or the items, as the backend's does. */
  revision?: number;
  /** How many briefs were prepared today. */
  briefsToday?: number;
  /** The readings of applications' jobs, by application. */
  jobReadings?: Record<string, JobReading>;
  /** The texts kept of the resources (D78), by resource. */
  texts?: Record<string, ProfileResourceText>;
  /** The pages of links being read again, by resource. */
  pageRereads?: Record<string, Reread>;
  /** The postings of jobs being read again, by application. */
  postingRereads?: Record<string, Reread>;
  /** The CV versions (delivery 2b), the newest last. */
  cvVersions?: CvVersion[];
  /** The versions being made: when each ends, and how. */
  cvMaking?: Record<string, { settlesAt: number; failure?: CvVersionFailure }>;
  /** How many versions were made today. */
  cvVersionsToday?: number;
  /** The CV's details (doc 19 §3.1); none until a field is filled. */
  cvDetails?: CvDetails;
  /** The document a version being written again starts from, by the new version. */
  cvRewrites?: Record<string, CvDocument>;
  /** The overrides of the daily limits (`usageLimits/{uid}`); none for the defaults. */
  usageLimits?: StoredUsageLimits;
}

/** How the fake reads a page again: when it ends, and how. */
interface Reread {
  settlesAt: number;
  outcome: ProfileResourceFailure | 'changed' | 'unchanged';
}

/** How the fake reads the job of an application (research doc 17). */
interface JobReading {
  /** When the reading ends; `null` while the file has not arrived. */
  settlesAt: number | null;
  outcome: ProfileResourceFailure | 'ready';
  source: NewJob['source'];
  /** The pasted text, the address, or the file's name: what the names are read from. */
  from: string;
  /** For a file: where it is uploaded. */
  path?: string;
}

interface PreviewProfileState {
  profiles: Record<string, PreviewProfile>;
  nextId: number;
}

/** What happens outside the page, for the signed-in preview account. Test and preview only. */
export interface PreviewProfileControls {
  /** Replaces the profile with the one of the designs: six resources, one in each state. */
  seed(): void;
  /** The next resource that is added cannot be read, for this reason. */
  failNext(reason: ProfileResourceFailure): void;
  /** The next resource that is added is never read (it stays "being read"). */
  stallNext(): void;
  /** How many resources were already read today. */
  setExtractionsToday(count: number): void;
  /**
   * Replaces the applications with the three of the designs: a brief with two gaps, a brief
   * the job has changed since, and no brief yet.
   */
  seedApplications(): void;
  /** The next brief cannot be prepared: the model failed, or today's limit was reached. */
  failNextBrief(reason: 'model' | 'quota'): void;
  /** The job of the next application cannot be read, for this reason. */
  failNextJob(reason: ProfileResourceFailure): void;
  /** How many briefs were already prepared today. */
  setBriefsToday(count: number): void;
  /**
   * The next page read again (a link or a posting) has changed, or cannot be read for this
   * reason. Otherwise it says the same as before, as the backend's fake model does.
   */
  nextReread(outcome: ProfileResourceFailure | 'changed'): void;
  /** The next CV version cannot be made, for this reason. */
  failNextCv(reason: CvVersionFailure): void;
  /** How many CV versions were already made today. */
  setCvVersionsToday(count: number): void;
  /**
   * A version as they were made before D83: edits to the profile's CV (doc 18), made in the
   * background like any other. The pages no longer ask for one; their review stays. Resolves its id.
   */
  createEditVersion(target?: CvVersionTarget): Promise<string>;
  /** Sets the account's overrides of the daily limits, as set-limit does; `null` removes them. */
  setUsageLimits(services: StoredUsageLimits['services'] | null): void;
}

/** How long the fake takes to prepare a brief; the real one takes 10 to 20 seconds. */
export const PREVIEW_BRIEF_MS = 1200;
/** How long the fake takes to make a CV version; the real one takes about a minute. */
export const PREVIEW_CV_MS = 2000;

/** The lines of a CV that say something: 20 characters at least, without their list mark. */
const cvLines = (cv: string) =>
  cv
    .split('\n')
    .map(line => line.replace(/^\s*(?:[-•*▪◦–]\s+)/, '').trim())
    .filter(line => line.length >= 20);

/**
 * What the fake answers for a version, shaped as the backend's offline answer (research doc
 * 18): every passage is a real line of the CV, every change has a source.
 */
const cvAnswerFor = (
  cv: string,
  firstItem: SkillMapItem | undefined,
  jobDescription: string | undefined,
): Pick<
  CvEditVersion,
  'findings' | 'changes' | 'questions' | 'unsupportedJobTerms'
> => {
  const lines = cvLines(cv);
  const target = lines[1] ?? lines[0] ?? '';
  const last = lines.at(-1) ?? '';
  return {
    findings: [
      {
        kind: 'results',
        severity: 'medium',
        passage: target,
        text: 'Says what you did, not what came of it. A reader can’t check it.',
      },
      {
        kind: 'structure',
        severity: 'low',
        passage: '',
        text: 'The dates of your roles show the year only. A UK CV usually gives the month too.',
      },
    ],
    changes: [
      ...(target
        ? [
            {
              id: 'c1',
              action: 'rewrite' as const,
              original: target,
              after: '',
              proposed: `${target.replace(/\.$/, '')}, which cut the time it took by half.`,
              reason: 'Says what came of it, with the number your CV gives.',
              sources: [{ kind: 'cv' as const }],
              decision: 'open' as const,
            },
          ]
        : []),
      ...(firstItem && last
        ? [
            {
              id: 'c2',
              action: 'add' as const,
              original: '',
              after: last,
              proposed: firstItem.text,
              reason: 'Your profile shows it, and your CV didn’t say it.',
              sources: [{ kind: 'item' as const, itemId: firstItem.id }],
              decision: 'open' as const,
            },
          ]
        : []),
    ],
    questions: last
      ? [
          {
            id: 'q1',
            passage: last,
            text: 'How many people worked on this with you?',
            status: 'open',
          },
        ]
      : [],
    unsupportedJobTerms: jobDescription
      ? jobDescription.split(/\s+/).filter(Boolean).slice(0, 3)
      : [],
  };
};

/** "Senior Backend Engineer at Fenwick Pay, 2021 to 2026: ..." as a role's heading. */
const headingOf = (text: string) => {
  const match = /^(.+?) at ([^,]+), (\d{4}) to (\d{4}|now)/i.exec(text);
  return match
    ? {
        title: match[1],
        organisation: match[2],
        location: '',
        start: match[3],
        end: match[4],
      }
    : { title: text, organisation: '', location: '', start: '', end: '' };
};

/**
 * What the fake writer answers for a written version (D83), shaped as the backend's: a CV made
 * of the profile's visible items, the starred first, each line citing the item it comes from,
 * with notes, a question about one line, and the job's first words as terms it doesn't show.
 */
const cvWriteAnswerFor = (
  items: SkillMapItem[],
  jobDescription: string | undefined,
): Pick<
  CvWrittenVersion,
  'document' | 'notes' | 'questions' | 'unsupportedJobTerms' | 'dropped'
> => {
  const visible = [
    ...items.filter(({ starred, hidden }) => starred && !hidden),
    ...items.filter(({ starred, hidden }) => !starred && !hidden),
  ];
  let lines = 0;
  const line = (item: SkillMapItem, label?: string): CvLine => {
    lines += 1;
    return {
      id: `l${lines}`,
      text: item.text,
      ...(label ? { label } : {}),
      sources: [{ kind: 'item', itemId: item.id }],
      state: 'written',
      proposed: item.text,
    };
  };
  let entries = 0;
  const entry = (item: SkillMapItem, bullets: CvLine[]): CvEntry => {
    entries += 1;
    const heading = headingOf(item.text);
    return {
      id: `e${entries}`,
      ...heading,
      sources: [{ kind: 'item', itemId: item.id }],
      state: 'written',
      proposedFields: heading,
      bullets,
    };
  };
  const of = (kind: SkillMapItem['kind']) =>
    visible.filter(item => item.kind === kind);
  const achievements = [...of('achievement'), ...of('story')];
  const [lead] = achievements;
  const summary = lead ? [line(lead)] : [];
  const experience = of('experience').map((item, index) =>
    entry(
      item,
      index === 0
        ? achievements.slice(lead ? 1 : 0, 5).map(bullet => line(bullet))
        : [],
    ),
  );
  const projects = of('project').map(item => entry(item, []));
  const skills = of('skill').length
    ? [
        line(of('skill')[0], 'Skills'),
        ...of('skill')
          .slice(1, 3)
          .map(item => line(item, 'Skills')),
      ]
    : [];
  const document: CvDocument = {
    summary,
    experience,
    projects,
    skills,
    education: of('education').map(item => line(item)),
    certifications: of('certification').map(item => line(item)),
    languages: of('language').map(item => line(item)),
  };
  const asked = experience[0]?.bullets[0] ?? summary[0];
  return {
    document,
    notes: [
      'Put the results with numbers first, where a reader looks.',
      jobDescription
        ? 'Wrote the profile for this job: what it asks for, from what your profile shows.'
        : 'Wrote the profile for the work your profile shows most.',
      'Left out what your profile doesn’t back up, and asked about it instead.',
    ],
    questions: asked
      ? [
          {
            id: 'q1',
            lineId: asked.id,
            text: 'How many people worked on this with you?',
            status: 'open',
          },
        ]
      : [],
    unsupportedJobTerms: jobDescription
      ? jobDescription.split(/\s+/).filter(Boolean).slice(0, 3)
      : [],
    dropped: { lines: 1, numbers: 0, names: 0 },
  };
};

/**
 * Written again (doc 19 §3.3), as the backend's checks keep it: what the candidate removed stays
 * out, what they edited stays in their words, and each answer becomes a line of the first role,
 * citing it. The questions answered are not asked again.
 */
const rewriteFrom = (version: CvWrittenVersion, before: CvDocument) => {
  const document = version.document!;
  const removed = new Set(
    cvDocumentLines(before)
      .filter(({ line }) => line.state === 'removed')
      .map(({ line }) => line.proposed),
  );
  const edited = new Map(
    cvDocumentLines(before)
      .filter(({ line }) => line.state === 'edited')
      .map(({ line }) => [line.proposed, line.text]),
  );
  const keep = (lines: CvLine[]) =>
    lines
      .filter(line => !removed.has(line.proposed))
      .map(line => {
        const text = edited.get(line.proposed);
        return text ? { ...line, text, state: 'edited' as const } : line;
      });
  document.summary = keep(document.summary);
  document.skills = keep(document.skills);
  for (const entry of [...document.experience, ...document.projects]) {
    entry.bullets = keep(entry.bullets);
  }
  const answers = version.statements.filter(({ kind }) => kind === 'answer');
  const lines = cvDocumentLines(document).length;
  const [first] = document.experience;
  answers.forEach((answer, index) => {
    const line: CvLine = {
      id: `l${lines + index + 1}`,
      text: answer.text,
      sources: [{ kind: 'statement', id: answer.id }],
      state: 'written',
      proposed: answer.text,
    };
    if (first) {
      first.bullets.push(line);
    } else {
      document.summary.push(line);
    }
  });
  version.questions = [];
  if (answers.length > 0) {
    version.notes = [
      `Used your ${answers.length === 1 ? 'answer' : `${answers.length} answers`}, each where it belongs.`,
      ...version.notes,
    ];
  }
};

/** The CV versions this account can have made today: its override on top of the default. */
const cvDailyLimit = (profile: PreviewProfile) =>
  effectiveLimits(
    CV_VERSION_DAILY_LIMIT,
    serviceOverride(profile.usageLimits, USAGE_SERVICES.cvVersion),
  ).maxCallsPerDay;

/** Questions the fake asks for any job, with what kind each is. */
const PREVIEW_QUESTIONS: [string, BriefQuestion['kind']][] = [
  ['Tell me about an incident you led from alert to fix.', 'behavioural'],
  ['How would you design the main service of this team?', 'technical'],
  ['How would you approach your first 90 days in this role?', 'role'],
  ['Why this company, and why now?', 'motivation'],
];

export type PreviewProfileGateway = ProfileGateway & {
  controls: PreviewProfileControls;
};

declare global {
  interface Window {
    qdPreviewProfile?: PreviewProfileControls;
  }
}

export type PreviewProfileStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface PreviewProfileOptions {
  /** `null` keeps everything in memory only. */
  storage?: PreviewProfileStorage | null;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}

const browserStorage = (): PreviewProfileStorage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readState = (
  storage: PreviewProfileStorage | null,
): PreviewProfileState => {
  const empty: PreviewProfileState = { profiles: {}, nextId: 1 };
  try {
    const stored = storage?.getItem(STORAGE_KEY);
    if (!stored) {
      return empty;
    }
    const parsed = JSON.parse(stored) as Partial<PreviewProfileState>;
    return {
      profiles:
        parsed.profiles && typeof parsed.profiles === 'object'
          ? parsed.profiles
          : {},
      nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1,
    };
  } catch {
    return empty;
  }
};

const defaultWait = (milliseconds: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds);
  });

const toResource = ({
  settlesAt: _settlesAt,
  outcome: _outcome,
  pasted: _pasted,
  ...resource
}: StoredResource): ProfileResource => resource;

const isHttpsInvalidHost = (url: string) => {
  try {
    return new URL(url).hostname.endsWith('.invalid');
  } catch {
    return false;
  }
};

export const createPreviewProfileGateway = ({
  storage = browserStorage(),
  now = Date.now,
  wait = defaultWait,
}: PreviewProfileOptions = {}): PreviewProfileGateway => {
  const state = readState(storage);
  // The callables of the backend act on whoever is signed in. The fake has no session of
  // its own: it asks the preview auth gateway's record of who is signed in (the same
  // storage), and without one it acts on the account whose profile was read last.
  let lastReadUid: string | null = null;
  const signedInUid = (): string | null => {
    try {
      const session = JSON.parse(
        storage?.getItem(PREVIEW_GATEWAY_MARKER) ?? 'null',
      ) as { currentUid?: unknown } | null;
      return typeof session?.currentUid === 'string'
        ? session.currentUid
        : null;
    } catch {
      return null;
    }
  };
  let nextFailure: ProfileResourceFailure | null = null;
  let nextStalls = false;
  const uploaded = new Set<string>();

  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Memory only.
    }
  };

  const newId = (prefix: string) => {
    const id = `${prefix}-${state.nextId}`;
    state.nextId += 1;
    return id;
  };

  let nextBriefFailure: 'model' | 'quota' | null = null;
  let nextJobFailure: ProfileResourceFailure | null = null;
  let nextRereadOutcome: ProfileResourceFailure | 'changed' | null = null;

  /** How the next page read again ends: as the controls said, or as the backend's fake model. */
  const rereadOutcome = (url: string): Reread['outcome'] => {
    const outcome =
      nextRereadOutcome ??
      (isHttpsInvalidHost(url) ? 'link-unreadable' : 'unchanged');
    nextRereadOutcome = null;
    return outcome;
  };

  /** How a first reading started again after a failed one ends. */
  const againOutcome = (url: string): ProfileResourceFailure | 'ready' => {
    const forced = nextRereadOutcome;
    nextRereadOutcome = null;
    if (forced && forced !== 'changed') {
      return forced;
    }
    return isHttpsInvalidHost(url) ? 'link-unreadable' : 'ready';
  };

  /** The readings again whose time has come, and the ones left. */
  const dueRereads = (
    rereads: Record<string, Reread> | undefined,
    time: number,
  ) => {
    const all = Object.entries(rereads ?? {});
    return {
      ended: all.filter(([, { settlesAt }]) => settlesAt <= time),
      left: Object.fromEntries(
        all.filter(([, { settlesAt }]) => settlesAt > time),
      ),
    };
  };

  /** The names a reading finds: from the first lines of a text, an address or a file's name. */
  const namesFrom = (
    reading: JobReading,
  ): { title?: string; company?: string } => {
    const short = (value?: string) =>
      value && value.length <= 60 ? value : undefined;
    if (reading.source === 'text') {
      const lines = reading.from
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      return {
        title: short(lines[0]) ?? lines[0]?.split(/\s+/).slice(0, 5).join(' '),
        company: lines.length > 2 ? short(lines[1]) : undefined,
      };
    }
    if (reading.source === 'link') {
      const url = new URL(reading.from);
      const slug = url.pathname.split('/').filter(Boolean).pop() ?? '';
      const words = slug.replace(/[-_]+/g, ' ').trim();
      const label = url.hostname
        .split('.')
        .find(part => !['www', 'jobs', 'careers'].includes(part));
      return {
        title: words
          ? words.charAt(0).toUpperCase() + words.slice(1)
          : undefined,
        company: label
          ? label.charAt(0).toUpperCase() + label.slice(1)
          : undefined,
      };
    }
    return {
      title: reading.from.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' '),
    };
  };

  /** Ends the readings whose time has come, as the backend's trigger would. */
  const settleJobs = (profile: PreviewProfile) => {
    const time = now();
    let changed = false;
    for (const application of profile.applications ?? []) {
      const reading = profile.jobReadings?.[application.id];
      const job = application.job;
      if (
        !reading ||
        !job ||
        job.status !== 'reading' ||
        reading.settlesAt === null ||
        reading.settlesAt > time
      ) {
        continue;
      }
      changed = true;
      application.updatedAt = reading.settlesAt;
      if (reading.outcome !== 'ready') {
        job.status = 'failed';
        job.failure = reading.outcome;
        continue;
      }
      job.status = 'ready';
      job.takenAt = reading.settlesAt;
      const names = namesFrom(reading);
      application.title ||= names.title ?? '';
      application.company ??= names.company;
      if (reading.source === 'link') {
        application.jobDescription = `Copy of the posting at ${reading.from}. We are hiring for this role: you will design and run services in production and lead incident response for your area.`;
      } else if (reading.source === 'file') {
        application.jobDescription = `Read from ${reading.from}. You will design and run services in production and mentor engineers on the team.`;
      }
    }
    // The postings read again: a new copy replaces the job's text and dates the brief.
    const postings = dueRereads(profile.postingRereads, time);
    for (const [applicationId, { settlesAt: at, outcome }] of postings.ended) {
      changed = true;
      const application = applicationsOf(profile).find(
        ({ id }) => id === applicationId,
      );
      const job = application?.job;
      if (!application || !job || job.refresh?.status !== 'reading') {
        continue;
      }
      const { startedAt } = job.refresh;
      if (outcome === 'changed' || outcome === 'unchanged') {
        // A text the candidate edited differs from any copy: it is replaced.
        const isNew = outcome === 'changed' || job.edited;
        if (isNew) {
          application.jobDescription = `Copy of the posting at ${application.postingUrl ?? ''}, read again. The team now also asks for experience of being on call.`;
          job.edited = false;
          application.revision += 1;
          application.updatedAt = at;
        }
        job.takenAt = at;
        job.refresh = {
          status: 'done',
          startedAt,
          finishedAt: at,
          changed: isNew,
        };
      } else {
        job.refresh = {
          status: 'failed',
          startedAt,
          finishedAt: at,
          failure: outcome,
        };
      }
    }
    if (postings.ended.length > 0) {
      profile.postingRereads = postings.left;
    }
    if (changed) {
      save();
    }
  };

  /**
   * A brief as the fake prepares it: one requirement for each sentence of the job (six at
   * most), the first ones shown by the profile's items and the last two left as gaps, and
   * four questions with notes.
   */
  const briefFor = (
    profile: PreviewProfile,
    application: JobApplication,
  ): ApplicationBrief => {
    const sentences = (application.jobDescription ?? '')
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean)
      .slice(0, 6);
    const items = profile.items;
    const requirements: BriefRequirement[] = sentences.map(
      (sentence, index) => ({
        text: sentence.replace(/[.!?]$/, '').slice(0, 120),
        importance: index < 4 ? 'required' : 'preferred',
        evidence: sentence,
        itemIds:
          index < sentences.length - 2 && items.length > 0
            ? [items[index % items.length]!.id]
            : [],
      }),
    );
    const questions: BriefQuestion[] = PREVIEW_QUESTIONS.map(
      ([text, kind], index) => ({
        text,
        kind,
        bullets: [
          ...(items[index]
            ? [
                {
                  text: items[index].text.slice(0, 80),
                  itemId: items[index].id,
                },
              ]
            : []),
          {
            text: 'Say what you changed afterwards, not only how you fixed it.',
          },
        ],
      }),
    );
    return {
      requirements,
      questions,
      applicationRevision: application.revision,
      profileRevision: profile.revision ?? 0,
      builtAt: now(),
    };
  };

  const profileOf = (uid: string): PreviewProfile => {
    state.profiles[uid] ??= { resources: [], items: [], extractionsToday: 0 };
    state.profiles[uid].applications ??= [];
    state.profiles[uid].revision ??= 0;
    return state.profiles[uid];
  };

  /** A change to the resources or the items: briefs built before it are out of date. */
  const touch = (profile: PreviewProfile) => {
    profile.revision = (profile.revision ?? 0) + 1;
  };

  const applicationsOf = (profile: PreviewProfile): JobApplication[] =>
    (profile.applications ??= []);

  const name = (value: string | undefined, required = false) => {
    const trimmed = value?.trim() ?? '';
    if (
      (required && trimmed.length === 0) ||
      trimmed.length > APPLICATION_NAME_MAX_CHARS
    ) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return trimmed || undefined;
  };

  const text = (value: string | undefined, max: number) => {
    const trimmed = value?.trim() ?? '';
    if (trimmed.length > max) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return trimmed || undefined;
  };

  const posting = (value: string | undefined) => {
    if (value === undefined || value.trim() === '') {
      return undefined;
    }
    const link = parseProfileLink(value);
    if (!link) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return link;
  };

  const addItems = (
    profile: PreviewProfile,
    resourceId: string,
    facts: PreviewFact[],
    at: number,
  ) => {
    const known = new Set(profile.items.map(item => item.text));
    const fresh = facts.filter(({ text }) => !known.has(text));
    fresh.forEach((entry, index) => {
      profile.items.push({
        id: newId('item'),
        kind: entry.kind,
        text: entry.text,
        evidence: entry.evidence,
        resourceId,
        starred: false,
        hidden: false,
        edited: false,
        // One millisecond apart, so "newest first" has an answer.
        createdAt: at + index,
        updatedAt: at + index,
      });
    });
    return fresh.length;
  };

  /**
   * The text the backend keeps when a resource is read (research doc 17): a note as pasted, a
   * file's text, or the copy of a link's page.
   */
  const keepText = (
    profile: PreviewProfile,
    resource: StoredResource,
    at: number,
    /** A link's page read again, which had changed. */
    again = false,
  ) => {
    const text =
      resource.source === 'text'
        ? (resource.pasted ?? '')
        : resource.source === 'link'
          ? pageTextOf(resource.url ?? '', again)
          : fileTextOf(resource.title);
    profile.texts = {
      ...profile.texts,
      [resource.id]: {
        text,
        kind:
          resource.source === 'text'
            ? 'note'
            : resource.source === 'link'
              ? 'page'
              : 'file',
        format:
          resource.source === 'text'
            ? 'text'
            : resource.source === 'link'
              ? 'page'
              : resource.contentType === 'application/pdf'
                ? 'pdf'
                : resource.contentType.startsWith('text/')
                  ? 'text'
                  : 'docx',
        takenAt: at,
        chars: text.length,
        truncated: false,
      },
    };
    resource.textAt = at;
  };

  /**
   * A CV read fills the CV's details, as `profile-extract` 1.3.0 does: only the fields that are
   * empty and that the candidate has not set or cleared.
   */
  const fillDetails = (
    profile: PreviewProfile,
    resource: StoredResource,
    at: number,
  ) => {
    if (resource.type !== 'cv') {
      return;
    }
    const details: CvDetails = profile.cvDetails ?? {
      edited: [],
      sources: {},
      updatedAt: at,
    };
    let filled = false;
    for (const field of CV_DETAILS_FIELDS) {
      const empty =
        field === 'links' ? !details.links?.length : !details[field];
      if (empty && !details.edited.includes(field)) {
        if (field === 'links') {
          details.links = [...PREVIEW_CV_DETAILS.links];
        } else {
          details[field] = PREVIEW_CV_DETAILS[field];
        }
        details.sources[field] = resource.id;
        filled = true;
      }
    }
    if (filled) {
      details.updatedAt = at;
      profile.cvDetails = details;
    }
  };

  /** Ends the readings whose time has come. */
  const settle = (profile: PreviewProfile) => {
    const time = now();
    let changed = false;
    for (const resource of profile.resources) {
      if (
        resource.status !== 'processing' ||
        resource.settlesAt === null ||
        resource.settlesAt > time
      ) {
        continue;
      }
      changed = true;
      touch(profile);
      resource.updatedAt = resource.settlesAt;
      if (resource.outcome === 'ready') {
        resource.status = 'ready';
        keepText(profile, resource, resource.settlesAt);
        fillDetails(profile, resource, resource.settlesAt);
        resource.itemCount = addItems(
          profile,
          resource.id,
          PREVIEW_FACTS[resource.type],
          resource.settlesAt,
        );
      } else {
        resource.status = 'failed';
        resource.failure = resource.outcome;
      }
    }
    // The pages read again: a new copy replaces the text and moves the profile's revision.
    const pages = dueRereads(profile.pageRereads, time);
    for (const [resourceId, { settlesAt: at, outcome }] of pages.ended) {
      changed = true;
      const resource = profile.resources.find(({ id }) => id === resourceId);
      if (!resource || resource.refresh?.status !== 'reading') {
        continue;
      }
      const { startedAt } = resource.refresh;
      resource.updatedAt = at;
      if (outcome === 'changed' || outcome === 'unchanged') {
        const kept = profile.texts?.[resourceId];
        // A link read before copies were kept gets its first one.
        const isNew = outcome === 'changed' || !kept;
        if (isNew) {
          keepText(profile, resource, at, outcome === 'changed');
          touch(profile);
        } else {
          kept.takenAt = at;
          resource.textAt = at;
        }
        resource.refresh = {
          status: 'done',
          startedAt,
          finishedAt: at,
          changed: isNew,
        };
      } else {
        resource.refresh = {
          status: 'failed',
          startedAt,
          finishedAt: at,
          failure: outcome,
        };
      }
    }
    if (pages.ended.length > 0) {
      profile.pageRereads = pages.left;
    }
    if (changed) {
      save();
    }
  };

  /** Ends the CV versions whose making has come to an end. */
  const settleCvVersions = (profile: PreviewProfile) => {
    const time = now();
    const making = Object.entries(profile.cvMaking ?? {});
    const ended = making.filter(([, { settlesAt }]) => settlesAt <= time);
    if (ended.length === 0) {
      return;
    }
    for (const [versionId, { settlesAt, failure }] of ended) {
      const version = profile.cvVersions?.find(({ id }) => id === versionId);
      if (!version || version.status !== 'creating') {
        continue;
      }
      version.updatedAt = settlesAt;
      if (failure) {
        version.status = 'failed';
        version.failure = failure;
        continue;
      }
      const job =
        version.target.kind === 'job'
          ? (() => {
              const { applicationId } = version.target;
              return applicationsOf(profile).find(
                ({ id }) => id === applicationId,
              );
            })()
          : undefined;
      Object.assign(
        version,
        isWrittenVersion(version)
          ? cvWriteAnswerFor(profile.items, job?.jobDescription)
          : cvAnswerFor(version.cv, profile.items[0], job?.jobDescription),
      );
      const before = profile.cvRewrites?.[versionId];
      if (isWrittenVersion(version) && version.document && before) {
        rewriteFrom(version, before);
        const { [versionId]: _done, ...rest } = profile.cvRewrites ?? {};
        profile.cvRewrites = rest;
      }
      version.status = 'ready';
      version.readyAt = settlesAt;
      profile.cvVersionsToday = (profile.cvVersionsToday ?? 0) + 1;
    }
    profile.cvMaking = Object.fromEntries(
      making.filter(([, { settlesAt }]) => settlesAt > time),
    );
    save();
  };

  const read = (uid: string): PreviewProfile => {
    lastReadUid = uid;
    const profile = profileOf(uid);
    settle(profile);
    settleJobs(profile);
    settleCvVersions(profile);
    return profile;
  };

  let nextCvFailure: CvVersionFailure | null = null;

  /** A version whose review can change: there, and made ("not-ready" otherwise). */
  const readyVersion = (versionId: string): CvVersion => {
    const version = currentProfile().cvVersions?.find(
      ({ id }) => id === versionId,
    );
    if (!version) {
      throw new ProfileError(ProfileErrorCode.NotFound);
    }
    if (version.status !== 'ready') {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
    return version;
  };

  const currentUid = (): string => {
    const uid = signedInUid() ?? lastReadUid;
    if (!uid) {
      throw new ProfileError(ProfileErrorCode.SignedOut);
    }
    return uid;
  };
  const currentProfile = (): PreviewProfile => read(currentUid());

  const startReading = (resource: StoredResource) => {
    resource.status = 'processing';
    resource.settlesAt = nextStalls ? null : now() + PREVIEW_READ_MS;
    nextStalls = false;
  };

  const assertValid = (request: CreateProfileResourceRequest) => {
    const title = request.title.trim();
    const types: readonly string[] = RESOURCE_TYPES_BY_SOURCE[request.source];
    const valid =
      title.length > 0 &&
      title.length <= PROFILE_TITLE_MAX_CHARS &&
      types.includes(request.type) &&
      (request.source !== 'text' ||
        (request.text.trim().length > 0 &&
          request.text.trim().length <= PROFILE_TEXT_MAX_CHARS)) &&
      (request.source !== 'link' ||
        parseProfileLink(request.url) !== undefined) &&
      (request.source !== 'file' ||
        PROFILE_UPLOAD_CONTENT_TYPES.includes(request.contentType));
    if (!valid) {
      throw new ProfileError(ProfileErrorCode.Invalid);
    }
  };

  const controls: PreviewProfileControls = {
    seed: () => {
      const profile = currentProfile();
      profile.resources = [];
      profile.items = [];
      profile.texts = {};
      delete profile.cvDetails;
      // Oldest first, so the first of the list is the newest: a day apart, ending today.
      const day = 24 * 60 * 60 * 1000;
      [...PREVIEW_SEED].reverse().forEach((entry, index, all) => {
        const at = now() - (all.length - index) * day;
        const resource: StoredResource = {
          id: newId('resource'),
          type: entry.type,
          title: entry.title,
          source:
            entry.type === 'link'
              ? 'link'
              : entry.type === 'note'
                ? 'text'
                : 'file',
          contentType:
            entry.type === 'link'
              ? 'text/uri-list'
              : entry.type === 'note'
                ? 'text/plain'
                : 'application/pdf',
          ...(entry.type === 'link'
            ? { url: 'https://talks.example/ledgers-without-tears' }
            : {}),
          storagePath: '',
          status: entry.status,
          ...(entry.failure ? { failure: entry.failure } : {}),
          itemCount: 0,
          createdAt: at,
          updatedAt: at,
          // The two unfinished ones stay as they are: nothing is waiting to end.
          settlesAt: null,
          outcome: entry.failure ?? 'ready',
        };
        resource.storagePath = `users/${currentUid()}/interview-docs/${resource.id}/document`;
        resource.itemCount = addItems(profile, resource.id, entry.facts, at);
        if (resource.status === 'ready') {
          keepText(profile, resource, at);
        }
        profile.resources.push(resource);
      });
      // The details as the designs show them: filled from the CV, the first of the seed.
      const cv = profile.resources.find(
        ({ title }) => title === PREVIEW_SEED[0].title,
      );
      if (cv) {
        fillDetails(profile, cv, cv.createdAt ?? now());
      }
      save();
    },
    failNext: reason => {
      nextFailure = reason;
    },
    stallNext: () => {
      nextStalls = true;
    },
    setExtractionsToday: count => {
      currentProfile().extractionsToday = count;
      save();
    },
    failNextBrief: reason => {
      nextBriefFailure = reason;
    },
    failNextJob: reason => {
      nextJobFailure = reason;
    },
    nextReread: outcome => {
      nextRereadOutcome = outcome;
    },
    failNextCv: reason => {
      nextCvFailure = reason;
    },
    setCvVersionsToday: count => {
      currentProfile().cvVersionsToday = count;
      save();
    },
    // Set once the gateway exists, below: it asks the gateway for the version.
    createEditVersion: () => Promise.reject(new Error('Not ready')),
    setUsageLimits: services => {
      const profile = currentProfile();
      if (services) {
        profile.usageLimits = { services };
      } else {
        delete profile.usageLimits;
      }
      save();
    },
    setBriefsToday: count => {
      currentProfile().briefsToday = count;
      save();
    },
    seedApplications: () => {
      const profile = currentProfile();
      const day = 24 * 60 * 60 * 1000;
      const itemIds = profile.items.map(({ id }) => id);
      const briefOf = (
        gaps: number,
        applicationRevision: number,
        builtAt: number,
      ): ApplicationBrief => ({
        requirements: Array.from({ length: 6 }, (_, index) => ({
          text: `Requirement ${index + 1}`,
          importance: index < 4 ? 'required' : 'preferred',
          itemIds:
            index < 6 - gaps && itemIds.length > 0
              ? [itemIds[index % itemIds.length]]
              : [],
        })),
        questions: [],
        applicationRevision,
        profileRevision: profile.revision ?? 0,
        builtAt,
      });
      profile.applications = PREVIEW_SEED_APPLICATIONS.map((entry, index) => {
        const at = now() - (index + 1) * day;
        const revision = entry.brief === 'jobChanged' ? 2 : 1;
        return {
          id: newId('application'),
          title: entry.title,
          company: entry.company,
          role: entry.role,
          jobDescription: entry.jobDescription,
          postingUrl: entry.postingUrl,
          notes: entry.notes,
          revision,
          ...(entry.brief === 'none'
            ? {}
            : {
                brief: briefOf(
                  entry.brief === 'jobChanged' ? 0 : entry.brief.gaps,
                  1,
                  at,
                ),
              }),
          createdAt: at - day,
          updatedAt: at,
        };
      });
      save();
    },
  };

  const gateway: PreviewProfileGateway = {
    controls,

    getResources: async uid =>
      [...read(uid).resources]
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
        .map(toResource),
    getResource: async (uid, resourceId) => {
      const resource = read(uid).resources.find(({ id }) => id === resourceId);
      return resource ? toResource(resource) : null;
    },
    getItems: async uid => read(uid).items.map(item => ({ ...item })),
    getExtractionsToday: async uid => read(uid).extractionsToday,

    createResource: async request => {
      const profile = currentProfile();
      assertValid(request);
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      if (profile.resources.length >= PROFILE_MAX_RESOURCES) {
        throw new ProfileError(ProfileErrorCode.MaxResources);
      }
      const at = now();
      const id = newId('resource');
      const link =
        request.source === 'link' ? parseProfileLink(request.url) : undefined;
      const resource: StoredResource = {
        id,
        type: request.type,
        title: request.title.trim(),
        source: request.source,
        contentType:
          request.source === 'file'
            ? request.contentType
            : request.source === 'link'
              ? 'text/uri-list'
              : 'text/plain',
        ...(link ? { url: link } : {}),
        ...(request.source === 'text' ? { pasted: request.text.trim() } : {}),
        storagePath: `users/${currentUid()}/interview-docs/${id}/document`,
        status: 'awaitingUpload',
        itemCount: 0,
        createdAt: at,
        updatedAt: at,
        settlesAt: null,
        outcome:
          nextFailure ??
          (link && isHttpsInvalidHost(link) ? 'link-unreadable' : 'ready'),
      };
      nextFailure = null;
      profile.resources.push(resource);
      profile.extractionsToday += 1;
      touch(profile);
      if (request.source === 'file') {
        save();
        return {
          resourceId: id,
          upload: {
            path: resource.storagePath,
            contentType: request.contentType,
            maxBytes: PROFILE_UPLOAD_MAX_BYTES,
          },
        };
      }
      // Text and links are stored by the backend itself: the reading starts at once.
      startReading(resource);
      save();
      return { resourceId: id };
    },

    uploadFile: async (target, file, { onProgress, signal } = {}) => {
      const profile = currentProfile();
      const resource = profile.resources.find(
        ({ storagePath }) => storagePath === target.path,
      );
      const jobId = Object.entries(profile.jobReadings ?? {}).find(
        ([, reading]) => reading.path === target.path,
      )?.[0];
      const job = applicationsOf(profile).find(({ id }) => id === jobId)?.job;
      // Like the rules of the file store: the owner's path, once, within the limits.
      if (
        (!resource && !job) ||
        uploaded.has(target.path) ||
        (resource ? resource.status : job?.status) !== 'awaitingUpload' ||
        file.size === 0 ||
        file.size > target.maxBytes
      ) {
        throw new ProfileError(ProfileErrorCode.UploadRefused);
      }
      for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
        if (signal?.aborted) {
          throw new ProfileError(ProfileErrorCode.UploadCancelled);
        }
        await wait(UPLOAD_STEP_MS);
        onProgress?.(step / UPLOAD_STEPS);
      }
      if (signal?.aborted) {
        throw new ProfileError(ProfileErrorCode.UploadCancelled);
      }
      uploaded.add(target.path);
      if (resource) {
        startReading(resource);
        resource.updatedAt = now();
      } else if (job && jobId) {
        // The trigger reads the job once its file has arrived.
        job.status = 'reading';
        const reading = profile.jobReadings?.[jobId];
        if (reading) {
          reading.settlesAt = now() + PREVIEW_READ_MS;
        }
      }
      save();
    },

    updateItem: async (itemId, change) => {
      const profile = currentProfile();
      const item = profile.items.find(({ id }) => id === itemId);
      if (!item) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const text = change.text?.trim();
      const nothing =
        text === undefined &&
        change.starred === undefined &&
        change.hidden === undefined;
      if (
        nothing ||
        (text !== undefined &&
          (text.length === 0 || text.length > SKILL_MAP_ITEM_MAX_CHARS))
      ) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      if (text !== undefined && text !== item.text) {
        item.text = text;
        item.edited = true;
      }
      item.starred = change.starred ?? item.starred;
      item.hidden = change.hidden ?? item.hidden;
      item.updatedAt = now();
      save();
    },
    removeItem: async itemId => {
      const profile = currentProfile();
      const item = profile.items.find(({ id }) => id === itemId);
      if (!item) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      profile.items = profile.items.filter(({ id }) => id !== itemId);
      const resource = profile.resources.find(
        ({ id }) => id === item.resourceId,
      );
      if (resource) {
        resource.itemCount = Math.max(0, resource.itemCount - 1);
      }
      save();
    },
    removeResource: async resourceId => {
      const profile = currentProfile();
      if (!profile.resources.some(({ id }) => id === resourceId)) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const before = profile.items.length;
      profile.resources = profile.resources.filter(
        ({ id }) => id !== resourceId,
      );
      profile.items = profile.items.filter(
        item => item.resourceId !== resourceId,
      );
      if (profile.texts?.[resourceId]) {
        const { [resourceId]: _removed, ...texts } = profile.texts;
        profile.texts = texts;
      }
      // The fields it filled go with it, unless the candidate set them since.
      const details = profile.cvDetails;
      if (details) {
        for (const field of CV_DETAILS_FIELDS) {
          if (details.sources[field] === resourceId) {
            delete details.sources[field];
            if (!details.edited.includes(field)) {
              delete details[field];
            }
          }
        }
      }
      touch(profile);
      save();
      return { itemsRemoved: before - profile.items.length };
    },
    readLinkAgain: async resourceId => {
      const profile = currentProfile();
      const resource = profile.resources.find(({ id }) => id === resourceId);
      if (!resource) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      if (resource.source !== 'link' || !resource.url) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const time = now();
      if (
        resource.status === 'awaitingUpload' ||
        resource.status === 'processing' ||
        isRereading(resource.refresh, time)
      ) {
        throw new ProfileError(ProfileErrorCode.Reading);
      }
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      profile.extractionsToday += 1;
      if (resource.status === 'failed') {
        // Read from the start, as when it was added.
        delete resource.failure;
        delete resource.refresh;
        resource.outcome = againOutcome(resource.url);
        resource.updatedAt = time;
        startReading(resource);
      } else {
        resource.refresh = { status: 'reading', startedAt: time };
        resource.updatedAt = time;
        profile.pageRereads = {
          ...profile.pageRereads,
          [resourceId]: {
            settlesAt: time + PREVIEW_READ_MS,
            outcome: rereadOutcome(resource.url),
          },
        };
      }
      save();
    },

    // No file exists here: the address leads nowhere on purpose.
    getFileUrl: async () => '#',
    getResourceText: async (uid, resourceId) => {
      const text = read(uid).texts?.[resourceId];
      return text ? { ...text } : null;
    },

    getApplications: async uid =>
      structuredClone(applicationsOf(read(uid))).sort(
        (a, b) =>
          (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
      ),
    getApplication: async (uid, applicationId) => {
      const found = applicationsOf(read(uid)).find(
        ({ id }) => id === applicationId,
      );
      return found ? structuredClone(found) : null;
    },
    getProfileRevision: async uid => read(uid).revision ?? 0,

    createApplication: async (request: CreateJobApplicationRequest) => {
      const uid = currentUid();
      const profile = currentProfile();
      const { job } = request;
      const application: JobApplication = {
        id: '',
        title: name(request.title) ?? '',
        company: name(request.company),
        role: name(request.role),
        notes: text(request.notes, APPLICATION_NOTES_MAX_CHARS),
        revision: 1,
        createdAt: now(),
        updatedAt: now(),
      };
      let reading: JobReading;
      if (job.source === 'text') {
        const pasted = text(job.text, JOB_DESCRIPTION_MAX_CHARS);
        if (!pasted) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        application.jobDescription = pasted;
        reading = {
          settlesAt: null,
          outcome: 'ready',
          source: 'text',
          from: pasted,
        };
      } else if (job.source === 'link') {
        const link = posting(job.url);
        if (!link) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        application.postingUrl = link;
        reading = {
          settlesAt: null,
          outcome: isHttpsInvalidHost(link) ? 'link-unreadable' : 'ready',
          source: 'link',
          from: link,
        };
      } else {
        const fileName = job.fileName.trim();
        if (
          !PROFILE_UPLOAD_CONTENT_TYPES.includes(job.contentType) ||
          fileName.length === 0 ||
          fileName.length > APPLICATION_FILE_NAME_MAX_CHARS
        ) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        reading = {
          settlesAt: null,
          outcome: 'ready',
          source: 'file',
          from: fileName,
        };
      }
      if (applicationsOf(profile).length >= APPLICATIONS_MAX) {
        throw new ProfileError(ProfileErrorCode.MaxApplications);
      }
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      if (nextJobFailure) {
        reading.outcome = nextJobFailure;
        nextJobFailure = null;
      }
      application.id = newId('application');
      application.job = {
        source: job.source,
        status: job.source === 'file' ? 'awaitingUpload' : 'reading',
        ...(job.source === 'file' ? { fileName: job.fileName.trim() } : {}),
        edited: false,
      };
      if (job.source === 'file') {
        reading.path = `users/${uid}/application-docs/${application.id}/job`;
      } else {
        reading.settlesAt = now() + PREVIEW_READ_MS;
      }
      profile.jobReadings = {
        ...profile.jobReadings,
        [application.id]: reading,
      };
      applicationsOf(profile).push(application);
      profile.extractionsToday += 1;
      save();
      return job.source === 'file' && reading.path
        ? {
            applicationId: application.id,
            upload: {
              path: reading.path,
              contentType: job.contentType,
              maxBytes: PROFILE_UPLOAD_MAX_BYTES,
            },
          }
        : { applicationId: application.id };
    },

    updateApplication: async ({ applicationId, ...changes }) => {
      const application = applicationsOf(currentProfile()).find(
        ({ id }) => id === applicationId,
      );
      if (!application) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const before = JSON.stringify(application);
      if (changes.title !== undefined) {
        application.title = name(changes.title, true) ?? '';
      }
      if (changes.company !== undefined) {
        application.company = name(changes.company ?? undefined);
      }
      if (changes.role !== undefined) {
        application.role = name(changes.role ?? undefined);
      }
      if (changes.jobDescription !== undefined) {
        const job = text(changes.jobDescription, JOB_DESCRIPTION_MAX_CHARS);
        if (!job) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        // Not while the job, or its posting again, is being read ("job-not-ready").
        if (
          isJobPending(application) ||
          isRereading(application.job?.refresh, now())
        ) {
          throw new ProfileError(ProfileErrorCode.Reading);
        }
        application.jobDescription = job;
        if (application.job) {
          // Pasted after a failed reading, the job becomes ready.
          application.job.status = 'ready';
          application.job.failure = undefined;
          application.job.edited = true;
        }
      }
      if (changes.postingUrl !== undefined) {
        application.postingUrl = posting(changes.postingUrl ?? undefined);
      }
      if (changes.notes !== undefined) {
        application.notes = text(
          changes.notes ?? undefined,
          APPLICATION_NOTES_MAX_CHARS,
        );
      }
      // The posting's address is not something a brief is built from.
      const { postingUrl: _before, ...was } = JSON.parse(
        before,
      ) as JobApplication;
      const { postingUrl: _after, ...is } = application;
      if (JSON.stringify(was) !== JSON.stringify(is)) {
        application.revision += 1;
      }
      application.updatedAt = now();
      save();
      return { revision: application.revision };
    },

    prepareBrief: async applicationId => {
      const profile = currentProfile();
      const application = applicationsOf(profile).find(
        ({ id }) => id === applicationId,
      );
      if (!application) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      if (isJobPending(application)) {
        throw new ProfileError(ProfileErrorCode.Reading);
      }
      if (application.job?.status === 'failed') {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const failure = nextBriefFailure;
      nextBriefFailure = null;
      if (
        failure === 'quota' ||
        (profile.briefsToday ?? 0) >= BRIEF_DAILY_LIMIT
      ) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      await wait(PREVIEW_BRIEF_MS);
      profile.briefsToday = (profile.briefsToday ?? 0) + 1;
      if (failure === 'model') {
        save();
        throw new ProfileError(ProfileErrorCode.Unknown);
      }
      application.brief = briefFor(profile, application);
      application.updatedAt = now();
      save();
    },
    readPostingAgain: async (applicationId, { replaceEdited = false } = {}) => {
      const profile = currentProfile();
      const application = applicationsOf(profile).find(
        ({ id }) => id === applicationId,
      );
      if (!application) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const { job, postingUrl } = application;
      if (job?.source !== 'link' || !postingUrl) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const time = now();
      if (isJobPending(application) || isRereading(job.refresh, time)) {
        throw new ProfileError(ProfileErrorCode.Reading);
      }
      if (job.status === 'ready' && job.edited && !replaceEdited) {
        throw new ProfileError(ProfileErrorCode.JobEdited);
      }
      if (profile.extractionsToday >= PROFILE_DAILY_EXTRACTIONS) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      profile.extractionsToday += 1;
      if (job.status === 'failed') {
        // Read from the start, as when it was added.
        delete job.failure;
        delete job.refresh;
        job.status = 'reading';
        application.updatedAt = time;
        profile.jobReadings = {
          ...profile.jobReadings,
          [applicationId]: {
            settlesAt: time + PREVIEW_READ_MS,
            outcome: againOutcome(postingUrl),
            source: 'link',
            from: postingUrl,
          },
        };
      } else {
        job.refresh = { status: 'reading', startedAt: time };
        profile.postingRereads = {
          ...profile.postingRereads,
          [applicationId]: {
            settlesAt: time + PREVIEW_READ_MS,
            outcome: rereadOutcome(postingUrl),
          },
        };
      }
      save();
    },
    getBriefsToday: async uid => read(uid).briefsToday ?? 0,

    getCvVersions: async uid =>
      structuredClone(read(uid).cvVersions ?? []).sort(
        (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0),
      ),
    getCvVersion: async (uid, versionId) => {
      const found = read(uid).cvVersions?.find(({ id }) => id === versionId);
      return found ? structuredClone(found) : null;
    },
    createCvVersion: async request => {
      const profile = currentProfile();
      const { target } = request;
      // An edit (doc 18) starts from a CV with its text; a written CV (D83) from the items.
      let cv = '';
      if (request.mode === 'write') {
        if (!profile.items.some(({ hidden }) => !hidden)) {
          throw new ProfileError(ProfileErrorCode.NoItems);
        }
      } else {
        const resource = profile.resources.find(
          ({ id }) => id === request.resourceId,
        );
        if (!resource) {
          throw new ProfileError(ProfileErrorCode.NotFound);
        }
        if (resource.type !== 'cv') {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
        cv = profile.texts?.[request.resourceId]?.text ?? '';
        if (!cv) {
          throw new ProfileError(ProfileErrorCode.NoCvText);
        }
      }
      let role: string | undefined;
      if (target.kind === 'job') {
        const application = applicationsOf(profile).find(
          ({ id }) => id === target.applicationId,
        );
        if (!application) {
          throw new ProfileError(ProfileErrorCode.NotFound);
        }
        if (isJobPending(application)) {
          throw new ProfileError(ProfileErrorCode.Reading);
        }
        if (!application.jobDescription) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
      } else {
        role = target.role?.trim() || undefined;
        if (role && role.length > CV_ROLE_MAX_CHARS) {
          throw new ProfileError(ProfileErrorCode.Invalid);
        }
      }
      if ((profile.cvVersions ?? []).length >= CV_VERSIONS_MAX) {
        throw new ProfileError(ProfileErrorCode.MaxCvVersions);
      }
      if ((profile.cvVersionsToday ?? 0) >= cvDailyLimit(profile)) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      const at = now();
      const common = {
        id: newId('version'),
        target:
          target.kind === 'job'
            ? { kind: 'job' as const, applicationId: target.applicationId }
            : { kind: 'general' as const, ...(role ? { role } : {}) },
        status: 'creating' as const,
        questions: [],
        unsupportedJobTerms: [],
        profileRevision: profile.revision ?? 0,
        createdAt: at,
        updatedAt: at,
      };
      const version: CvVersion =
        request.mode === 'write'
          ? {
              ...common,
              mode: 'write',
              pages: request.pages ?? 2,
              notes: [],
              statements: [],
            }
          : {
              ...common,
              resourceId: request.resourceId,
              length: request.length ?? 'same',
              cv,
              findings: [],
              changes: [],
            };
      profile.cvVersions = [...(profile.cvVersions ?? []), version];
      profile.cvMaking = {
        ...profile.cvMaking,
        [version.id]: {
          settlesAt: at + PREVIEW_CV_MS,
          ...(nextCvFailure ? { failure: nextCvFailure } : {}),
        },
      };
      nextCvFailure = null;
      save();
      // As the backend answers once it is asked to: the version says how it goes.
      return { versionId: version.id, status: 'creating' };
    },
    removeCvVersion: async versionId => {
      const profile = currentProfile();
      if (!profile.cvVersions?.some(({ id }) => id === versionId)) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      profile.cvVersions = profile.cvVersions.filter(
        ({ id }) => id !== versionId,
      );
      save();
    },
    getCvVersionsToday: async uid => read(uid).cvVersionsToday ?? 0,
    getUsageLimits: async uid => {
      const limits = read(uid).usageLimits;
      return limits ? structuredClone(limits) : null;
    },
    getCvDetails: async uid => {
      const details = read(uid).cvDetails;
      return details ? structuredClone(details) : null;
    },
    updateCvDetails: async request => {
      const profile = currentProfile();
      const given = Object.entries(request).filter(
        ([, value]) => value !== undefined,
      );
      const links = request.links?.map(link => link.trim());
      const valid =
        given.length > 0 &&
        CV_DETAILS_TEXT_FIELDS.every(
          field => (request[field]?.trim().length ?? 0) <= CV_DETAILS_MAX_CHARS,
        ) &&
        (links === undefined ||
          (links.length <= CV_DETAILS_MAX_LINKS &&
            links.every(
              link => link.length > 0 && link.length <= CV_DETAILS_MAX_CHARS,
            )));
      if (!valid) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const details: CvDetails = profile.cvDetails ?? {
        edited: [],
        sources: {},
        updatedAt: now(),
      };
      const changed: CvDetailsField[] = [];
      for (const field of CV_DETAILS_TEXT_FIELDS) {
        const value = request[field]?.trim();
        if (value === undefined) {
          continue;
        }
        if ((details[field] ?? '') !== value) {
          changed.push(field);
        }
        if (value) {
          details[field] = value;
        } else {
          delete details[field];
        }
      }
      if (links !== undefined) {
        if ((details.links ?? []).join('\n') !== links.join('\n')) {
          changed.push('links');
        }
        if (links.length > 0) {
          details.links = links;
        } else {
          delete details.links;
        }
      }
      for (const [field] of given) {
        const name = field as CvDetailsField;
        delete details.sources[name];
        if (!details.edited.includes(name)) {
          details.edited.push(name);
        }
      }
      details.updatedAt = now();
      profile.cvDetails = details;
      save();
      return { changed };
    },
    decideCvChange: async (versionId, changeId, decision, text) => {
      const version = readyVersion(versionId);
      // A written version has lines to revise, not changes to decide.
      if (isWrittenVersion(version)) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const change = version.changes.find(({ id }) => id === changeId);
      if (!change) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const wording = text?.trim() ?? '';
      if (
        (decision === 'edit') !== (text !== undefined) ||
        (decision === 'edit' &&
          (wording.length === 0 || wording.length > CV_LINE_MAX_CHARS)) ||
        (decision === 'edit' && change.action === 'remove')
      ) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      change.decision = (
        {
          accept: 'accepted',
          edit: 'edited',
          keep: 'kept',
          reopen: 'open',
        } as const
      )[decision];
      if (decision === 'edit') {
        change.text = wording;
      } else {
        delete change.text;
      }
      version.updatedAt = now();
      save();
      return { open: openReviews(version) };
    },
    answerCvQuestion: async (versionId, questionId, answer) => {
      const version = readyVersion(versionId);
      const question = version.questions.find(({ id }) => id === questionId);
      if (!question) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      const words = answer?.trim() ?? '';
      if (
        answer !== undefined &&
        (!words || words.length > CV_LINE_MAX_CHARS)
      ) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      if (words) {
        question.status = 'answered';
        question.answer = words;
      } else {
        question.status = 'skipped';
        delete question.answer;
      }
      version.updatedAt = now();
      save();
      return {
        open: isWrittenVersion(version)
          ? version.questions.filter(({ status }) => status === 'open').length
          : openReviews(version),
      };
    },
    copyCvVersion: async versionId => {
      const profile = currentProfile();
      const version = readyVersion(versionId);
      if ((profile.cvVersions ?? []).length >= CV_VERSIONS_MAX) {
        throw new ProfileError(ProfileErrorCode.MaxCvVersions);
      }
      const at = now();
      const { sentAt: _sent, ...kept } = structuredClone(version);
      const copy: CvVersion = {
        ...kept,
        id: newId('version'),
        copiedFrom: version.id,
        createdAt: at,
        updatedAt: at,
      };
      profile.cvVersions = [...(profile.cvVersions ?? []), copy];
      save();
      return { versionId: copy.id };
    },
    reviseCvLine: async (versionId, request) => {
      const version = readyVersion(versionId);
      if (!isWrittenVersion(version) || !version.document) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const { document } = version;
      const { lineId, action } = request;
      if (lineId.startsWith('e')) {
        const entry = [...document.experience, ...document.projects].find(
          ({ id }) => id === lineId,
        );
        if (!entry) {
          throw new ProfileError(ProfileErrorCode.NotFound);
        }
        if (action === 'edit') {
          if (!('fields' in request)) {
            throw new ProfileError(ProfileErrorCode.Invalid);
          }
          const fields = Object.entries(request.fields).filter(
            ([, value]) => value !== undefined,
          );
          if (
            fields.length === 0 ||
            fields.some(
              ([, value]) => value!.trim().length > CV_FIELD_MAX_CHARS,
            )
          ) {
            throw new ProfileError(ProfileErrorCode.Invalid);
          }
          for (const [field, value] of fields) {
            entry[field as keyof CvEntryFields] = value!.trim();
          }
          entry.state = 'edited';
        } else if (action === 'remove') {
          entry.state = 'removed';
        } else {
          Object.assign(entry, entry.proposedFields, { state: 'written' });
        }
      } else {
        const line = cvDocumentLines(document).find(
          ({ line: { id } }) => id === lineId,
        )?.line;
        if (!line) {
          throw new ProfileError(ProfileErrorCode.NotFound);
        }
        if (action === 'edit') {
          const text = 'text' in request ? request.text.trim() : '';
          if (!text || text.length > CV_LINE_MAX_CHARS) {
            throw new ProfileError(ProfileErrorCode.Invalid);
          }
          line.text = text;
          line.state = 'edited';
        } else if (action === 'remove') {
          line.state = 'removed';
        } else {
          line.text = line.proposed;
          line.state = 'written';
        }
      }
      version.updatedAt = now();
      save();
    },
    rewriteCvVersion: async versionId => {
      const profile = currentProfile();
      const version = readyVersion(versionId);
      if (!isWrittenVersion(version) || !version.document) {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      if ((profile.cvVersions ?? []).length >= CV_VERSIONS_MAX) {
        throw new ProfileError(ProfileErrorCode.MaxCvVersions);
      }
      if ((profile.cvVersionsToday ?? 0) >= cvDailyLimit(profile)) {
        throw new ProfileError(ProfileErrorCode.DailyLimit);
      }
      // The candidate's answers and edits become statements the new one cites.
      const statements: CvStatement[] = [];
      for (const question of version.questions) {
        if (question.status === 'answered' && question.answer) {
          statements.push({
            id: `A${statements.length + 1}`,
            kind: 'answer',
            question: question.text,
            text: question.answer,
          });
        }
      }
      for (const { line } of cvDocumentLines(version.document)) {
        if (line.state === 'edited') {
          statements.push({
            id: `A${statements.length + 1}`,
            kind: 'edit',
            text: line.text,
          });
        }
      }
      const at = now();
      const written: CvWrittenVersion = {
        id: newId('version'),
        mode: 'write',
        target: structuredClone(version.target),
        pages: version.pages,
        status: 'creating',
        notes: [],
        questions: [],
        unsupportedJobTerms: [],
        statements,
        rewrittenFrom: version.id,
        profileRevision: profile.revision ?? 0,
        createdAt: at,
        updatedAt: at,
      };
      profile.cvVersions = [...(profile.cvVersions ?? []), written];
      profile.cvRewrites = {
        ...profile.cvRewrites,
        [written.id]: structuredClone(version.document),
      };
      profile.cvMaking = {
        ...profile.cvMaking,
        [written.id]: {
          settlesAt: at + PREVIEW_CV_MS,
          ...(nextCvFailure ? { failure: nextCvFailure } : {}),
        },
      };
      nextCvFailure = null;
      save();
      return { versionId: written.id };
    },
    markCvVersionSent: async (versionId, sent) => {
      const profile = currentProfile();
      const version = readyVersion(versionId);
      if (version.target.kind !== 'job') {
        throw new ProfileError(ProfileErrorCode.Invalid);
      }
      const { applicationId } = version.target;
      // One version sent per application.
      for (const other of profile.cvVersions ?? []) {
        if (
          other.target.kind === 'job' &&
          other.target.applicationId === applicationId
        ) {
          delete other.sentAt;
        }
      }
      if (sent) {
        version.sentAt = now();
      }
      version.updatedAt = now();
      save();
    },

    removeApplication: async applicationId => {
      const profile = currentProfile();
      if (!applicationsOf(profile).some(({ id }) => id === applicationId)) {
        throw new ProfileError(ProfileErrorCode.NotFound);
      }
      profile.applications = applicationsOf(profile).filter(
        ({ id }) => id !== applicationId,
      );
      save();
    },
  };
  controls.createEditVersion = async (target = { kind: 'general' }) => {
    // The newest CV with its text, as the pages offered first.
    const cv = currentProfile()
      .resources.filter(
        ({ id, type }) => type === 'cv' && currentProfile().texts?.[id],
      )
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
    if (!cv) {
      throw new ProfileError(ProfileErrorCode.NoCvText);
    }
    const { versionId } = await gateway.createCvVersion({
      resourceId: cv.id,
      target,
    });
    return versionId;
  };
  return gateway;
};

/**
 * Puts the controls on `window.qdPreviewProfile`, for the browser console and the
 * end-to-end tests. Only the preview gateway has them, so they are never in a production build.
 */
export const exposePreviewProfileControls = (
  gateway: PreviewProfileGateway,
): ProfileGateway => {
  window.qdPreviewProfile = gateway.controls;
  return gateway;
};
