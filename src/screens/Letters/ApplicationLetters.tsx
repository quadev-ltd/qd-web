// "Cover letter" on an application's "CV and letter" tab (Web-A6-CVLetter, D98): "This job asks for
// a cover letter" when its posting says so, the letters for the job (the newest first, each with
// what it goes with, its length and size, and whether it was sent, is being written, couldn't be
// written or has questions), and "Write a cover letter" / "Improve my draft", which open "New cover
// letter".
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { letterDay, letterRowMeta } from './letterMeta';
import NewLetterPanel, { type LetterStart } from './NewLetterPanel';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { type JobApplication, jobStatusOf } from '@/core/profile/applications';
import {
  type CoverLetter,
  openLetterQuestions,
} from '@/core/profile/coverLetters';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import { applicationLetterPath } from '@/core/profile/paths';
import {
  useCoverLetters,
  useFollowLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { versionDay } from '@/screens/Cv/cvMeta';

const LetterChip: React.FC<{ letter: CoverLetter }> = ({ letter }) => {
  const { t } = useTranslation();
  if (letter.status === 'creating') {
    return <Chip tone="neutral">{t('letters.writingChip')}</Chip>;
  }
  if (letter.status === 'failed') {
    return <Chip tone="danger">{t('letters.failedChip')}</Chip>;
  }
  if (letter.sentAt !== undefined && letter.sentAt !== null) {
    return (
      <Chip tone="success" icon="check">
        {t('letters.sentChip')}
      </Chip>
    );
  }
  const open = openLetterQuestions(letter);
  return open > 0 ? (
    <Chip tone="info" icon="help">
      {t('letters.questionsChip', { count: open })}
    </Chip>
  ) : null;
};

export const ApplicationLetters: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const { versions, details } = useCvVersions();
  const { status, letters, reload } = useCoverLetters(application.id);
  const { reread } = useLettersLeft();
  useFollowLetters(application.id, reread);
  const [start, setStart] = useState<LetterStart>();

  const ready =
    jobStatusOf(application) === 'ready' && Boolean(application.jobDescription);
  const sentCv = versions.find(
    ({ target, sentAt }) =>
      target.kind === 'job' &&
      target.applicationId === application.id &&
      sentAt !== undefined &&
      sentAt !== null,
  );

  let list: React.ReactNode;
  if (status === 'loading' && letters.length === 0) {
    list = (
      <div className="flex justify-center py-8 text-primary">
        <Spinner />
      </div>
    );
  } else if (status === 'error') {
    list = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('letters.retryButton')}
          </Button>
        }>
        {t('letters.listLoadErrorMessage')}
      </Banner>
    );
  } else if (letters.length === 0) {
    list = (
      <Card elevation="raised" className="p-5">
        <p className="text-[15px] leading-normal text-muted">
          {sentCv
            ? t('letters.noneYetWithCv', { date: versionDay(sentCv) })
            : t('letters.noneYet')}
        </p>
      </Card>
    );
  } else {
    list = (
      <Card
        as="section"
        elevation="raised"
        aria-labelledby="letters-for-job"
        className="gap-1 p-5">
        <h3
          id="letters-for-job"
          className="font-display text-[17px] leading-tight font-semibold">
          {t('letters.forThisJobTitle')}
        </h3>
        <ul className="flex flex-col">
          {letters.map(letter => (
            <li
              key={letter.id}
              className="relative flex items-center gap-3 border-t border-border-faint py-3 first:border-t-0">
              <span
                aria-hidden="true"
                className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
                <Icon name="text" size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <Link
                  to={applicationLetterPath(application.id, letter.id)}
                  className="text-base leading-normal font-medium text-text no-underline after:absolute after:inset-0 hover:text-text hover:underline">
                  {t('letters.letterOf', { date: letterDay(letter) })}
                </Link>
                <p className="text-sm leading-normal text-muted wrap-anywhere">
                  {letterRowMeta(t, letter, versions, details)}
                </p>
                <span className="mt-1 flex empty:hidden">
                  <LetterChip letter={letter} />
                </span>
              </div>
              <span aria-hidden="true" className="flex text-muted">
                <Icon name="right" size={18} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <section aria-labelledby="cover-letter" className="flex flex-col gap-4">
      <h2
        id="cover-letter"
        className="font-display text-[20px] leading-tight font-semibold">
        {t('letters.sectionTitle')}
      </h2>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
          {application.letterAsked === 'required' && (
            <Banner tone="info">{t('letters.jobAsksBanner')}</Banner>
          )}
          {list}
        </div>
        <Card
          as="section"
          elevation="raised"
          aria-labelledby="letter-start"
          className="min-w-0 flex-[1_1_300px] gap-3 p-5">
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-full bg-tint text-primary">
            <Icon name="text" size={20} />
          </span>
          <h3
            id="letter-start"
            className="font-display text-[18px] leading-tight font-semibold">
            {t('letters.startTitle')}
          </h3>
          <p className="text-[15px] leading-normal text-muted">
            {ready ? t('letters.startText') : t('letters.jobNotReady')}
          </p>
          <Button
            size="small"
            disabled={!ready}
            onClick={() => setStart('write')}
            className="gap-2 self-start">
            <Icon name="plus" size={18} />
            {t('letters.writeButton')}
          </Button>
          <Button
            variant="secondary"
            size="small"
            disabled={!ready}
            onClick={() => setStart('draft')}
            className="gap-2 self-start">
            <Icon name="edit" size={18} />
            {t('letters.improveDraftButton')}
          </Button>
        </Card>
      </div>
      {start && (
        <NewLetterPanel
          application={application}
          start={start}
          onClose={() => setStart(undefined)}
        />
      )}
    </section>
  );
};

export default ApplicationLetters;
