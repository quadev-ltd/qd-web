// "This sentence" (Web-L2-Sentence, D98): a sentence of the letter opened beside it, with "Where it
// says this": each profile item as its resource says it, the candidate's own words quoted, the job
// posting (its words when the backend found them, otherwise the way to its text in Details), and the
// CV it goes with. A sentence that frames the letter has no facts, and one the candidate edited is
// in their words. Editing and removing it come with the next slice (doc 15 §26.2).
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type LetterSourceShown } from './letterSources';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import { type CoverLetterSentence } from '@/core/profile/coverLetters';
import { type CvPaths } from '@/screens/Cv/useCvPaths';
import { RESOURCE_TYPE_KEYS } from '@/screens/Profile/AddResource/resourceTypes';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

const QUOTE =
  'rounded-[12px] px-3.5 py-3 text-[15px] leading-normal wrap-anywhere';
/** The candidate's words, tinted as "Your words" are elsewhere. */
const THEIR_WORDS = `${QUOTE} bg-tint shadow-[inset_3px_0_0_var(--color-primary)]`;

const STATEMENT_TITLES = {
  why: 'letters.whyTitle',
  note: 'letters.askedTitle',
  draft: 'letters.draftTitle',
  answer: 'letters.answerTitle',
  edit: 'letters.yourWordsTitle',
} as const;

const Source: React.FC<{
  source: LetterSourceShown;
  detailsPath: string;
  paths: CvPaths;
}> = ({ source, detailsPath, paths }) => {
  const { t } = useTranslation();
  const head = (
    icon: 'file' | 'edit' | 'case',
    title: string,
    aside?: string,
  ) => (
    <p className="flex items-center gap-2 text-sm">
      <span className="flex text-primary">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1 font-bold wrap-anywhere">{title}</span>
      {aside && <span className="text-[13px] text-muted">{aside}</span>}
    </p>
  );
  switch (source.kind) {
    case 'item':
      if (!source.item || source.item.hidden || !source.resource) {
        return (
          <li className="flex flex-col gap-1 rounded-[12px] border border-dashed border-border px-3.5 py-3">
            <p className="text-sm font-bold">{t('cv.sourceGoneTitle')}</p>
            <p className="text-sm leading-normal text-muted">
              {t('cv.sourceGoneText')}
            </p>
          </li>
        );
      }
      return (
        <li className="flex flex-col gap-1.5">
          {head(
            'file',
            source.resource.title,
            t(RESOURCE_TYPE_KEYS[source.resource.type]),
          )}
          <blockquote className={`${QUOTE} bg-background`}>
            {source.item.evidence || source.item.text}
          </blockquote>
        </li>
      );
    case 'statement':
      return (
        <li className="flex flex-col gap-1.5">
          {head(
            'edit',
            t(
              source.statement
                ? STATEMENT_TITLES[source.statement.kind]
                : 'letters.yourWordsTitle',
            ),
            t('letters.yourWords'),
          )}
          {source.statement?.question && (
            <p className="text-sm leading-normal text-muted">
              {source.statement.question}
            </p>
          )}
          {source.statement && (
            <blockquote className={THEIR_WORDS}>
              {source.statement.text}
            </blockquote>
          )}
        </li>
      );
    case 'job':
      return (
        <li className="flex flex-col gap-1.5">
          {head('case', t('letters.jobTitle'))}
          {source.quote ? (
            <blockquote className={`${QUOTE} bg-background`}>
              {source.quote}
            </blockquote>
          ) : (
            <p className="text-sm leading-normal text-muted">
              {t('letters.jobNoQuote')}{' '}
              <Link to={detailsPath} className="font-medium">
                {t('letters.openDetailsLink')}
              </Link>
            </p>
          )}
        </li>
      );
    case 'cv':
      return (
        <li className="flex flex-col gap-1.5">
          {head(
            'file',
            source.version
              ? t('letters.cvTitle', {
                  date:
                    source.version.createdAt === null
                      ? ''
                      : formatDay(source.version.createdAt),
                })
              : t('letters.cvRemovedTitle'),
          )}
          {source.version ? (
            <Link
              to={paths.version(source.version.id)}
              className="self-start text-sm font-medium">
              {t('letters.openCvLink')}
            </Link>
          ) : (
            <p className="text-sm leading-normal text-muted">
              {t('letters.cvRemovedText')}
            </p>
          )}
        </li>
      );
  }
};

export interface SentencePanelProps {
  sentence: CoverLetterSentence;
  paragraph: number;
  sources: LetterSourceShown[];
  detailsPath: string;
  paths: CvPaths;
  onClose: () => void;
  /** In a side panel at phone width, which has its own heading and close button. */
  bare?: boolean;
}

export const SentencePanel: React.FC<SentencePanelProps> = ({
  sentence,
  paragraph,
  sources,
  detailsPath,
  paths,
  onClose,
  bare = false,
}) => {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t('letters.thisSentence')}
      className={
        bare
          ? 'flex flex-col gap-3.5'
          : 'flex flex-col gap-3.5 rounded-card border-2 border-primary bg-surface p-4 shadow-card'
      }>
      <div className="flex flex-wrap items-center gap-2">
        {!bare && <Chip tone="brand">{t('letters.thisSentence')}</Chip>}
        <p className="min-w-0 flex-1 text-[13px] text-muted">
          {t('letters.paragraphNumber', { number: paragraph })}
        </p>
        {!bare && (
          <Button
            variant="quiet"
            size="small"
            aria-label={t('letters.closeSentence')}
            onClick={onClose}
            className="px-2">
            <Icon name="x" size={18} />
          </Button>
        )}
      </div>
      <p className="text-base leading-normal font-medium wrap-anywhere">
        {sentence.text}
      </p>
      <div className="flex flex-col gap-2.5">
        <p className="text-[13px] font-bold tracking-[0.04em] text-muted uppercase">
          {t('letters.whereItSaysThis')}
        </p>
        {sentence.state === 'edited' ? (
          <p className="text-[15px] leading-normal">
            {t('letters.editedByYou')}
          </p>
        ) : sentence.kind === 'frame' || sources.length === 0 ? (
          <p className="text-[15px] leading-normal">
            {t('letters.frameNoFacts')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {sources.map((source, index) => (
              <Source
                key={`${source.kind}-${index}`}
                source={source}
                detailsPath={detailsPath}
                paths={paths}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};

export default SentencePanel;
