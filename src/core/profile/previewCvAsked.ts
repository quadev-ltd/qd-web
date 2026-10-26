// What the preview gateway does with what the candidate asks of a CV (D97), as the backend does:
// each non-empty line of `asked` becomes a note statement (N1, N2…) the CV may cite, and the
// writer says what it did with each request. The fake writer follows a "Put first" line, keeps an
// old role to one line rather than leave it out, adds an "Also" fact as a line citing it, and
// never raises a title. Test and preview only.
import { type CvDocument } from './cvDocument';
import {
  type CvAskedOutcome,
  CV_ASKED_MAX_CHARS,
  CV_ASKED_MAX_LINES,
  type CvStatement,
} from './cvVersions';
import { ProfileError, ProfileErrorCode } from './errors';

/** The text kept of what was asked: trimmed, absent when empty; refused over the limit. */
export const askedOf = (asked: string | undefined): string | undefined => {
  const trimmed = asked?.trim() ?? '';
  if (trimmed.length > CV_ASKED_MAX_CHARS) {
    throw new ProfileError(ProfileErrorCode.Invalid);
  }
  return trimmed || undefined;
};

/**
 * One note statement per non-empty line, 12 at most. A line already added to the profile from
 * the version written again keeps its resource.
 */
export const noteStatementsOf = (
  asked: string | undefined,
  before: CvStatement[] = [],
): CvStatement[] =>
  (asked ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, CV_ASKED_MAX_LINES)
    .map((text, index) => {
      const added = before.find(
        statement =>
          statement.kind === 'note' &&
          statement.text === text &&
          statement.resourceId,
      );
      return {
        id: `N${index + 1}`,
        kind: 'note' as const,
        text,
        ...(added?.resourceId ? { resourceId: added.resourceId } : {}),
      };
    });

const RAISE = /\b(title|tech lead|lead engineer|sound like|senior to)\b/i;
const PUT_FIRST = /^put first\b/i;
const LEAVE_OUT = /^leave out\b/i;

/**
 * What the fake writer does with each request, at most 6, in the order asked; a fact given
 * ("Also: …") goes into the document as a line citing its statement.
 */
export const followAsked = (
  document: CvDocument,
  notes: CvStatement[],
): CvAskedOutcome[] => {
  const outcomes: CvAskedOutcome[] = [];
  for (const note of notes.filter(({ kind }) => kind === 'note').slice(0, 6)) {
    const what = note.text.replace(/^[^:]*:\s*/, '');
    if (RAISE.test(note.text)) {
      outcomes.push({
        outcome: 'not-done',
        text: `Didn’t use “${what}”: no source shows it, and we never raise a title.`,
      });
    } else if (PUT_FIRST.test(note.text)) {
      outcomes.push({
        outcome: 'done',
        text: `Put ${what} first, as you asked.`,
      });
    } else if (LEAVE_OUT.test(note.text)) {
      outcomes.push({
        outcome: 'changed',
        text: `Kept ${what} to one line instead of leaving it out: without it your CV would show a gap.`,
      });
    } else {
      const entry = document.experience[0];
      const line = {
        id: `l-${note.id.toLowerCase()}`,
        text: what,
        sources: [{ kind: 'statement' as const, id: note.id }],
        state: 'written' as const,
        proposed: what,
      };
      if (entry) {
        entry.bullets.push(line);
      } else {
        document.summary.push(line);
      }
      outcomes.push({
        outcome: 'done',
        text: 'Added it, as you asked. The line says where it comes from.',
      });
    }
  }
  return outcomes;
};
