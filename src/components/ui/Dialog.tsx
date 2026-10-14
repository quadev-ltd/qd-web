import { type ReactNode, useId, useRef } from 'react';

import { useModalDialog } from './useModalDialog';

import Icon, { type IconName } from '@/components/Icon';

export interface DialogProps {
  /** The question the dialog asks: its heading, and its name for assistive technology. */
  title: string;
  /** The icon above the heading. */
  icon: IconName;
  /** danger: the dialog confirms something that cannot be undone. */
  tone?: 'brand' | 'danger';
  /** Escape. The buttons of the dialog are its children and close it themselves. */
  onClose: () => void;
  children: ReactNode;
}

const TONES = {
  brand: 'bg-tint text-primary',
  danger: 'bg-danger-tint text-danger',
};

/**
 * A question in the middle of the page that must be answered before going on (a
 * confirmation). It is a modal <dialog>, like SidePanel. Render it while it is open; remove
 * it to close it.
 */
export const Dialog: React.FC<DialogProps> = ({
  title,
  icon,
  tone = 'brand',
  onClose,
  children,
}) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useModalDialog(dialog);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-surface="light"
      // Escape: the parent decides, so the dialog is never closed while it is working.
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[520px] rounded-card bg-surface p-[clamp(22px,6vw,36px)] text-text shadow-floating backdrop:bg-overlay">
      <div className="flex flex-col gap-4">
        <span
          aria-hidden="true"
          className={`flex size-16 flex-none items-center justify-center rounded-full ${TONES[tone]}`}>
          <Icon name={icon} size={28} />
        </span>
        <h2
          id={titleId}
          className="font-display text-[24px] leading-tight font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
};

export default Dialog;
