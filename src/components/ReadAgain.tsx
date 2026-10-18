// The end of the card that shows a page's copy (D78, research doc 17): "Read the page again",
// or "Read the posting again", with what it does; while the backend reads it, "Reading the
// page again…" and that the old copy stays. Used by a link resource and by a job's posting.
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';

export interface ReadAgainProps {
  /** The backend is reading the page again. */
  reading: boolean;
  /** The request is on its way. */
  busy: boolean;
  buttonLabel: string;
  /** What reading again does, under the button. */
  hint: string;
  readingTitle: string;
  /** That the old copy stays until the new one is in. */
  readingHint: string;
  /** Why the reading could not start. */
  errorMessage?: string;
  onRead: () => void;
}

export const ReadAgain: React.FC<ReadAgainProps> = ({
  reading,
  busy,
  buttonLabel,
  hint,
  readingTitle,
  readingHint,
  errorMessage,
  onRead,
}) => (
  <div className="flex flex-col gap-2 border-t border-border-faint pt-3">
    {reading ? (
      <div role="status" className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5 text-[15px] leading-normal font-medium">
          <span className="flex text-primary">
            <Spinner size="small" decorative />
          </span>
          {readingTitle}
        </div>
        <p className="text-sm leading-normal text-muted">{readingHint}</p>
      </div>
    ) : (
      <>
        <Button
          variant="secondary"
          size="small"
          disabled={busy}
          aria-busy={busy}
          onClick={onRead}
          className="gap-2 self-start">
          {busy ? (
            <Spinner size="small" decorative />
          ) : (
            <Icon name="refresh" size={18} />
          )}
          {buttonLabel}
        </Button>
        <p className="text-sm leading-normal text-muted">{hint}</p>
      </>
    )}
    {errorMessage && (
      <Banner tone="danger" role="alert">
        {errorMessage}
      </Banner>
    )}
  </div>
);

export default ReadAgain;
