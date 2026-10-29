// A cover letter as it copies and downloads (L2, D98): for one page, the candidate's name and
// details, the date, whom it is to with the company, and the role; then the greeting, the body and
// the sign-off with the name. The heading, the greeting and the sign-off come from the CV details,
// "To" and the convention, never from the writer. Each sentence can be selected, to see where it
// comes from; while "Show where each sentence comes from" is on, each paragraph says it. A number
// only the draft gives is marked, with a line under its paragraph, whether sources are shown or not
// (doc 22 §11.1): never in the text.
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import {
  COVER_LETTER_NOBODY,
  COVER_LETTER_SIGN_OFFS,
  type CoverLetter,
  coverLetterDate,
  type CoverLetterDetails,
  coverLetterGreeting,
  type CoverLetterMark,
  type CoverLetterSentence,
} from '@/core/profile/coverLetters';

/** The heading of a one-page letter, line by line, as coverLetterText writes it. */
export const letterHeading = (
  letter: Pick<CoverLetter, 'addressee' | 'job' | 'convention'>,
  details: CoverLetterDetails | null | undefined,
  date: Date,
) => {
  const clean = (value?: string) => value?.replaceAll(/\s+/g, ' ').trim() ?? '';
  const { role, company, reference } = letter.job;
  const ref = clean(reference);
  return {
    name: clean(details?.name),
    contact: [details?.location, details?.email, details?.phone]
      .map(clean)
      .filter(Boolean)
      .join(' · '),
    date: coverLetterDate(date, letter.convention),
    to: [clean(letter.addressee) || COVER_LETTER_NOBODY, clean(company)]
      .filter(Boolean)
      .join(', '),
    job: [
      clean(role),
      ref ? (clean(role) ? `(ref. ${ref})` : `Ref. ${ref}`) : '',
    ]
      .filter(Boolean)
      .join(' '),
  };
};

/** The marks a sentence shows: none once the candidate edited it. */
export const marksOf = (sentence: CoverLetterSentence): CoverLetterMark[] =>
  sentence.state === 'edited' ? [] : (sentence.draftOnly ?? []);

/** The sentence's text with its marks, each where `at` says (UTF-16 units). */
const MarkedText: React.FC<{ text: string; marks: CoverLetterMark[] }> = ({
  text,
  marks,
}) => {
  const ordered = [...marks]
    .filter(({ at, text: mark }) => text.slice(at, at + mark.length) === mark)
    .sort((a, b) => a.at - b.at);
  const parts: React.ReactNode[] = [];
  let from = 0;
  for (const { at, text: mark } of ordered) {
    if (at < from) {
      continue;
    }
    parts.push(text.slice(from, at));
    parts.push(
      <mark
        key={at}
        className="rounded-[4px] bg-warning-tint px-0.5 text-inherit underline decoration-warning decoration-dotted underline-offset-[3px]">
        {mark}
      </mark>,
    );
    from = at + mark.length;
  }
  parts.push(text.slice(from));
  return <>{parts}</>;
};

export interface LetterDocumentProps {
  letter: CoverLetter;
  details?: CoverLetterDetails | null;
  /** The day the letter is dated, today. */
  date: Date;
  showSources: boolean;
  /** "From the job posting · …" under a paragraph: the names of its sentences' sources. */
  sourcesOf: (sentences: CoverLetterSentence[]) => string[];
  selected?: string;
  onSelect: (sentenceId: string) => void;
}

