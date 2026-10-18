// The CV of a version as a page (C3, doc 13 §16.4 item 1): its lines, each change numbered and
// marked where it applies, each open question where its line would go. With "Show changes"
// off, the text as it would be downloaded now (cvVersionText). Every change quotes the CV's
// text, so a mark is found by position, as the backend applies it.
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import {
  type CvChange,
  type CvQuestion,
  type CvVersion,
  cvVersionText,
} from '@/core/profile/cvVersions';

const BADGES = {
  brand: 'bg-primary',
  success: 'bg-success',
  danger: 'bg-danger',
  info: 'bg-chip-text',
} as const;

/** The number of a change (or "?1" for a question), as the list beside the CV has it. */
export const Badge: React.FC<{
  label: string;
  tone?: keyof typeof BADGES;
}> = ({ label, tone = 'brand' }) => (
  <span
    aria-hidden="true"
    className={`mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 align-[2px] font-display text-[11px] leading-none font-semibold text-white ${BADGES[tone]}`}>
    {label}
  </span>
);

const sr = (text: string) => <span className="sr-only">{text}</span>;

/** The list mark a line starts with, kept for a line added after it. */
const listMark = (line: string) => /^\s*(?:[-•*▪◦–]\s+)/.exec(line)?.[0] ?? '';

interface Span {
  start: number;
  end: number;
  change: CvChange;
  number: number;
}

interface Line {
  start: number;
  text: string;
  spans: Span[];
  /** Changes that add a line after this one. */
  adds: { change: CvChange; number: number }[];
  /** Questions about this line. */
  questions: { question: CvQuestion; number: number }[];
}

/** The CV's lines, each with the changes and questions it holds, found by position. */
const linesOf = (version: Pick<CvVersion, 'cv' | 'changes' | 'questions'>) => {
  const { cv } = version;
  let offset = 0;
  const lines: Line[] = cv.split('\n').map(text => {
    const line = { start: offset, text, spans: [], adds: [], questions: [] };
    offset += text.length + 1;
    return line;
  });
  const lineAt = (index: number) => {
    let found = lines[0];
    for (const line of lines) {
      if (line.start > index) {
        break;
      }
      found = line;
    }
    return found;
  };
  const trailing: { question: CvQuestion; number: number }[] = [];
  version.changes.forEach((change, index) => {
    const number = index + 1;
    const passage = change.action === 'add' ? change.after : change.original;
    const at = passage ? cv.indexOf(passage) : -1;
    if (at === -1) {
      return;
    }
    const line = lineAt(at);
    if (change.action === 'add') {
      lineAt(at + passage.length).adds.push({ change, number });
      return;
    }
    const start = at - line.start;
    const end = Math.min(line.text.length, start + passage.length);
    // A passage another change already marks is left to that one, as the text leaves it out.
    if (!line.spans.some(span => start < span.end && span.start < end)) {
      line.spans.push({ start, end, change, number });
    }
  });
  version.questions.forEach((question, index) => {
    const number = index + 1;
    const at = question.passage ? cv.indexOf(question.passage) : -1;
    if (at === -1) {
      trailing.push({ question, number });
    } else {
      lineAt(at + question.passage.length).questions.push({ question, number });
    }
  });
  for (const line of lines) {
    line.spans.sort((a, b) => a.start - b.start);
  }
  return { lines, trailing };
};

export interface CvDocumentProps {
  version: Pick<CvVersion, 'cv' | 'changes' | 'questions'>;
  /** Marks on ("Show changes"), or the text as it would be downloaded. */
  marks: boolean;
}

