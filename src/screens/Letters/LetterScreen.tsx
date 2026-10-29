// A cover letter of an application (L2, D98, doc 15 §26): the way back to its "CV and letter" tab
// (D96), "Cover letter · {company}" with what it was written from, then by its state. Being written:
// "Writing your letter", read again every 2 seconds. Could not be written: why, with "Try again",
// which asks for a new letter with the same settings. Ready: "What we did and why", "What we did
// with your draft", the letter with its sources and marks, a sentence opened beside it to edit,
// remove or restore, the copy card, "Change it quickly" and the questions, and "Edit the whole
// letter"; a saved letter shows "Your version" instead of its sources, quick changes and questions.
// "Remove this letter" at the foot of every state.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import EditWholeLetter from './EditWholeLetter';
import {
  DraftCard,
  LetterQuestionsCard,
  QuickChangesCard,
  YourVersionCard,
} from './LetterChangeCards';
import LetterCopyCard from './LetterCopyCard';
import LetterDocument from './LetterDocument';
import { goesWithOf, letterDay, letterSubtitle } from './letterMeta';
import { DraftOutcomes, LetterNotes } from './LetterNotes';
import { useLetterSources } from './letterSources';
import RemoveLetterDialog from './RemoveLetterDialog';
import RewriteLetterPanel, { type QuickChange } from './RewriteLetterPanel';
import SentencePanel from './SentencePanel';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import SidePanel from '@/components/ui/SidePanel';
import { useMediaQuery } from '@/components/useMediaQuery';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import {
  type CoverLetter,
  coverLetterLength,
  coverLetterText,
  isLetterSaved,
} from '@/core/profile/coverLetters';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  applicationDetailsPath,
  applicationLetterPath,
} from '@/core/profile/paths';
import {
  useCoverLetters,
  useFollowLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';
import { versionDay } from '@/screens/Cv/cvMeta';
import { CvWayBack } from '@/screens/Cv/CvWayBack';
import { useCvPaths } from '@/screens/Cv/useCvPaths';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';

const FAILURES = {
  model: 'letters.failedModel',
  blocked: 'letters.failedBlocked',
  quota: 'letters.failedQuota',
  internal: 'letters.failedInternal',
} as const satisfies Record<NonNullable<CoverLetter['failure']>, string>;

/** The settings of a letter, asked for again after it could not be written. */
const requestOf = (letter: CoverLetter) => ({
  applicationId: letter.applicationId,
  ...(letter.cvVersionId ? { cvVersionId: letter.cvVersionId } : {}),
  convention: letter.convention,
  length: letter.length,
  ...(letter.addressee ? { addressee: letter.addressee } : {}),
  ...(letter.why ? { why: letter.why } : {}),
  ...(letter.asked ? { asked: letter.asked } : {}),
  ...(letter.draft ? { draft: letter.draft } : {}),
});

const ReadyLetter: React.FC<{
  letter: CoverLetter;
  onMarkSent: (sent: boolean) => Promise<void>;
}> = ({ letter, onMarkSent }) => {
  const { t } = useTranslation();
  const paths = useCvPaths(letter.applicationId);
  const { versions, details } = useCvVersions();
  const { applications } = useApplications();
  const { sourcesOf, namesOf } = useLetterSources(letter);
  const wide = useMediaQuery('(min-width: 768px)');
  const { revise } = useCoverLetters(letter.applicationId);
  const [showSources, setShowSources] = useState(true);
  const [showDraft, setShowDraft] = useState(true);
  const [selected, setSelected] = useState<string>();
  const [editingAll, setEditingAll] = useState(false);
  const [again, setAgain] = useState<{
    chosen?: QuickChange;
    draft?: boolean;
  }>();
  // After "Save my version", every sentence is the candidate's: no sources, quick changes or
  // questions (doc 22 §11.5).
  const saved = isLetterSaved(letter);
  // Dated today, as it copies and downloads.
  const [today] = useState(() => new Date());
  const application = applications.find(
    ({ id }) => id === letter.applicationId,
  );

  const paragraphs = letter.paragraphs ?? [];
  const found = paragraphs
    .map((paragraph, index) => ({
      index,
      sentence: paragraph.sentences.find(({ id }) => id === selected),
    }))
    .find(({ sentence }) => sentence);
  const panel = found?.sentence && (
    <SentencePanel
      key={found.sentence.id}
      sentence={found.sentence}
      paragraph={found.index + 1}
      sources={sourcesOf(found.sentence)}
      detailsPath={applicationDetailsPath(letter.applicationId)}
      paths={paths}
      onClose={() => setSelected(undefined)}
      bare={!wide}
      saved={saved}
      onRevise={request => revise(letter.id, found.sentence?.id ?? '', request)}
    />
  );
  const box = letter.length.kind === 'box';
  const used = box
    ? coverLetterLength(coverLetterText(letter, details))
    : undefined;

  if (editingAll) {
    return (
      <EditWholeLetter letter={letter} onDone={() => setEditingAll(false)} />
    );
  }

  return (
    <>
      {!saved && <DraftOutcomes letter={letter} />}
      {!saved && <LetterNotes letter={letter} />}
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex-[1_0_auto] text-sm leading-normal font-medium text-muted">
              {t(box ? 'letters.plainTextTitle' : 'letters.yourLetterTitle')}
            </span>
            {box && letter.length.kind === 'box' && used !== undefined && (
              <span
                className={`text-sm leading-normal font-bold ${used > letter.length.maxChars ? 'text-danger' : 'text-success'}`}>
                {t('letters.boxCounter', {
                  used: used.toLocaleString('en-GB'),
                  max: letter.length.maxChars.toLocaleString('en-GB'),
                })}
              </span>
            )}
            {saved ? (
              <Chip tone="brand" icon="edit">
                {t('letters.editedChip')}
              </Chip>
            ) : (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
                <input
                  type="checkbox"
                  role="switch"
                  checked={showSources}
                  onChange={event => setShowSources(event.target.checked)}
                  className="size-[18px] accent-primary"
                />
                {t('letters.showSources')}
              </label>
            )}
            {letter.draft && !saved && (
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] font-medium">
                <input
                  type="checkbox"
                  role="switch"
                  checked={showDraft}
                  onChange={event => setShowDraft(event.target.checked)}
                  className="size-[18px] accent-primary"
                />
                {t('letters.showDraft')}
              </label>
            )}
            <Button
              variant="quiet"
              size="small"
              onClick={() => setEditingAll(true)}
              className="gap-2 text-[15px]">
              <Icon name="edit" size={18} />
              {t('letters.editAllButton')}
            </Button>
          </div>
          <LetterDocument
            letter={letter}
            details={details}
            date={today}
            showSources={showSources && !saved}
            sourcesOf={namesOf}
            selected={selected}
            onSelect={id => setSelected(id === selected ? undefined : id)}
          />
        </div>
        <aside
          aria-label={t('letters.asideLabel')}
          className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          {wide && panel}
          {saved && <YourVersionCard letter={letter} />}
          {!saved && showDraft && (
            <DraftCard
              letter={letter}
              onChange={() => setAgain({ draft: true })}
            />
          )}
          <LetterCopyCard
            saved={saved}
            letter={letter}
            details={details}
            date={today}
            cvDay={(() => {
              const goesWith = goesWithOf(letter, versions);
              return goesWith.kind === 'cv'
                ? versionDay(goesWith.version)
                : undefined;
            })()}
            fileTitle={t('letters.fileTitle', {
              heading: [application?.title, application?.company]
                .filter(Boolean)
                .join(' · '),
              date: letterDay(letter),
            })}
            onMarkSent={onMarkSent}
          />
          {!saved && (
            <QuickChangesCard
              letter={letter}
              onChoose={chosen => setAgain({ chosen })}
            />
          )}
          {!saved && <LetterQuestionsCard letter={letter} />}
        </aside>
      </div>
      {again && (
        <RewriteLetterPanel
          letter={letter}
          chosen={again.chosen}
          draft={again.draft}
          onClose={() => setAgain(undefined)}
        />
      )}
      {!wide && panel && (
        <SidePanel
          title={t('letters.thisSentence')}
          onClose={() => setSelected(undefined)}>
          {panel}
        </SidePanel>
      )}
    </>
  );
};

