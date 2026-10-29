// "New cover letter" (Web-L1-New, -New-Draft, -New-Box, D98, doc 22 §10): Start from ("Write it for
// me" or "Improve my draft"); "Why this job?" in the candidate's words, or their draft with how much
// to change it; To (the posting's contact, or "Hiring Manager"); the CV it goes with (the one sent
// for this job, the latest written for it, or none); its length (short, one page, or a form's box of
// so many characters); "Written as", suggested from the job's country; and, written for them,
// "Anything to mention, stress or leave out?" with its starters (D97). It sends what it shows.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import FormTextArea from '@/components/FormTextArea';
import FormTextInput from '@/components/FormTextInput';
import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import SegmentedControl from '@/components/ui/SegmentedControl';
import SidePanel from '@/components/ui/SidePanel';
import { type JobApplication } from '@/core/profile/applications';
import {
  COVER_LETTER_ADDRESSEE_MAX_CHARS,
  COVER_LETTER_ASKED_MAX_CHARS,
  COVER_LETTER_BOX_DEFAULT_CHARS,
  COVER_LETTER_BOX_MAX_CHARS,
  COVER_LETTER_BOX_MIN_CHARS,
  COVER_LETTER_DRAFT_MAX_CHARS,
  COVER_LETTER_WHY_MAX_CHARS,
  COVER_LETTERS_MAX,
  type CoverLetterDraftMode,
  type CoverLetterLength,
  type CreateCoverLetterRequest,
} from '@/core/profile/coverLetters';
import {
  CV_VERSION_CONVENTIONS,
  cvConventionFor,
  type CvVersionConvention,
} from '@/core/profile/cvVersions';
import { useCvVersions } from '@/core/profile/CvVersionsProvider';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { applicationLetterPath } from '@/core/profile/paths';
import {
  useCoverLetters,
  useLettersLeft,
} from '@/core/profile/useCoverLetters';
import { useSessionUser } from '@/core/session/hooks';
import SubmitFooter from '@/screens/Applications/SubmitFooter';
import AskedField from '@/screens/Cv/AskedField';
import ChoiceGroup from '@/screens/Cv/ChoiceGroup';
import { countryName } from '@/screens/Cv/conventions';
import { versionDay } from '@/screens/Cv/cvMeta';

export type LetterStart = 'write' | 'draft';

type LengthKind = CoverLetterLength['kind'];
const LENGTHS: LengthKind[] = ['short', 'page', 'box'];

/** "No CV" in "Goes with". */
const NO_CV = 'none';

export interface NewLetterPanelProps {
  application: JobApplication;
  start: LetterStart;
  onClose: () => void;
}