export const CvDocument: React.FC<CvDocumentProps> = ({ version, marks }) => {
  const { t } = useTranslation();
  const page =
    'rounded-[6px] border border-border-faint bg-surface p-[clamp(18px,4vw,44px)] text-[15px] leading-relaxed shadow-card wrap-anywhere';

  if (!marks) {
    return (
      <article
        aria-label={t('cv.yourCvTitle')}
        className={`${page} whitespace-pre-wrap`}>
        {cvVersionText(version)}
      </article>
    );
  }

  const { lines, trailing } = linesOf(version);
  const decided = (change: CvChange) =>
    change.decision === 'accepted' || change.decision === 'edited';
  const wordsOf = (change: CvChange) =>
    (change.decision === 'edited' ? change.text : change.proposed) ?? '';

  const markOf = ({ change, number }: Span, text: string): ReactNode => {
    const label = String(number);
    if (change.decision === 'kept') {
      return text;
    }
    if (change.action === 'remove') {
      return decided(change) ? null : (
        <span className="rounded-[6px] bg-danger-tint px-1.5 py-0.5 text-danger [box-decoration-break:clone]">
          {sr(t('cv.markRemoves', { number }))}
          <Badge label={label} tone="danger" />
          <s>{text}</s>
        </span>
      );
    }
    if (decided(change)) {
      return (
        <>
          {wordsOf(change)}{' '}
          {sr(
            t('cv.markChange', {
              number,
              state: t(`cv.markState_${change.decision}`),
            }),
          )}
          <Badge label={label} tone="success" />
        </>
      );
    }
    return (
      <span className="rounded-[6px] bg-tint px-1.5 py-0.5 shadow-[inset_3px_0_0_var(--color-primary)] [box-decoration-break:clone]">
        {sr(t('cv.markChange', { number, state: t('cv.markState_open') }))}
        <Badge label={label} />
        {text}
      </span>
    );
  };

  const rendered: ReactNode[] = [];
  const addQuestions = (
    key: string,
    items: { question: CvQuestion; number: number }[],
    mark: string,
  ) => {
    for (const { question, number } of items) {
      if (question.status === 'answered' && question.answer) {
        rendered.push(
          <p key={`${key}-q${number}`}>
            {mark}
            {question.answer} <Badge label={`?${number}`} tone="info" />
          </p>,
        );
      } else if (question.status === 'open') {
        rendered.push(
          <p
            key={`${key}-q${number}`}
            className="my-1 flex items-start gap-2 rounded-[8px] border border-dashed border-chip-text bg-chip px-2.5 py-2 text-sm text-chip-text">
            <span className="flex pt-0.5">
              <Icon name="help" size={16} />
            </span>
            <span>{t('cv.questionInCv', { number, text: question.text })}</span>
          </p>,
        );
      }
    }
  };

  lines.forEach((line, index) => {
    const whole = line.spans.find(
      ({ change, start, end }) =>
        change.action === 'remove' &&
        decided(change) &&
        line.text.slice(0, start).trim() === listMark(line.text).trim() &&
        line.text.slice(end).trim() === '',
    );
    if (!whole) {
      const parts: ReactNode[] = [];
      let position = 0;
      for (const span of line.spans) {
        parts.push(line.text.slice(position, span.start));
        parts.push(
          <span key={span.change.id}>
            {markOf(span, line.text.slice(span.start, span.end))}
          </span>,
        );
        position = span.end;
      }
      parts.push(line.text.slice(position));
      rendered.push(
        <p key={index} className="min-h-[1.6em]">
          {parts}
        </p>,
      );
    }
    const mark = listMark(line.text);
    for (const { change, number } of line.adds) {
      if (change.decision === 'kept') {
        continue;
      }
      rendered.push(
        decided(change) ? (
          <p key={`${index}-${change.id}`}>
            {mark}
            {wordsOf(change)}{' '}
            {sr(
              t('cv.markChange', {
                number,
                state: t(`cv.markState_${change.decision}`),
              }),
            )}
            <Badge label={String(number)} tone="success" />
          </p>
        ) : (
          <p key={`${index}-${change.id}`}>
            {mark}
            <span className="rounded-[6px] bg-tint px-1.5 py-0.5 shadow-[inset_3px_0_0_var(--color-primary)] [box-decoration-break:clone]">
              {sr(
                t('cv.markChange', { number, state: t('cv.markState_open') }),
              )}
              <Badge label={String(number)} />
              {change.proposed}
            </span>
          </p>
        ),
      );
    }
    addQuestions(String(index), line.questions, mark);
  });
  addQuestions('end', trailing, '');

  return (
    <article
      aria-label={t('cv.yourCvTitle')}
      className={`${page} flex flex-col whitespace-pre-wrap`}>
      {rendered}
    </article>
  );
};

export default CvDocument;
