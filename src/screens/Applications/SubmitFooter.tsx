import { useEffect, useRef } from 'react';

import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';

export interface SubmitFooterProps {
  /** What went wrong with the last attempt; the focus moves to it. */
  errorMessage?: string;
  isBusy: boolean;
  /** The form has something to correct first. */
  blocked?: boolean;
  label: string;
  busyLabel: string;
}

/** The end of an application form: what went wrong, and the button that sends it. */
export const SubmitFooter: React.FC<SubmitFooterProps> = ({
  errorMessage,
  isBusy,
  blocked = false,
  label,
  busyLabel,
}) => {
  const error = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errorMessage) {
      error.current?.focus();
    }
  }, [errorMessage]);

  return (
    <>
      {errorMessage && (
        <Banner ref={error} tone="danger" role="alert">
          {errorMessage}
        </Banner>
      )}
      <Button
        type="submit"
        disabled={isBusy || blocked}
        aria-busy={isBusy}
        className="w-full gap-2.5">
        {isBusy && <Spinner size="small" decorative />}
        {isBusy ? busyLabel : label}
      </Button>
    </>
  );
};

export default SubmitFooter;
