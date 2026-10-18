import { useTranslation } from 'react-i18next';

import { type ReadPostingAgain } from './useReadPostingAgain';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';

/**
 * "Replace your edited text?" (research doc 17): reading the posting again replaces the job's
 * text, and the candidate changed it, so the page asks first. Not drawn on the canvas; worded
 * as the remove dialogs are.
 */
export const ReplaceEditedTextDialog: React.FC<{
  reread: ReadPostingAgain;
}> = ({ reread }) => {
  const { t } = useTranslation();
  return (
    <Dialog
      title={t('applications.replaceDialogTitle')}
      icon="refresh"
      onClose={() => {
        if (!reread.busy) {
          reread.cancel();
        }
      }}>
      <p className="text-[16px] leading-normal text-muted">
        {t('applications.replaceDialogText')}
      </p>
      {reread.errorMessage && (
        <Banner tone="danger" role="alert">
          {reread.errorMessage}
        </Banner>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={reread.busy}
          aria-busy={reread.busy}
          onClick={() => {
            reread.confirm();
          }}
          className="flex-[1_1_240px] gap-2">
          {reread.busy ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="refresh" size={18} />
          )}
          {t('applications.replaceConfirmButton')}
        </Button>
        <Button
          variant="secondary"
          disabled={reread.busy}
          onClick={reread.cancel}
          className="flex-[1_1_120px]">
          {t('applications.cancelButton')}
        </Button>
      </div>
    </Dialog>
  );
};

export default ReplaceEditedTextDialog;
