// "This sentence" (Web-L2-Sentence, D98): a sentence of the letter opened beside it, with "Where it
// says this": each profile item as its resource says it, the candidate's own words quoted, the job
// posting (its words when the backend found them, otherwise the way to its text in Details), and the
// CV it goes with. A sentence that frames the letter has no facts, and one the candidate edited is
// in their words. Then Edit (in their words: no source needed), "Remove this sentence" (kept, to
// restore), and Restore for one removed or edited.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { type LetterSourceShown } from './letterSources';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import {
  COVER_LETTER_SENTENCE_MAX_CHARS,
  type CoverLetterSentence,
  type ReviseCoverLetterSentenceRequest,
} from '@/core/profile/coverLetters';
import { logProfileError } from '@/core/profile/errors';
import { useSessionUser } from '@/core/session/hooks';
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
  /** Edits it in the candidate's words, removes it, or restores what was written (slice 29). */
  onRevise: (request: ReviseCoverLetterSentenceRequest) => Promise<void>;
  /** A saved letter (every sentence the candidate's): nothing to restore a sentence to. */
  saved: boolean;
}

export const SentencePanel: React.FC<SentencePanelProps> = ({
  sentence,
  paragraph,
  sources,
  detailsPath,
  paths,
  onClose,
  bare = false,
  onRevise,
  saved,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const [editing, setEditing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const length = editing?.trim().length ?? 0;
  const tooLong = length > COVER_LETTER_SENTENCE_MAX_CHARS;

  const revise = async (request: ReviseCoverLetterSentenceRequest) => {
    setBusy(true);
    setFailed(false);
    try {
      await onRevise(request);
      setEditing(undefined);
    } catch (error) {
      logProfileError('reviseCoverLetterSentence', error, uid);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const actions =
    editing !== undefined ? (
      <form
        noValidate
        onSubmit={event => {
          event.preventDefault();
          if (length > 0 && !tooLong) {
            revise({ action: 'edit', text: editing.trim() });
          }
        }}
        className="flex flex-col gap-3">
        <FormTextArea
          name="sentence"
          rows={4}
          label={t('letters.editSentenceField')}
          hint={t('letters.editSentenceHint')}
          value={editing}
          onChange={event => setEditing(event.target.value)}
          disabled={busy}
          counter={{ length, max: COVER_LETTER_SENTENCE_MAX_CHARS }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            size="small"
            disabled={busy || length === 0 || tooLong}
            aria-busy={busy}
            className="gap-2">
            {busy && <Spinner size="small" decorative />}
            {t('letters.saveSentenceButton')}
          </Button>
          <Button
            variant="quiet"
            size="small"
            disabled={busy}
            onClick={() => setEditing(undefined)}>
            {t('letters.cancelButton')}
          </Button>
        </div>
      </form>
    ) : sentence.state === 'removed' ? (
      <Button
        variant="secondary"
        size="small"
        disabled={busy}
        aria-busy={busy}
        onClick={() => revise({ action: 'restore' })}
        className="gap-2 self-start">
        <Icon name="refresh" size={18} />
        {t('letters.restoreSentenceButton')}
      </Button>
    ) : (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="small"
          disabled={busy}
          onClick={() => setEditing(sentence.text)}
          className="gap-2">
          <Icon name="edit" size={18} />
          {t('letters.editSentenceButton')}
        </Button>
        <Button
          variant="quietDanger"
          size="small"
          disabled={busy}
          onClick={() => revise({ action: 'remove' })}
          className="gap-2">
          <Icon name="trash" size={18} />
          {t('letters.removeSentenceButton')}
        </Button>
        {sentence.state === 'edited' && !saved && (
          <Button
            variant="quiet"
            size="small"
            disabled={busy}
            onClick={() => revise({ action: 'restore' })}
            className="gap-2">
            <Icon name="refresh" size={18} />
            {t('letters.restoreWrittenButton')}
          </Button>
        )}
      </div>
    );

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
      <p
        className={`text-base leading-normal font-medium wrap-anywhere ${sentence.state === 'removed' ? 'text-muted line-through' : ''}`}>
        {sentence.text}
      </p>
      {sentence.state === 'removed' && (
        <p className="text-sm leading-normal text-muted">
          {t('letters.removedSentence')}
        </p>
      )}
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
      {actions}
      {failed && (
        <Banner tone="danger" role="alert">
          {t('letters.reviseFailedMessage')}
        </Banner>
      )}
    </section>
  );
};

export default SentencePanel;