export const NewLetterPanel: React.FC<NewLetterPanelProps> = ({
  application,
  start: initialStart,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const uid = useSessionUser()?.uid;
  const { versions } = useCvVersions();
  const { status: profileStatus, resources } = useInterviewProfile();
  const { create } = useCoverLetters(application.id);
  const { left, reread } = useLettersLeft();

  // The ready CVs written for this job: the one sent with it, and the latest when it isn't that one.
  const forJob = versions
    .filter(
      ({ target, status }) =>
        target.kind === 'job' &&
        target.applicationId === application.id &&
        status === 'ready',
    )
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  const sentCv = forJob.find(
    ({ sentAt }) => sentAt !== undefined && sentAt !== null,
  );
  const latestCv = forJob.find(version => version !== sentCv);
  const cvChoices = [
    ...(sentCv
      ? [
          {
            value: sentCv.id,
            title: t('letters.cvOf', { date: versionDay(sentCv) }),
            meta: t('letters.cvSentMeta'),
          },
        ]
      : []),
    ...(latestCv
      ? [
          {
            value: latestCv.id,
            title: t('letters.cvOf', { date: versionDay(latestCv) }),
            meta: t('letters.cvForJobMeta'),
          },
        ]
      : []),
  ];

  const [start, setStart] = useState<LetterStart>(initialStart);
  const [why, setWhy] = useState('');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<CoverLetterDraftMode>('polish');
  const [to, setTo] = useState(application.contact ?? '');
  const [cv, setCv] = useState<string>(sentCv?.id ?? latestCv?.id ?? NO_CV);
  const [length, setLength] = useState<LengthKind>('page');
  const [boxChars, setBoxChars] = useState(
    String(COVER_LETTER_BOX_DEFAULT_CHARS),
  );
  const [chosen, setChosen] = useState<CvVersionConvention>();
  const [asked, setAsked] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [limitRefused, setLimitRefused] = useState(false);
  const [checked, setChecked] = useState(false);

  const suggested = cvConventionFor(application.country);
  const convention = chosen ?? suggested;
  const limitReached = left?.left === 0 || limitRefused;
  // D98: with nothing visible in the profile, a letter can only start from a draft.
  const noItems =
    profileStatus === 'loaded' &&
    !resources.some(
      ({ status, itemCount }) => status === 'ready' && (itemCount ?? 0) > 0,
    );
  const writeBlocked = start === 'write' && noItems;
  const boxValue = Number(boxChars);
  const boxError =
    length === 'box' &&
    (!Number.isInteger(boxValue) ||
      boxValue < COVER_LETTER_BOX_MIN_CHARS ||
      boxValue > COVER_LETTER_BOX_MAX_CHARS);
  const draftMissing = start === 'draft' && draft.trim().length === 0;
  const tooLong =
    why.trim().length > COVER_LETTER_WHY_MAX_CHARS ||
    draft.trim().length > COVER_LETTER_DRAFT_MAX_CHARS ||
    to.trim().length > COVER_LETTER_ADDRESSEE_MAX_CHARS ||
    asked.trim().length > COVER_LETTER_ASKED_MAX_CHARS;
  const cvVersionId = cv === NO_CV ? undefined : cv;
  const goesWithCv = forJob.find(({ id }) => id === cvVersionId);

  const messageFor = (error: unknown) => {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.DailyLimit:
        setLimitRefused(true);
        return undefined;
      case ProfileErrorCode.MaxLetters:
        return t('letters.maxMessage', { max: COVER_LETTERS_MAX });
      case ProfileErrorCode.NoItems:
        return t('letters.noItemsMessage');
      case ProfileErrorCode.CvNotReady:
        return t('letters.cvNotReadyMessage');
      case ProfileErrorCode.NoJobDescription:
        return t('letters.noJobMessage');
      case ProfileErrorCode.Reading:
        return t('letters.jobReadingMessage');
      case ProfileErrorCode.NotFound:
        return t('letters.goneMessage');
      case ProfileErrorCode.FlagOff:
        return t('cv.notAvailableMessage');
      default:
        return t('letters.createFailedMessage');
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecked(true);
    if (limitReached || writeBlocked || boxError || draftMissing || tooLong) {
      return;
    }
    setIsBusy(true);
    setErrorMessage(undefined);
    const request: CreateCoverLetterRequest = {
      applicationId: application.id,
      ...(cvVersionId ? { cvVersionId } : {}),
      // Always what the panel shows, so the letter is what it said.
      convention,
      length:
        length === 'box'
          ? { kind: 'box', maxChars: boxValue }
          : { kind: length },
      ...(to.trim() ? { addressee: to.trim() } : {}),
      ...(start === 'write'
        ? {
            ...(why.trim() ? { why: why.trim() } : {}),
            ...(asked.trim() ? { asked: asked.trim() } : {}),
          }
        : { draft: { text: draft.trim(), mode } }),
    };
    try {
      const letterId = await create(request);
      navigate(applicationLetterPath(application.id, letterId));
    } catch (error) {
      logProfileError('createCoverLetter', error, uid);
      setErrorMessage(messageFor(error));
      reread();
      setIsBusy(false);
    }
  };

  const countryLine = application.country
    ? t('letters.conventionSuggested', {
        country: countryName(application.country),
      })
    : t('letters.conventionNoCountry');

  return (
    <SidePanel
      title={t('letters.newTitle')}
      description={[application.title, application.company]
        .filter(Boolean)
        .join(' · ')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        {limitReached && (
          <Banner>
            {t('letters.limitMessage', {
              max: left?.max ?? 10,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        )}
        <SegmentedControl
          label={t('letters.startLabel')}
          options={[
            { value: 'write', label: t('letters.startWrite') },
            { value: 'draft', label: t('letters.startDraft') },
          ]}
          value={start}
          onChange={value => setStart(value as LetterStart)}
          disabled={isBusy}
        />
        {start === 'write' ? (
          <>
            {writeBlocked && (
              <Banner tone="info">{t('letters.noItemsMessage')}</Banner>
            )}
            <FormTextArea
              name="why"
              rows={6}
              label={t('letters.whyField')}
              placeholder={t('letters.whyPlaceholder', {
                company: application.company || t('cv.theEmployer'),
              })}
              hint={t('letters.whyHint')}
              value={why}
              onChange={event => setWhy(event.target.value)}
              disabled={isBusy}
              counter={{
                length: why.trim().length,
                max: COVER_LETTER_WHY_MAX_CHARS,
              }}
            />
          </>
        ) : (
          <>
            <FormTextArea
              name="draft"
              rows={10}
              label={t('letters.draftField')}
              hint={t('letters.draftHint')}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              disabled={isBusy}
              error={
                checked && draftMissing
                  ? { type: 'required', message: t('letters.draftRequired') }
                  : undefined
              }
              counter={{
                length: draft.trim().length,
                max: COVER_LETTER_DRAFT_MAX_CHARS,
              }}
            />
            <ChoiceGroup
              label={t('letters.modeLabel')}
              value={mode}
              onChange={setMode}
              disabled={isBusy}
              choices={[
                {
                  value: 'polish',
                  title: t('letters.modePolish'),
                  meta: t('letters.modePolishMeta'),
                },
                {
                  value: 'rewrite',
                  title: t('letters.modeRewrite'),
                  meta: t('letters.modeRewriteMeta'),
                },
              ]}
            />
          </>
        )}
        <FormTextInput
          name="to"
          label={t('letters.toField')}
          placeholder={t('letters.toPlaceholder')}
          hint={
            application.contact
              ? t('letters.toHintContact')
              : t('letters.toHintNobody')
          }
          value={to}
          onChange={event => setTo(event.target.value)}
          disabled={isBusy}
          counter={{
            length: to.trim().length,
            max: COVER_LETTER_ADDRESSEE_MAX_CHARS,
          }}
        />
        {cvChoices.length > 0 ? (
          <ChoiceGroup
            label={t('letters.goesWithLabel')}
            value={cv}
            onChange={setCv}
            disabled={isBusy}
            choices={[
              ...cvChoices,
              {
                value: NO_CV,
                title: t('letters.noCvChoice'),
                meta: t('letters.noCvChoiceMeta'),
              },
            ]}
          />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm leading-normal font-medium">
              {t('letters.goesWithLabel')}
            </p>
            <p className="text-sm leading-normal text-muted">
              {t('letters.noCvForJob')}
            </p>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('letters.lengthLabel')}
            options={LENGTHS.map(value => ({
              value,
              label: t(`letters.lengthOption_${value}`),
            }))}
            value={length}
            onChange={value => setLength(value as LengthKind)}
            disabled={isBusy}
          />
          <p className="text-sm leading-normal text-muted">
            {t(`letters.lengthHint_${length}`)}
          </p>
        </div>
        {length === 'box' && (
          <FormTextInput
            name="boxChars"
            inputMode="numeric"
            label={t('letters.boxField')}
            hint={t('letters.boxHint')}
            value={boxChars}
            onChange={event => setBoxChars(event.target.value.trim())}
            disabled={isBusy}
            error={
              boxError
                ? {
                    type: 'range',
                    message: t('letters.boxRangeError', {
                      min: COVER_LETTER_BOX_MIN_CHARS.toLocaleString('en-GB'),
                      max: COVER_LETTER_BOX_MAX_CHARS.toLocaleString('en-GB'),
                    }),
                  }
                : undefined
            }
          />
        )}
        <div className="flex flex-col gap-1.5">
          <SegmentedControl
            label={t('letters.conventionLabel')}
            options={CV_VERSION_CONVENTIONS.map(value => ({
              value,
              label: t(`letters.conventionOption_${value}`),
            }))}
            value={convention}
            onChange={setChosen}
            disabled={isBusy}
          />
          <p className="text-sm leading-normal text-muted">
            {t(`letters.conventionMeaning_${convention}`)}
            {convention === suggested && ` ${countryLine}`}
          </p>
        </div>
        {start === 'write' && (
          <AskedField
            value={asked}
            onChange={setAsked}
            onClear={() => setAsked('')}
            disabled={isBusy}
            words={{
              label: t('letters.askedField'),
              placeholder: t('letters.askedPlaceholder'),
              hint: t('letters.askedHint'),
            }}
            starters={[
              {
                label: t('letters.starterNotice'),
                prefix: t('letters.starterNoticePrefix'),
              },
              {
                label: t('letters.starterReferred'),
                prefix: t('letters.starterReferredPrefix'),
              },
              {
                label: t('letters.starterChange'),
                prefix: t('letters.starterChangePrefix'),
              },
            ]}
          />
        )}
        <p className="flex items-start gap-2 text-sm leading-normal text-muted">
          <span className="flex pt-0.5 text-primary">
            <Icon name="check" size={18} />
          </span>
          {start === 'draft'
            ? t('letters.improvedFromDraft')
            : goesWithCv
              ? t('letters.writtenFromWithCv', { date: versionDay(goesWithCv) })
              : t('letters.writtenFromNoCv')}
        </p>
        <SubmitFooter
          errorMessage={errorMessage}
          isBusy={isBusy}
          blocked={limitReached || writeBlocked || boxError || tooLong}
          label={
            start === 'draft'
              ? t('letters.improveDraftButton')
              : t('letters.writeMyLetterButton')
          }
          busyLabel={t('letters.startingButton')}
        />
        <p className="-mt-2 text-center text-sm leading-normal text-muted">
          {left === null
            ? t('letters.takesMinuteOnly')
            : left.left === 0
              ? t('letters.takesMinuteNone')
              : t('letters.takesMinute', left)}
        </p>
      </form>
    </SidePanel>
  );
};

export default NewLetterPanel;
