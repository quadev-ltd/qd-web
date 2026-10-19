// The CV's details (research doc 19 §3.1, D83): the name and contact lines at the top of every CV
// written from the profile. Filled by the reading of a resource, corrected by the candidate with
// `updateCvDetails`; never written by a model's CV. A copy of the contract in quadev-backend's
// packages/shared (interviewProfile.ts), as the rest of this folder is.
import { z } from 'zod';

import { interviewProfilePath } from './contract';

/** The one-line fields of the CV's details. */
export const CV_DETAILS_TEXT_FIELDS = [
  'name',
  'headline',
  'email',
  'phone',
  'location',
  'rightToWork',
] as const;
export type CvDetailsTextField = (typeof CV_DETAILS_TEXT_FIELDS)[number];
/** Every field of the CV's details: the one-line fields and `links`. */
export const CV_DETAILS_FIELDS = [...CV_DETAILS_TEXT_FIELDS, 'links'] as const;
export type CvDetailsField = (typeof CV_DETAILS_FIELDS)[number];

/** Longest one-line field of the CV's details, and longest link. */
export const CV_DETAILS_MAX_CHARS = 200;
/** Links the CV's details keep. */
export const CV_DETAILS_MAX_LINKS = 4;

/** `users/{uid}/interviewProfile/main/details/cv`. Absent until a field is filled. */
export const cvDetailsPath = (uid: string) =>
  `${interviewProfilePath(uid)}/details/cv`;

const text = z.string().optional().catch(undefined);

export const CvDetailsSchema = z.object({
  name: text,
  /** The line under the name ("Senior Backend Engineer"). */
  headline: text,
  email: text,
  phone: text,
  /** Town or region, as written ("London, UK"). */
  location: text,
  /** As the candidate states it ("British citizen"). */
  rightToWork: text,
  /** Addresses as written (LinkedIn, GitHub, a website): free text, not checked as URLs. */
  links: z.array(z.string()).optional().catch(undefined),
  /** Fields the candidate set or cleared. A reading never changes them. */
  edited: z.array(z.enum(CV_DETAILS_FIELDS)).catch([]),
  /** The resource each field read from a resource came from. */
  sources: z.partialRecord(z.enum(CV_DETAILS_FIELDS), z.string()).catch({}),
  updatedAt: z.number().nullable().catch(null),
});
export type CvDetails = z.infer<typeof CvDetailsSchema>;

// ---------- The callable of the `interview-profile` codebase ----------

export const UPDATE_CV_DETAILS = 'updateCvDetails';

/**
 * Sets or clears fields: a one-line field takes a string (`''` clears it), `links` the whole
 * list (`[]` clears it). Every field given is marked `edited`, so a later reading never changes
 * it: send only the fields the candidate changed.
 */
export type UpdateCvDetailsRequest = Partial<
  Record<CvDetailsTextField, string> & { links: string[] }
>;

export const UpdateCvDetailsResponseSchema = z.object({
  /** The fields whose value changed. */
  changed: z.array(z.enum(CV_DETAILS_FIELDS)),
});
