// What the pages of a written CV say about it (doc 13 §20): how long it is, and where each line
// comes from.
import { type TFunction } from 'i18next';

import {
  type ProfileResource,
  type SkillMapItem,
} from '@/core/profile/contract';
import {
  type CvDocument,
  cvDocumentPages,
  type CvLineSource,
  type CvLineState,
} from '@/core/profile/cvDocument';
import { type CvStatement } from '@/core/profile/cvVersions';

/** The page estimate (doc 19 §3.4) rounded to half a page, as the pages say it (doc 13 §20.6). */
export const halfPages = (document: CvDocument): number =>
  Math.max(0.5, Math.round(cvDocumentPages(document) * 2) / 2);

/** "about 2 pages", "about 1½ pages", "about half a page". */
export const aboutPages = (t: TFunction, document: CvDocument): string => {
  const pages = halfPages(document);
  if (pages === 0.5) {
    return t('cv.aboutHalfPage');
  }
  return Number.isInteger(pages)
    ? t('cv.aboutPages', { count: pages })
    : t('cv.aboutPagesAndHalf', { whole: Math.floor(pages) });
};

/** Longer than the length asked for, by half a page or more. */
export const isLongerThanAsked = (document: CvDocument, pages: number) =>
  halfPages(document) > pages;

export interface SourceContext {
  /** `null` while the items are read. */
  items: Map<string, SkillMapItem> | null;
  resources: ProfileResource[];
  statements: CvStatement[];
  /** The day of the version it was written again from: "your answer of 15 Oct". */
  writtenAgainDay?: string;
  /** The version itself, for what a line of it can do ("Add it to my profile as a note", D97). */
  version?: { id: string; day: string };
}

/**
 * The muted line under a line of the CV: "From" and the titles of the resources its items come
 * from, "your answer of 15 Oct", or "Edited by you · Your words". `''` while the items are read.
 */
export const sourceLine = (
  t: TFunction,
  { sources, state }: { sources: CvLineSource[]; state: CvLineState },
  { items, resources, statements, writtenAgainDay }: SourceContext,
): string => {
  if (state === 'edited') {
    return t('cv.sourceEditedByYou');
  }
  const parts: string[] = [];
  for (const source of sources) {
    if (source.kind === 'statement') {
      const statement = statements.find(({ id }) => id === source.id);
      parts.push(
        statement?.kind === 'answer'
          ? writtenAgainDay
            ? t('cv.sourceAnswerOf', { date: writtenAgainDay })
            : t('cv.sourceAnswer')
          : statement?.kind === 'note'
            ? t('cv.sourceAsked')
            : t('cv.sourceYourWords'),
      );
      continue;
    }
    if (!items) {
      return '';
    }
    // An item removed or hidden since the CV was written is no longer in the profile.
    const item = items.get(source.itemId);
    const resource =
      item && !item.hidden
        ? resources.find(({ id }) => id === item.resourceId)
        : undefined;
    parts.push(resource ? resource.title : t('cv.sourceGone'));
  }
  const unique = [...new Set(parts)];
  return unique.length > 0
    ? t('cv.sourceFrom', { sources: unique.join(' · ') })
    : '';
};
