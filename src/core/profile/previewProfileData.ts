// Fictional content for the preview profile gateway: Maya Okafor, the candidate of the
// design artboards. Nobody's real CV. Local preview and tests only.
import {
  type ProfileResourceFailure,
  type ProfileResourceStatus,
  type ProfileResourceType,
  type SkillMapKind,
} from './contract';

export interface PreviewFact {
  kind: SkillMapKind;
  text: string;
  /** The passage the fact was "read" from. */
  evidence: string;
}

const fact = (
  kind: SkillMapKind,
  text: string,
  evidence: string,
): PreviewFact => ({ kind, text, evidence });

const CV_FACTS: PreviewFact[] = [
  fact(
    'experience',
    'Senior Backend Engineer at Fenwick Pay, 2021 to 2026: payments ledger and reconciliation.',
    'Fenwick Pay, Senior Backend Engineer, 2021 to 2026. Payments ledger and reconciliation.',
  ),
  fact(
    'achievement',
    'Cut payment incidents by 40% in two quarters by moving the ledger to event sourcing.',
    'Reduced Sev-1 and Sev-2 payment incidents 40% across Q3 and Q4 after leading the migration of the ledger to an event-sourced design.',
  ),
  fact(
    'achievement',
    'Led the on-call redesign for a team of nine; pages per week fell from 31 to 12.',
    'Redesigned the on-call rota for a team of nine. Pages per week: 31 to 12.',
  ),
  fact(
    'skill',
    'Go and PostgreSQL in production for six years.',
    'Go, PostgreSQL (six years in production).',
  ),
  fact(
    'skill',
    'Event-driven design with a message queue (RabbitMQ).',
    'Event-driven services on RabbitMQ.',
  ),
  fact(
    'project',
    'Reconciliation service that matches two million card transactions a day.',
    'Built the reconciliation service: two million card transactions matched daily.',
  ),
];

const DOCUMENT_FACTS: PreviewFact[] = [
  fact(
    'story',
    'Mentored two junior engineers through their first production incident review.',
    'Maya mentored two junior engineers through their first production incident review.',
  ),
  fact(
    'achievement',
    'Moved the team to weekly releases; the lead time for a change fell from nine days to two.',
    'Weekly releases since March. Lead time for a change: nine days to two.',
  ),
  fact(
    'skill',
    'Incident reviews without blame, written up within two working days.',
    'Runs blameless incident reviews and publishes them within two working days.',
  ),
];

const NOTE_FACTS: PreviewFact[] = [
  fact(
    'story',
    'Pushed back on a launch date after a failed load test, and agreed a two-week slip with the product lead.',
    'The load test failed a week before launch. I asked for two more weeks and the product lead agreed.',
  ),
  fact(
    'story',
    'Took over a stalled migration and finished it in six weeks by cutting its scope in half.',
    'The migration had stalled for a quarter. I cut the scope in half and we finished in six weeks.',
  ),
];

const LINK_FACTS: PreviewFact[] = [
  fact(
    'project',
    'Conference talk on running a payments ledger without downtime.',
    'Ledgers without tears: running a payments ledger with no downtime.',
  ),
  fact(
    'skill',
    'Explaining technical trade-offs to a general audience.',
    'A talk for engineers and product people alike.',
  ),
];

/** What the fake "reads" from a resource of each type. */
export const PREVIEW_FACTS: Record<ProfileResourceType, PreviewFact[]> = {
  cv: CV_FACTS,
  document: DOCUMENT_FACTS,
  note: NOTE_FACTS,
  link: LINK_FACTS,
};

export interface PreviewSeedResource {
  type: ProfileResourceType;
  title: string;
  status: ProfileResourceStatus;
  failure?: ProfileResourceFailure;
  /** What it contributed to the skill map. */
  facts: PreviewFact[];
}

/**
 * The profile of the design artboards ("P1 · Profile · resources in every state"): six
 * resources, one in each state a resource can be in.
 */
export const PREVIEW_SEED: PreviewSeedResource[] = [
  {
    type: 'cv',
    title: 'Maya Okafor CV 2026',
    status: 'ready',
    facts: CV_FACTS,
  },
  {
    type: 'document',
    title: 'Performance review 2025',
    status: 'ready',
    facts: DOCUMENT_FACTS,
  },
  {
    type: 'note',
    title: 'Stories for interviews',
    status: 'processing',
    facts: [],
  },
  {
    type: 'document',
    title: 'Portfolio case study',
    status: 'awaitingUpload',
    facts: [],
  },
  {
    type: 'cv',
    title: 'LinkedIn profile export',
    status: 'ready',
    facts: [],
  },
  {
    type: 'link',
    title: 'Conference talk: Ledgers without tears',
    status: 'failed',
    failure: 'link-unreadable',
    facts: [],
  },
];

export interface PreviewSeedApplication {
  title: string;
  company?: string;
  role?: string;
  jobDescription: string;
  postingUrl?: string;
  notes?: string;
  /** What its brief is: none yet, ready with this many gaps, or built before the job changed. */
  brief: 'none' | { gaps: number } | 'jobChanged';
}

/** The applications of the design artboards ("S1 · Home · applications"), newest first. */
export const PREVIEW_SEED_APPLICATIONS: PreviewSeedApplication[] = [
  {
    title: 'Senior Backend Engineer',
    company: 'Northwind Logistics',
    role: 'Backend, parcel tracking',
    jobDescription:
      'Northwind Logistics moves two million parcels a day across Europe. We are looking for a Senior Backend Engineer to own the services behind parcel tracking. You will design and run Go services in production, operate Kafka clusters handling billions of events, lead incident response for your area and mentor engineers on the team.',
    postingUrl: 'https://northwind-logistics.example/careers/1482',
    notes:
      'Recruiter call on 8 Oct: two technical rounds, then the hiring manager. They asked about on-call experience.',
    brief: { gaps: 2 },
  },
  {
    title: 'Engineering Manager',
    company: 'Harbour Health',
    jobDescription:
      'Harbour Health is hiring an Engineering Manager for its patient records platform: a team of seven backend and mobile engineers, delivery across three time zones, and hiring for two open roles.',
    brief: 'jobChanged',
  },
  {
    title: 'Platform Engineer',
    company: 'Halvorsen',
    jobDescription:
      'Halvorsen builds the platform its product teams deploy on: Kubernetes, Terraform and an internal developer portal. You will run the clusters and the paved road for 40 engineers.',
    brief: 'none',
  },
];
