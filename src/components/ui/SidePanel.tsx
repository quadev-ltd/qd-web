import {
  type ReactNode,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
} from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';

export interface SidePanelProps {
  /** The heading of the panel, and its name for assistive technology. */
  title: string;
  /** One sentence under the heading. */
  description?: string;
  /**
   * The close button or Escape. A press on the page behind does not close it: the panel
   * holds a form, and what was typed would be lost by accident.
   */
  onClose: () => void;
  children: ReactNode;
}

/**
 * A panel that slides over the right of the page for one task (adding a resource), and
 * fills the screen on a phone. It is a modal <dialog>: the browser keeps the focus inside,
 * closes it on Escape, makes the page behind unreachable and gives the focus back to what
 * opened it. Render it while it is open; remove it to close it.
 */
export const SidePanel: React.FC<SidePanelProps> = ({
  title,
  description,
  onClose,
  children,
}) => {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownTitle = useRef(title);
  const titleId = useId();

  // When the panel moves on to another step, what had the focus is gone. The focus goes to
  // the new heading, so a screen reader says where the user is now.
  useEffect(() => {
    if (shownTitle.current !== title) {
      shownTitle.current = title;
      heading.current?.focus();
    }
  }, [title]);

  // A layout effect, so the dialog is closed (and the focus returned) while it is still
  // in the page.
  useLayoutEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
    }
    return () => {
      element?.close();
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-surface="light"
      // Escape: the parent decides, so the panel is never closed behind its back.
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[480px] max-w-full overflow-y-auto bg-surface p-0 text-text shadow-floating backdrop:bg-overlay">
      <div className="flex min-h-full flex-col gap-[18px] px-6 pt-7 pb-8">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h2
              ref={heading}
              id={titleId}
              tabIndex={-1}
              className="font-display text-[22px] leading-tight font-semibold">
              {title}
            </h2>
            {description && (
              <p className="text-[15px] leading-normal text-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sidePanel.closeAccessibilityLabel')}
            className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-control text-muted hover:bg-tint hover:text-text">
            <Icon name="x" size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
};

export default SidePanel;
