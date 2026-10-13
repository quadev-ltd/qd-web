import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { type AddResource } from './useAddResource';

import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ProgressBar from '@/components/ui/ProgressBar';

export interface AddResourceFooterProps {
  adding: AddResource;
  /** The form has something that must be corrected before it can be sent. */
  blocked: boolean;
}

/**
 * The end of each "Add a resource" form: what went wrong (with the focus on it), how far
 * the upload is, and the button that sends the form. While the request runs the fields
 * stay in place and the button shows a spinner, as on the account forms.
 */
export const AddResourceFooter: React.FC<AddResourceFooterProps> = ({
  adding,
  blocked,
}) => {
  const { t } = useTranslation();
  const { errorMessage, status, progress, isBusy, hasUnfinishedUpload } =
    adding;
  const error = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMessage) {
      error.current?.focus();
    }
  }, [errorMessage]);

  const percent = Math.round(progress * 100);
  return (
    <>
      {errorMessage && (
        <Banner ref={error} tone="danger" role="alert">
          {errorMessage}
        </Banner>
      )}
      {status === 'uploading' && (
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2 text-sm leading-normal text-muted">
            <span className="flex-1">{t('addResource.uploadingLabel')}</span>
            <span>{t('addResource.uploadPercent', { percent })}</span>
          </div>
          <ProgressBar
            label={t('addResource.uploadAccessibilityLabel')}
            value={progress}
          />
        </div>
      )}
      {hasUnfinishedUpload && !isBusy ? (
        // The resource exists: only its file is missing. Sending the form again would
        // create a second one.
        <Button onClick={adding.retryUpload} className="w-full">
          {t('addResource.retryUploadButton')}
        </Button>
      ) : (
        <Button
          type="submit"
          disabled={isBusy || blocked}
          aria-busy={isBusy}
          className="w-full gap-2.5">
          {isBusy && <Spinner size="small" decorative />}
          {isBusy
            ? t('addResource.submittingButton')
            : t('addResource.submitButton')}
        </Button>
      )}
    </>
  );
};

export default AddResourceFooter;
