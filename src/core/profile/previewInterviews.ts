// What the preview gateway does with the interviews of an application (D89), as the backend
// does: it checks what is sent, works out when the interview starts from its date, time and
// zone, and keeps the application's `interviewTimes`. Test and preview only: the pages never
// work out `startsAt`.
import { ProfileError, ProfileErrorCode } from './errors';
import {
  type ApplicationInterview,
  type InterviewQuestions,
  INTERVIEW_DATE,
  INTERVIEW_DESCRIPTION_MAX_CHARS,
  INTERVIEW_LENGTH_MAX,
  INTERVIEW_LENGTH_MIN,
  INTERVIEW_NAME_MAX_CHARS,
  INTERVIEW_TIME,
  INTERVIEW_TYPES,
  type InterviewTime,
  type InterviewType,
} from './interviews';
import { zonedParts, isKnownTimeZone } from './interviewTime';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const wallClock = (date: string, time: string) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Date.UTC(year, month - 1, day, hour, minute);
};

/** How far ahead of UTC a zone's clocks are at an instant. */
const offsetAt = (instant: number, timeZone: string) => {
  const { date, time } = zonedParts(instant, timeZone);
  return wallClock(date, time) - Math.floor(instant / MINUTE_MS) * MINUTE_MS;
};

const HALF_DAY_MS = 12 * 60 * MINUTE_MS;

/**
 * The instant a date and time on a zone's clocks stand for, as the backend works it out
 * (`interviewStartsAt` in quadev-backend's `shared`): a time in the gap of a change of the clocks
 * moves forward by the gap, and a time that comes twice is the earlier one.
 */
export const instantIn = (date: string, time: string, timeZone: string) => {
  const wall = wallClock(date, time);
  const candidates = [
    offsetAt(wall - HALF_DAY_MS, timeZone),
    offsetAt(wall + HALF_DAY_MS, timeZone),
  ].map(offset => wall - offset);
  const shown = candidates.filter(
    instant => instant + offsetAt(instant, timeZone) === wall,
  );
  return shown.length > 0 ? Math.min(...shown) : candidates[0];
};

/** A date that exists, in the years the backend takes. */
const isRealDate = (date: string) => {
  if (!INTERVIEW_DATE.test(date)) {
    return false;
  }
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 2000 &&
    year <= 2100 &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
};

const invalid = () => new ProfileError(ProfileErrorCode.Invalid);

/** The fields of an interview, checked as the backend checks them. */
export const checkedFields = (fields: {
  name?: string | null;
  date?: string;
  startTime?: string;
  timeZone?: string;
  lengthMinutes?: number | null;
  type?: InterviewType | null;
  description?: string;
}) => {
  const name = fields.name?.trim();
  if (name !== undefined && name.length > INTERVIEW_NAME_MAX_CHARS) {
    throw invalid();
  }
  if (fields.date !== undefined && !isRealDate(fields.date)) {
    throw invalid();
  }
  if (
    fields.startTime !== undefined &&
    !INTERVIEW_TIME.test(fields.startTime)
  ) {
    throw invalid();
  }
  if (fields.timeZone !== undefined && !isKnownTimeZone(fields.timeZone)) {
    throw invalid();
  }
  const length = fields.lengthMinutes;
  if (
    typeof length === 'number' &&
    (!Number.isInteger(length) ||
      length < INTERVIEW_LENGTH_MIN ||
      length > INTERVIEW_LENGTH_MAX)
  ) {
    throw invalid();
  }
  if (fields.type && !INTERVIEW_TYPES.includes(fields.type)) {
    throw invalid();
  }
  const description = fields.description?.trim();
  if (
    description !== undefined &&
    description.length > INTERVIEW_DESCRIPTION_MAX_CHARS
  ) {
    throw invalid();
  }
  return { name, description };
};

/** What the application keeps of its interviews, the oldest first. */
export const timesOf = (
  interviews: readonly ApplicationInterview[],
): InterviewTime[] =>
  [...interviews]
    .sort((a, b) => a.startsAt - b.startsAt)
    .map(
      ({ id, startsAt, date, startTime, timeZone, name, lengthMinutes }) => ({
        interviewId: id,
        startsAt,
        date,
        startTime,
        timeZone,
        ...(name ? { name } : {}),
        ...(lengthMinutes ? { lengthMinutes } : {}),
      }),
    );

