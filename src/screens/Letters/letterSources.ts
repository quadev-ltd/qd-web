// Where a letter's sentences come from (D98, doc 22 §4.3): a profile item (named by its resource),
// the candidate's words (why this job, what was asked, the draft, an answer), the job posting, or the
// CV the letter goes with. The paragraph line names them briefly; a sentence opened shows each.
import { type TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { goesWithOf } from './letterMeta';

import {
  type ProfileResource,
  type SkillMapItem,
} from '@/core/profile/contract';
import {
  type CoverLetter,
  type CoverLetterSentence,
  type CoverLetterSource,
  type CoverLetterStatement,
} from '@/core/profile/coverLetters';
import { type CvVersion } from '@/core/profile/cvVersions';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import useItems from '@/screens/Cv/review/useItems';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** One source of a sentence, with what the page can show of it. */
export type LetterSourceShown =
  | {
      kind: 'item';
      itemId: string;
      /** Absent while the items are read, or when it was removed since. */
      item?: SkillMapItem;
      resource?: ProfileResource;
    }
  | { kind: 'statement'; id: string; statement?: CoverLetterStatement }
  | { kind: 'job'; quote?: string }
  | { kind: 'cv'; version?: CvVersion; removed: boolean };

const STATEMENT_KEYS = {
  why: 'letters.sourceWhy',
  note: 'letters.sourceAsked',
  draft: 'letters.sourceDraft',
  answer: 'letters.sourceAnswer',
  edit: 'letters.sourceYourWords',
} as const satisfies Record<CoverLetterStatement['kind'], string>;

/** A source's name in a paragraph's line, lower case: "Maya Okafor CV 2026", "your draft". */
export const sourceName = (t: TFunction, source: LetterSourceShown): string => {
  switch (source.kind) {
    case 'item':
      return source.resource?.title ?? t('letters.sourceProfile');
    case 'statement':
      return source.statement
        ? t(STATEMENT_KEYS[source.statement.kind])
        : t('letters.sourceYourWords');
    case 'job':
      return t('letters.sourceJob');
    case 'cv':
      return source.version
        ? t('letters.sourceCv', {
            date:
              source.version.createdAt === null
                ? ''
                : formatDay(source.version.createdAt),
          })
        : t('letters.sourceCvRemoved');
  }
};

/** What the page knows of a letter's sources, and how it names them. */
export const useLetterSources = (letter: CoverLetter | undefined) => {
  const { t } = useTranslation();
  const { resources } = useInterviewProfile();
  const { versions } = useCvVersions();
  const items = useItems(
    Boolean(
      letter?.paragraphs?.some(({ sentences }) =>
        sentences.some(({ sources }) =>
          sources.some(({ kind }) => kind === 'item'),
        ),
      ),
    ),
  );

  const shown = (source: CoverLetterSource): LetterSourceShown => {
    switch (source.kind) {
      case 'item': {
        const item = items?.get(source.itemId);
        return {
          kind: 'item',
          itemId: source.itemId,
          item,
          resource: item
            ? resources.find(({ id }) => id === item.resourceId)
            : undefined,
        };
      }
      case 'statement':
        return {
          kind: 'statement',
          id: source.id,
          statement: letter?.statements.find(({ id }) => id === source.id),
        };
      case 'job':
        return { kind: 'job', quote: source.quote };
      case 'cv': {
        const goesWith = letter
          ? goesWithOf(letter, versions)
          : { kind: 'none' as const };
        return goesWith.kind === 'cv'
          ? { kind: 'cv', version: goesWith.version, removed: false }
          : { kind: 'cv', removed: true };
      }
    }
  };

  /** A sentence's sources, as the page shows them. A sentence edited has the candidate's words only. */
  const sourcesOf = (sentence: CoverLetterSentence) =>
    sentence.state === 'edited' ? [] : sentence.sources.map(shown);

  /** The names of a paragraph's sources, each once, in their order. */
  const namesOf = (sentences: CoverLetterSentence[]) => {
    const names: string[] = [];
    for (const sentence of sentences) {
      const own =
        sentence.state === 'edited'
          ? [t('letters.sourceEdited')]
          : sourcesOf(sentence).map(source => sourceName(t, source));
      for (const name of own) {
        if (!names.includes(name)) {
          names.push(name);
        }
      }
    }
    return names;
  };

  return { sourcesOf, namesOf };
};
