// "New application" (A1, D74, D76): the job and nothing else, as its text, a file or the address
// of its posting. The backend reads the title, the company and the role from it. A file is
// uploaded after the application is created; the application's page then follows the reading.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { applicationErrorMessage } from './errorMessages';
import SubmitFooter from './SubmitFooter';

import FormTextArea from '@/components/FormTextArea';
import FormTextInput from '@/components/FormTextInput';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import FilePicker from '@/components/ui/FilePicker';
import ProgressBar from '@/components/ui/ProgressBar';
import SegmentedControl from '@/components/ui/SegmentedControl';
import SidePanel from '@/components/ui/SidePanel';
import {
  JOB_DESCRIPTION_MAX_CHARS,
  type JobSource,
  type NewJob,
} from '@/core/profile/applications';
import { useApplicationsActions } from '@/core/profile/ApplicationsProvider';
import {
  parseProfileLink,
  PROFILE_DAILY_EXTRACTIONS,
} from '@/core/profile/contract';
import {
  getProfileErrorCode,
  logProfileError,
  ProfileErrorCode,
} from '@/core/profile/errors';
import {
  fileProblemOf,
  formatFileSize,
  PROFILE_UPLOAD_ACCEPT,
  uploadContentTypeOf,
} from '@/core/profile/files';
import { type UploadTarget } from '@/core/profile/gateway';
import { dailyLimitResetTime } from '@/core/profile/limits';
import { applicationPath } from '@/core/profile/paths';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';

const SOURCES: JobSource[] = ['text', 'file', 'link'];
const SOURCE_KEYS = {
  text: 'applications.howText',
  file: 'applications.howFile',
  link: 'applications.howLink',
} as const satisfies Record<JobSource, string>;

/** The application exists; only the upload of its file is left. */
interface Unfinished {
  applicationId: string;
  upload: UploadTarget;
}

