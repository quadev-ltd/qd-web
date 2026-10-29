// How a cover letter is named and described (D98, doc 15 §26.4): its day, its length, the CV it
// goes with, and its size, as the tab's rows and the letter's page say them.
import { type TFunction } from 'i18next';

import {
  type CoverLetter,
  type CoverLetterDetails,
  type CoverLetterLength,
  coverLetterLength,
  coverLetterText,
  coverLetterWords,
  isLetterSaved,
} from '@/core/profile/coverLetters';
import { type CvVersion } from '@/core/profile/cvVersions';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

export const letterDay = (letter: Pick<CoverLetter, 'createdAt'>) =>
  letter.createdAt === null ? '' : formatDay(letter.createdAt);

/** "one page", "short, for an email", "for a form's box". */
export const lengthText = (t: TFunction, length: CoverLetterLength) =>
  length.kind === 'short'
    ? t('letters.lengthShortMeta')
    : length.kind === 'box'
      ? t('letters.lengthBoxMeta')
      : t('letters.lengthPageMeta');

/** The CV the letter goes with: one of the versions, one removed since, or none. */
export const goesWithOf = (
  letter: Pick<CoverLetter, 'cvVersionId'>,
  versions: CvVersion[],
):
  | { kind: 'cv'; version: CvVersion }
  | { kind: 'removed' }
  | { kind: 'none' } => {
  if (!letter.cvVersionId) {
    return { kind: 'none' };
  }
  const version = versions.find(({ id }) => id === letter.cvVersionId);
  return version ? { kind: 'cv', version } : { kind: 'removed' };
};

const cvDay = (version: CvVersion) =>
  version.createdAt === null ? '' : formatDay(version.createdAt);

/** "Goes with your CV of 11 Oct 2026", "Goes with a CV you've removed", "With no CV". */
export const goesWithText = (
  t: TFunction,
  letter: Pick<CoverLetter, 'cvVersionId'>,
  versions: CvVersion[],
  lower = false,
) => {
  const goesWith = goesWithOf(letter, versions);
  switch (goesWith.kind) {
    case 'cv':
      return t(lower ? 'letters.goesWithLower' : 'letters.goesWith', {
        date: cvDay(goesWith.version),
      });
    case 'removed':
      return t(
        lower ? 'letters.goesWithRemovedLower' : 'letters.goesWithRemoved',
      );
    case 'none':
      return t(lower ? 'letters.noCvLower' : 'letters.noCv');
  }
};

/** "about 297 words", or a form's box "1,214 characters": as the text copies. */
export const sizeText = (
  t: TFunction,
  letter: CoverLetter,
  details?: CoverLetterDetails | null,
) => {
  const text = coverLetterText(letter, details);
  return letter.length.kind === 'box'
    ? t('letters.characters', {
        count: coverLetterLength(text),
        formatted: coverLetterLength(text).toLocaleString('en-GB'),
      })
    : t('letters.aboutWords', { count: coverLetterWords(text) });
};

/** A row of the tab: "From your draft · for a form's box · 1,214 characters". */
export const letterRowMeta = (
  t: TFunction,
  letter: CoverLetter,
  versions: CvVersion[],
  details?: CoverLetterDetails | null,
) =>
  [
    letter.draft ? t('letters.fromDraft') : goesWithText(t, letter, versions),
    lengthText(t, letter.length),
    letter.status === 'ready' ? sizeText(t, letter, details) : null,
  ]
    .filter(Boolean)
    .join(' · ');

/** Under the letter's title: "Written for this job on 27 Oct 2026 · one page · goes with your CV of 11 Oct 2026". */
export const letterSubtitle = (
  t: TFunction,
  letter: CoverLetter,
  versions: CvVersion[],
) =>
  [
    letter.status === 'creating'
      ? t('letters.forThisJob')
      : letter.draft
        ? t('letters.writtenFromDraftOn', { date: letterDay(letter) })
        : t('letters.writtenForJobOn', { date: letterDay(letter) }),
    isLetterSaved(letter)
      ? t('letters.yourVersionMeta')
      : letter.draft
        ? t(
            letter.draft.mode === 'rewrite'
              ? 'letters.draftRewritten'
              : 'letters.draftPolished',
          )
        : null,
    lengthText(t, letter.length),
    goesWithText(t, letter, versions, true),
  ]
    .filter(Boolean)
    .join(' · ');