/**
 * The interviews of the designs (doc 13 §24), around now. The first application: a technical
 * interview in 3 days, a system design in 11, and a recruiter call 17 days ago. The second: a
 * behavioural one in 9 days.
 */
export const seedInterviews = (
  now: number,
  timeZone: string,
  newId: () => string,
): Record<'first' | 'second', ApplicationInterview[]> => {
  const on = (days: number, startTime: string) => {
    const date = zonedParts(now + days * DAY_MS, timeZone).date;
    return {
      date,
      startTime,
      timeZone,
      startsAt: instantIn(date, startTime, timeZone),
    };
  };
  const made = now - 20 * DAY_MS;
  const stored = (
    interview: Omit<
      ApplicationInterview,
      'revision' | 'createdAt' | 'updatedAt'
    >,
  ) => ({
    ...interview,
    revision: 1,
    createdAt: made,
    updatedAt: made,
  });
  const first = [
    {
      id: newId(),
      name: 'Technical interview',
      ...on(3, '14:00'),
      lengthMinutes: 60,
      type: 'technical' as const,
      description:
        'Two engineers from the tracking team, on a video call. About 15 minutes on my background, then a design problem about parcel tracking events. The recruiter said they care about Kafka and on-call.',
    },
    {
      id: newId(),
      name: 'System design',
      ...on(11, '10:00'),
      lengthMinutes: 90,
      type: 'system-design' as const,
      description:
        'Whiteboard session with the principal engineer: a parcel tracking service, end to end.',
    },
    {
      id: newId(),
      name: 'Recruiter call',
      ...on(-17, '11:00'),
      lengthMinutes: 30,
      description:
        'Call with the talent team: salary range, notice period, and why I want to leave payments.',
    },
  ];
  // The second application's: no name and nothing written about it yet.
  const second = [
    {
      id: newId(),
      ...on(9, '09:30'),
      type: 'behavioural' as const,
      description: '',
    },
  ];
  return { first: first.map(stored), second: second.map(stored) };
};

/**
 * The likely questions the fake writes for an interview (D94): eight, with the brief's kinds,
 * each saying why it is likely from what the interview, the job or the profile give. New ids each
 * time, as the backend's.
 */
export const previewQuestionsFor = (
  interview: Pick<ApplicationInterview, 'description' | 'type'>,
  job: { title: string; company?: string },
  write: number,
): InterviewQuestions['items'] => {
  const where = job.company ? `${job.title} at ${job.company}` : job.title;
  const from = interview.description
    ? 'What you know about this interview says'
    : 'The job says';
  const items: [string, InterviewQuestions['items'][number]['kind'], string][] =
    [
      [
        'Tell me about an incident you led from alert to fix.',
        'behavioural',
        `${from} they care about on-call.`,
      ],
      [
        `How would you design the main service of the ${job.title} team?`,
        'technical',
        interview.type === 'system-design'
          ? 'It is a system design interview.'
          : 'The job asks you to design and run services in production.',
      ],
      [
        'How would you keep a consumer correct when events arrive late or twice?',
        'technical',
        'The job names event streams, and your profile shows little of them.',
      ],
      [
        `Why do you want to work on ${where}?`,
        'motivation',
        'Most interviews ask it early.',
      ],
      [
        'What would you change first in your first 90 days?',
        'role',
        'The job is about owning a part of the platform.',
      ],
      [
        'Tell me about a design you changed after someone reviewed it.',
        'behavioural',
        'Engineers will want to know how you take a review of your work.',
      ],
      [
        'How do you decide what to measure for a service you run?',
        'technical',
        'The job asks for running services in production.',
      ],
      [
        'Tell me about a time you mentored someone through a hard problem.',
        'behavioural',
        'The job asks you to mentor engineers on the team.',
      ],
    ];
  return items.map(([text, kind, why], index) => ({
    id: `q${index + 1}-${write}`,
    text,
    kind,
    why,
  }));
};