export const NewApplicationPanel: React.FC<{ onClose: () => void }> = ({
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const gateway = useProfileGateway();
  const { refreshApplication } = useApplicationsActions();
  const uid = useSessionUser()?.uid;
  const [source, setSource] = useState<JobSource>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File>();
  const [address, setAddress] = useState('');
  const [tried, setTried] = useState(false);
  const [status, setStatus] = useState<'idle' | 'adding' | 'uploading'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [unfinished, setUnfinished] = useState<Unfinished>();
  const isBusy = status !== 'idle';

  // What is wrong with each way in; a length is said at once, the rest after "Add the job".
  const trimmed = text.trim();
  const textError =
    trimmed.length > JOB_DESCRIPTION_MAX_CHARS
      ? t('applications.jobLengthError')
      : tried && trimmed.length === 0
        ? t('applications.jobRequiredError')
        : undefined;
  const problem = file ? fileProblemOf(file) : undefined;
  const fileError = problem
    ? t(
        problem === 'type'
          ? 'addResource.fileTypeError'
          : problem === 'empty'
            ? 'addResource.fileEmptyError'
            : 'addResource.fileSizeError',
        { size: file ? formatFileSize(file.size) : '' },
      )
    : tried && !file
      ? t('addResource.fileRequiredError')
      : undefined;
  const link = parseProfileLink(address);
  const addressError = !tried
    ? undefined
    : address.trim() === ''
      ? t('addResource.addressRequiredError')
      : link
        ? undefined
        : t('addResource.addressError');

  const jobOf = (): NewJob | undefined => {
    if (source === 'text') {
      return trimmed && trimmed.length <= JOB_DESCRIPTION_MAX_CHARS
        ? { source, text: trimmed }
        : undefined;
    }
    if (source === 'link') {
      return link ? { source, url: link } : undefined;
    }
    const contentType = file && uploadContentTypeOf(file);
    return file && contentType && !problem
      ? { source, contentType, fileName: file.name }
      : undefined;
  };

  const messageFor = (error: unknown) => {
    switch (getProfileErrorCode(error)) {
      case ProfileErrorCode.DailyLimit:
        return t('applications.jobLimitMessage', {
          max: PROFILE_DAILY_EXTRACTIONS,
          time: dailyLimitResetTime(),
        });
      case ProfileErrorCode.UploadRefused:
        return t('addResource.uploadRefusedMessage');
      default:
        return applicationErrorMessage(
          t,
          error,
          t('applications.failedMessage'),
        );
    }
  };

  const open = async (applicationId: string) => {
    // Into the list before its page opens; a failed read only means the page reads it.
    await refreshApplication(applicationId).catch(() => null);
    navigate(applicationPath(applicationId));
  };

  const upload = async ({ applicationId, upload: target }: Unfinished) => {
    if (!file) {
      return;
    }
    setStatus('uploading');
    setProgress(0);
    try {
      await gateway.uploadFile(target, file, { onProgress: setProgress });
    } catch (error) {
      logProfileError('uploadApplicationJob', error, uid);
      // A refused file cannot be sent again to the same place: the application is left to
      // remove from its page. Anything else can be tried again.
      const refused =
        getProfileErrorCode(error) === ProfileErrorCode.UploadRefused;
      setUnfinished(refused ? undefined : { applicationId, upload: target });
      setErrorMessage(
        refused
          ? t('addResource.uploadRefusedMessage')
          : t('addResource.uploadFailedMessage'),
      );
      setStatus('idle');
      return;
    }
    await open(applicationId);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTried(true);
    const job = jobOf();
    if (!job) {
      return;
    }
    setStatus('adding');
    setErrorMessage(undefined);
    try {
      const created = await gateway.createApplication({ job });
      if (created.upload) {
        await upload({
          applicationId: created.applicationId,
          upload: created.upload,
        });
        return;
      }
      await open(created.applicationId);
    } catch (error) {
      logProfileError('createApplication', error, uid);
      setErrorMessage(messageFor(error));
      setStatus('idle');
    }
  };

  const locked = isBusy || unfinished !== undefined;
  return (
    <SidePanel
      title={t('applications.newTitle')}
      description={t('applications.newDescription')}
      onClose={() => {
        if (!isBusy) {
          onClose();
        }
      }}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-[18px]">
        <SegmentedControl
          label={t('applications.howLabel')}
          options={SOURCES.map(value => ({
            value,
            label: t(SOURCE_KEYS[value]),
          }))}
          value={source}
          disabled={locked}
          onChange={value => {
            setSource(value);
            setTried(false);
          }}
        />
        {source === 'text' && (
          <FormTextArea
            name="jobDescription"
            label={t('applications.jobLabel')}
            value={text}
            onChange={event => setText(event.target.value)}
            error={
              textError ? { type: 'custom', message: textError } : undefined
            }
            disabled={locked}
            counter={{ length: trimmed.length, max: JOB_DESCRIPTION_MAX_CHARS }}
          />
        )}
        {source === 'file' && (
          <div className="flex flex-col gap-2">
            <FilePicker
              label={t('addResource.fileLabel')}
              accept={PROFILE_UPLOAD_ACCEPT}
              file={
                file && { name: file.name, size: formatFileSize(file.size) }
              }
              emptyText={t('addResource.fileEmptyText')}
              chooseLabel={t('addResource.chooseFileButton')}
              changeLabel={t('addResource.changeFileButton')}
              error={fileError}
              disabled={locked}
              onChange={setFile}
            />
            <p className="text-sm leading-normal text-muted">
              {t('applications.fileHint')}
            </p>
          </div>
        )}
        {source === 'link' && (
          <FormTextInput
            name="postingUrl"
            label={t('applications.linkLabel')}
            value={address}
            onChange={event => setAddress(event.target.value)}
            hint={t('applications.linkHint')}
            error={
              addressError
                ? { type: 'custom', message: addressError }
                : undefined
            }
            disabled={locked}
            inputMode="url"
            placeholder={t('addResource.addressPlaceholder')}
          />
        )}
        <p className="text-sm leading-normal text-muted">
          {t('applications.newHint')}
        </p>
        {status === 'uploading' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-2 text-sm leading-normal text-muted">
              <span className="flex-1">{t('addResource.uploadingLabel')}</span>
              <span>
                {t('addResource.uploadPercent', {
                  percent: Math.round(progress * 100),
                })}
              </span>
            </div>
            <ProgressBar
              label={t('addResource.uploadAccessibilityLabel')}
              value={progress}
            />
          </div>
        )}
        {unfinished && !isBusy ? (
          <>
            <Banner tone="danger" role="alert">
              {errorMessage}
            </Banner>
            <Button onClick={() => upload(unfinished)} className="w-full">
              {t('addResource.retryUploadButton')}
            </Button>
          </>
        ) : (
          <SubmitFooter
            errorMessage={errorMessage}
            isBusy={isBusy}
            blocked={
              (source === 'text' &&
                trimmed.length > JOB_DESCRIPTION_MAX_CHARS) ||
              (source === 'file' && problem !== undefined)
            }
            label={t('applications.addButton')}
            busyLabel={t('applications.addingButton')}
          />
        )}
      </form>
    </SidePanel>
  );
};

export default NewApplicationPanel;
