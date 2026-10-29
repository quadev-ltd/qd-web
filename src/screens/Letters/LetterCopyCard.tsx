// Beside a ready letter (Web-L2-Letter, D98): copying comes first, since a letter is often pasted
// into an email or a form; then the downloads, the same text as a PDF or a Word file; then "Did you
// send it?". A form's box has no heading or downloads: the form has the candidate's details. The
// text is `coverLetterText`, dated today, with no mark of a number only the draft gives.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { lengthText } from './letterMeta';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import {
  type CoverLetter,
  type CoverLetterDetails,
  coverLetterText,
} from '@/core/profile/coverLetters';
import { logProfileError } from '@/core/profile/errors';
import { useSessionUser } from '@/core/session/hooks';
import { type CvBlock, cvPaper } from '@/screens/Cv/download/cvFile';
import { BlocksDownloadButton } from '@/screens/Cv/download/DownloadButton';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** How long "Copied" stays. */
const COPIED_MS = 2_500;

/** The file's blocks: the name and the details at the top of a one-page letter, then each paragraph. */
export const letterBlocks = (
  letter: CoverLetter,
  details: CoverLetterDetails | null | undefined,
  date: Date,
): CvBlock[] => {
  const blocks = coverLetterText(letter, details, { date }).split('\n\n');
  if (letter.length.kind !== 'page') {
    return blocks.map(text => ({ kind: 'paragraph', text }));
  }
  const [heading, ...rest] = blocks;
  const [first, ...lines] = heading.split('\n');
  const name = details?.name?.replaceAll(/\s+/g, ' ').trim();
  // The first line is the details, with the name first when there is one.
  const top: CvBlock[] = [];
  if (name && first.startsWith(name)) {
    top.push({ kind: 'name', text: name });
    const contact = first.slice(name.length).replace(/^ · /, '');
    if (contact) {
      top.push({ kind: 'contact', text: contact });
    }
  } else if (details && first) {
    top.push({ kind: 'contact', text: first });
  } else {
    lines.unshift(first);
  }
  return [
    ...top,
    ...lines.map(text => ({ kind: 'paragraph' as const, text })),
    ...rest.map(text => ({ kind: 'paragraph' as const, text })),
  ];
};

export interface LetterCopyCardProps {
  letter: CoverLetter;
  details?: CoverLetterDetails | null;
  date: Date;
  /** The CV it goes with, when there is one: "Mark it as the one you sent …, with your CV of 11 Oct". */
  cvDay?: string;
  /** What the file is called, without its extension. */
  fileTitle: string;
  onMarkSent: (sent: boolean) => Promise<void>;
  /** The candidate's own version: it copies as it is, with no sources to turn off. */
  saved?: boolean;
}

export const LetterCopyCard: React.FC<LetterCopyCardProps> = ({
  letter,
  details,
  date,
  cvDay,
  fileTitle,
  onMarkSent,
  saved = false,
}) => {
  const { t } = useTranslation();
  const uid = useSessionUser()?.uid;
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const box = letter.length.kind === 'box';
  const sent = letter.sentAt !== undefined && letter.sentAt !== null;

  const copy = async () => {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(
        coverLetterText(letter, details, { date }),
      );
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopyFailed(true);
    }
  };

  const mark = async (value: boolean) => {
    setMarking(true);
    setMarkFailed(false);
    try {
      await onMarkSent(value);
    } catch (error) {
      logProfileError('markCoverLetterSent', error, uid);
      setMarkFailed(true);
    } finally {
      setMarking(false);
    }
  };

  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="letter-copy"
      className="gap-3 p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="text" size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2
            id="letter-copy"
            className="font-display text-[18px] leading-tight font-semibold">
            {box
              ? t('letters.copyBoxTitle')
              : letter.length.kind === 'short'
                ? t('letters.copyShortTitle')
                : t('letters.copyPageTitle')}
          </h2>
          <p className="text-sm leading-normal text-muted">
            {letter.length.kind === 'box'
              ? t('letters.copyBoxMeta', {
                  max: letter.length.maxChars.toLocaleString('en-GB'),
                })
              : t(`letters.conventionMeta_${letter.convention}`, {
                  length: lengthText(t, letter.length),
                })}
          </p>
        </div>
      </div>
      <p className="text-sm leading-normal text-muted">
        {box
          ? t('letters.copyBoxText')
          : saved
            ? t('letters.copySavedText')
            : t('letters.copyText')}
      </p>
      <div className="flex flex-wrap items-start gap-2.5">
        <Button onClick={copy} className="gap-2" aria-live="polite">
          <Icon name={copied ? 'check' : 'text'} size={18} />
          {copied ? t('letters.copiedButton') : t('letters.copyButton')}
        </Button>
        {!box && (
          <BlocksDownloadButton
            variant="secondary"
            operation="downloadLetter"
            fileTitle={fileTitle}
            paper={cvPaper(letter.convention)}
            blocks={() => letterBlocks(letter, details, date)}
          />
        )}
      </div>
      {copyFailed && (
        <Banner tone="danger" role="alert">
          {t('letters.copyFailedMessage')}
        </Banner>
      )}
      <div className="my-1 h-px bg-border-faint" />
      <h3 className="text-base leading-tight font-semibold">
        {t('letters.sentTitle')}
      </h3>
      {sent ? (
        <>
          <span className="flex">
            <Chip tone="success" icon="check">
              {t('letters.sentChip')}
            </Chip>
          </span>
          <p className="text-sm leading-normal text-muted">
            {t('letters.sentOn', {
              date: letter.sentAt ? formatDay(letter.sentAt) : '',
            })}
          </p>
          <Button
            variant="quiet"
            size="small"
            disabled={marking}
            onClick={() => mark(false)}
            className="-ml-1.5 self-start text-[15px]">
            {t('letters.unmarkButton')}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm leading-normal text-muted">
            {cvDay
              ? t('letters.markTextWithCv', { date: cvDay })
              : t('letters.markText')}
          </p>
          <Button
            variant="secondary"
            size="small"
            disabled={marking}
            aria-busy={marking}
            onClick={() => mark(true)}
            className="gap-2 self-start text-[15px]">
            {marking ? (
              <Spinner size="small" decorative />
            ) : (
              <Icon name="check" size={18} />
            )}
            {t('letters.markButton')}
          </Button>
        </>
      )}
      {markFailed && (
        <Banner tone="danger" role="alert">
          {t('letters.markFailedMessage')}
        </Banner>
      )}
    </Card>
  );
};

export default LetterCopyCard;