export const LetterDocument: React.FC<LetterDocumentProps> = ({
  letter,
  details,
  date,
  showSources,
  sourcesOf,
  selected,
  onSelect,
}) => {
  const { t } = useTranslation();
  const heading =
    letter.length.kind === 'page'
      ? letterHeading(letter, details, date)
      : undefined;
  const name = details?.name?.replaceAll(/\s+/g, ' ').trim();
  // A removed sentence stays in its place, struck through, so it can be opened and restored; it is
  // never in the text.
  const paragraphs = (letter.paragraphs ?? [])
    .map(({ sentences }) => sentences)
    .filter(sentences => sentences.length > 0);

  return (
    <article
      aria-label={t('letters.documentLabel')}
      className="flex flex-col gap-5 rounded-[6px] border border-border-faint bg-surface px-[clamp(18px,5vw,56px)] pt-[clamp(20px,4vw,48px)] pb-[clamp(24px,4vw,56px)] text-[clamp(15px,1.4vw,16px)] leading-[1.65] shadow-card">
      {heading && (
        <>
          <div className="flex flex-col gap-1">
            {heading.name && (
              <p className="font-display text-[clamp(20px,2.4vw,26px)] leading-tight font-semibold wrap-anywhere">
                {heading.name}
              </p>
            )}
            {heading.contact && (
              <p className="text-sm leading-normal text-muted wrap-anywhere">
                {heading.contact}
              </p>
            )}
          </div>
          <div className="flex flex-col">
            <p>{heading.date}</p>
            <p className="mt-3 wrap-anywhere">{heading.to}</p>
            {heading.job && (
              <p className="mt-3 font-bold wrap-anywhere">{heading.job}</p>
            )}
          </div>
        </>
      )}
      <p>{coverLetterGreeting(letter.addressee)}</p>
      {paragraphs.map((sentences, index) => {
        const sources = sourcesOf(
          sentences.filter(({ state }) => state !== 'removed'),
        );
        const marked = sentences
          .filter(({ state }) => state !== 'removed')
          .flatMap(sentence =>
            marksOf(sentence).map(mark => ({ sentence, mark })),
          );
        return (
          <div key={sentences[0].id} className="flex flex-col gap-1">
            <p className="wrap-anywhere">
              {sentences.map((sentence, position) => (
                <span key={sentence.id}>
                  {position > 0 && ' '}
                  <button
                    type="button"
                    aria-pressed={selected === sentence.id}
                    // The label is what a screen reader says: a removed sentence says so.
                    aria-label={t(
                      sentence.state === 'removed'
                        ? 'letters.sentenceLabelRemoved'
                        : 'letters.sentenceLabel',
                      { paragraph: index + 1, text: sentence.text },
                    )}
                    onClick={() => onSelect(sentence.id)}
                    className={`inline cursor-pointer rounded-[6px] border-0 bg-transparent p-0 text-left font-[inherit] leading-[inherit] hover:bg-tint ${
                      selected === sentence.id
                        ? 'bg-tint outline-2 outline-offset-1 outline-primary'
                        : ''
                    } ${sentence.state === 'removed' ? 'text-muted line-through' : 'text-inherit'}`}>
                    <MarkedText
                      text={sentence.text}
                      marks={
                        sentence.state === 'removed' ? [] : marksOf(sentence)
                      }
                    />
                  </button>
                </span>
              ))}
            </p>
            {showSources && (
              <p className="flex items-start gap-1.5 text-[13px] leading-[1.4] text-muted">
                {sources.length > 0 && (
                  <span aria-hidden="true" className="flex pt-px">
                    <Icon name="file" size={13} />
                  </span>
                )}
                <span>
                  {sources.length > 0
                    ? t('letters.paragraphSources', {
                        sources: sources.join(' · '),
                      })
                    : t('letters.framesOnly')}
                </span>
              </p>
            )}
            {marked.map(({ sentence, mark }) => (
              <p
                key={`${sentence.id}-${mark.at}`}
                className="flex items-start gap-1.5 text-[13px] leading-[1.4] font-medium text-warning">
                <span aria-hidden="true" className="flex pt-0.5">
                  <Icon name="alert" size={15} />
                </span>
                <span>{t('letters.draftOnlyLine', { number: mark.text })}</span>
              </p>
            ))}
          </div>
        );
      })}
      <div className="flex flex-col">
        <p>{COVER_LETTER_SIGN_OFFS[letter.convention]}</p>
        {name && <p className="mt-5">{name}</p>}
      </div>
    </article>
  );
};

export default LetterDocument;
