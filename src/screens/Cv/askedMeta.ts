// What a new CV starts with (D97): what was asked of the latest version for the same target,
// whatever it had, so an empty box stays empty. A job's CVs carry to that job only; a general CV
// carries to the next general one.
import {
  type CvVersion,
  type CvVersionTarget,
  isWrittenVersion,
} from '@/core/profile/cvVersions';

type Target =
  { kind: 'job'; applicationId: string | undefined } | { kind: 'general' };

const sameTarget = (target: CvVersionTarget, wanted: Target) =>
  wanted.kind === 'job'
    ? target.kind === 'job' && target.applicationId === wanted.applicationId
    : target.kind === 'general';

/** The latest version for that target, and what was asked of it (none when nothing was). */
export const carriedAsked = (
  versions: readonly CvVersion[],
  target: Target,
): { from: CvVersion; asked: string } | undefined => {
  const latest = [...versions]
    .filter(version => sameTarget(version.target, target))
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
  const asked =
    latest && isWrittenVersion(latest) ? latest.asked?.trim() : undefined;
  return latest && asked ? { from: latest, asked } : undefined;
};
