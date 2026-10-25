// "More" (⋯) beside an application's title, on every tab (D95): "Edit the application" and
// "Remove this application", which open the panel and the dialog Details has. Removing is rare
// and can't be undone, so it is one step away rather than a button of its own.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import EditApplicationPanel from './EditApplicationPanel';
import RemoveApplicationDialog from './RemoveApplicationDialog';

import Icon from '@/components/Icon';
import useMenuButton from '@/components/ui/useMenuButton';
import { type JobApplication } from '@/core/profile/applications';
import { APPLICATIONS_PATH } from '@/core/profile/paths';

/** The menu's width (w-[260px]) plus a margin to the edge of the screen. */
const SPACE_NEEDED = 276;

const ITEM =
  'flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-[10px] px-3.5 text-left text-[15px] leading-natural font-medium hover:bg-tint';

export const ApplicationMenu: React.FC<{ application: JobApplication }> = ({
  application,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [action, setAction] = useState<'edit' | 'remove'>();
  const [alignment, setAlignment] = useState<'left' | 'right'>('right');
  const { isOpen, close, containerRef, buttonProps, menuProps } = useMenuButton(
    {
      // It hangs from the button's right edge, or its left one when the button has wrapped
      // to the left of a narrow screen.
      onOpen: button => {
        const right = button?.getBoundingClientRect().right;
        setAlignment(
          right !== undefined && right < SPACE_NEEDED ? 'left' : 'right',
        );
      },
    },
  );

  const choose = (chosen: 'edit' | 'remove') => {
    close();
    setAction(chosen);
  };

  return (
    <div ref={containerRef} className="relative flex">
      <button
        {...buttonProps}
        aria-label={t('applications.moreButton')}
        className={`flex size-12 cursor-pointer items-center justify-center rounded-xl border border-border-strong text-text ${
          isOpen ? 'bg-tint' : 'bg-surface hover:bg-tint'
        }`}>
        <Icon name="more" size={22} />
      </button>
      {isOpen && (
        <div
          {...menuProps}
          aria-label={t('applications.menuLabel')}
          className={`absolute top-[calc(100%+6px)] z-20 flex w-[260px] max-w-[calc(100vw-32px)] flex-col rounded-[14px] bg-surface p-1.5 shadow-floating ${
            alignment === 'left' ? 'left-0' : 'right-0'
          }`}>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => choose('edit')}
            className={`${ITEM} text-text`}>
            <Icon name="edit" size={18} />
            {t('applications.editTitle')}
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => choose('remove')}
            className={`${ITEM} text-danger`}>
            <Icon name="trash" size={18} />
            {t('applications.removeLink')}
          </button>
        </div>
      )}
      {action === 'edit' && (
        <EditApplicationPanel
          application={application}
          onClose={() => setAction(undefined)}
        />
      )}
      {action === 'remove' && (
        <RemoveApplicationDialog
          applicationId={application.id}
          onCancel={() => setAction(undefined)}
          onRemoved={() => navigate(APPLICATIONS_PATH, { replace: true })}
        />
      )}
    </div>
  );
};

export default ApplicationMenu;
