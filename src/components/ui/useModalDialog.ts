import { type RefObject, useLayoutEffect } from 'react';

/**
 * Opens a <dialog> as a modal while its component is in the page, and closes it when the
 * component is removed. As a modal, the browser keeps the focus inside, makes the page
 * behind unreachable, and gives the focus back to what opened it when it closes.
 */
export const useModalDialog = (dialog: RefObject<HTMLDialogElement | null>) => {
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
  }, [dialog]);
};

export default useModalDialog;