export const LetterScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { applicationId = '', letterId = '' } = useParams();
  const uid = useSessionUser()?.uid;
  const paths = useCvPaths(applicationId);
  const { applications } = useApplications();
  const { versions } = useCvVersions();
  const { status, letters, reload, create, remove, markSent } =
    useCoverLetters(applicationId);
  const { left, reread } = useLettersLeft();
  useFollowLetters(applicationId, reread);
  const [removing, setRemoving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string>();

  const application = applications.find(({ id }) => id === applicationId);
  const letter = letters.find(({ id }) => id === letterId);
  const listPath = paths.list;

  const tryAgain = async (failed: CoverLetter) => {
    setRetrying(true);
    setRetryMessage(undefined);
    try {
      const next = await create(requestOf(failed));
      // The failed one keeps nothing: it goes, so the list has the new one only.
      await remove(failed.id).catch(() => null);
      navigate(applicationLetterPath(applicationId, next), { replace: true });
    } catch (error) {
      logProfileError('createCoverLetter', error, uid);
      setRetryMessage(
        getProfileErrorCode(error) === ProfileErrorCode.DailyLimit
          ? t('letters.limitMessage', {
              max: left?.max ?? 10,
              time: dailyLimitResetTime(),
            })
          : t('letters.createFailedMessage'),
      );
      reread();
    } finally {
      setRetrying(false);
    }
  };

  let body: React.ReactNode;
  if (!letter) {
    body =
      status === 'loading' ? (
        <div className="flex justify-center py-16 text-primary">
          <Spinner />
        </div>
      ) : status === 'error' ? (
        <Banner
          tone="danger"
          role="alert"
          action={
            <Button variant="quiet" size="small" onClick={reload}>
              {t('letters.retryButton')}
            </Button>
          }>
          {t('letters.loadErrorMessage')}
        </Banner>
      ) : (
        <Card
          elevation="raised"
          className="mx-auto w-full max-w-[560px] items-start gap-3 p-8">
          <h1 className="font-display text-[22px] leading-tight font-semibold">
            {t('letters.notFoundTitle')}
          </h1>
          <p className="text-[16px] leading-normal text-muted">
            {t('letters.notFoundDescription')}
          </p>
          <ButtonLink to={listPath} variant="secondary" size="small">
            {t('letters.notFoundLink')}
          </ButtonLink>
        </Card>
      );
  } else {
    const company = letter.job.company ?? application?.company;
    body = (
      <>
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[clamp(26px,4vw,32px)] leading-tight font-semibold wrap-anywhere">
            {company
              ? t('letters.pageTitleCompany', { company })
              : t('letters.pageTitle')}
          </h1>
          <p className="text-[16px] leading-normal text-muted wrap-anywhere">
            {letterSubtitle(t, letter, versions)}
          </p>
        </div>
        {letter.status === 'creating' && (
          <div role="status" className="mx-auto mt-4 w-full max-w-[620px]">
            <Card elevation="raised" className="gap-4.5 p-8">
              <div className="flex items-center gap-4">
                <span className="flex text-primary">
                  <Spinner />
                </span>
                <h2 className="font-display text-[22px] leading-tight font-semibold">
                  {t('letters.writingTitle')}
                </h2>
              </div>
              <p className="text-[16px] leading-normal text-muted">
                {t('letters.writingDescription')}
              </p>
              <div className="h-px bg-border-faint" />
              <p className="flex items-start gap-2 text-[15px] leading-normal text-muted">
                <span className="flex pt-0.5 text-primary">
                  <Icon name="check" size={18} />
                </span>
                {t('letters.writingChecks')}
              </p>
            </Card>
          </div>
        )}
        {letter.status === 'failed' && (
          <Card
            elevation="raised"
            className="mx-auto w-full max-w-[620px] items-start gap-3 p-8">
            <h2 className="font-display text-[22px] leading-tight font-semibold">
              {t('letters.failedTitle')}
            </h2>
            <p className="text-[16px] leading-normal text-muted">
              {t(FAILURES[letter.failure ?? 'internal'], {
                max: left?.max ?? 10,
                time: dailyLimitResetTime(),
              })}
            </p>
            {retryMessage && (
              <Banner tone="danger" role="alert">
                {retryMessage}
              </Banner>
            )}
            {letter.failure !== 'blocked' && (
              <Button
                size="small"
                disabled={retrying || left?.left === 0}
                aria-busy={retrying}
                onClick={() => tryAgain(letter)}
                className="gap-2">
                {retrying ? (
                  <Spinner size="small" decorative />
                ) : (
                  <Icon name="refresh" size={18} />
                )}
                {retrying
                  ? t('letters.startingButton')
                  : t('letters.tryAgainButton')}
              </Button>
            )}
          </Card>
        )}
        {letter.status === 'ready' && (
          <ReadyLetter
            letter={letter}
            onMarkSent={sent => markSent(letter.id, sent)}
          />
        )}
        <Button
          variant="quietDanger"
          size="small"
          onClick={() => setRemoving(true)}
          className="gap-2 self-start text-[15px]">
          <Icon name="trash" size={18} />
          {t('letters.removeLink')}
        </Button>
        {removing && (
          <RemoveLetterDialog
            applicationId={applicationId}
            letterId={letter.id}
            description={t('letters.removeDialogText', {
              date: letterDay(letter),
            })}
            onCancel={() => setRemoving(false)}
            onRemoved={() => navigate(listPath, { replace: true })}
          />
        )}
      </>
    );
  }

  return (
    <SignedInShell
      title={t('letters.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto flex max-w-[1120px] flex-col gap-6">
        <CvWayBack paths={paths} />
        {body}
      </div>
    </SignedInShell>
  );
};

export default LetterScreen;
