import { type ChangeEvent, useId, useRef } from 'react';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';

export interface FilePickerProps {
  /** What the file is for: the name of the control for assistive technology. */
  label: string;
  /** The file types the browser offers (`accept` of the file input). */
  accept: string;
  /** The chosen file, as it is shown: its name and its size. */
  file?: { name: string; size: string };
  /** Shown in place of the name while nothing is chosen: what can be chosen. */
  emptyText: string;
  /** The button while nothing is chosen ("Choose a file"), and after ("Change"). */
  chooseLabel: string;
  changeLabel: string;
  error?: string;
  disabled?: boolean;
  onChange: (file: File) => void;
}

/**
 * Choosing one file from the device: a box that shows what was chosen, with a button that
 * opens the browser's own file window. The file input itself is not shown.
 */
export const FilePicker: React.FC<FilePickerProps> = ({
  label,
  accept,
  file,
  emptyText,
  chooseLabel,
  changeLabel,
  error,
  disabled = false,
  onChange,
}) => {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const errorId = `${id}-error`;

  const onChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    // The same file can be chosen again after a change of mind.
    event.target.value = '';
    if (chosen) {
      onChange(chosen);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="group"
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        className={`flex items-center gap-3 rounded-control border py-2.5 pr-2 pl-3 ${
          error ? 'border-2 border-danger' : 'border-border-strong'
        }`}>
        <span
          aria-hidden="true"
          className={`flex size-10 flex-none items-center justify-center rounded-full ${
            error ? 'bg-danger-tint text-danger' : 'bg-tint text-primary'
          }`}>
          <Icon name="file" size={18} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          {file ? (
            <>
              <p className="text-base leading-normal font-medium wrap-anywhere">
                {file.name}
              </p>
              <p className="text-sm leading-normal text-muted">{file.size}</p>
            </>
          ) : (
            <p className="text-sm leading-normal text-muted">{emptyText}</p>
          )}
        </div>
        <Button
          variant="quiet"
          size="small"
          disabled={disabled}
          onClick={() => input.current?.click()}
          className="flex-none text-[15px]">
          {file ? changeLabel : chooseLabel}
        </Button>
        <input
          ref={input}
          type="file"
          accept={accept}
          hidden
          disabled={disabled}
          onChange={onChosen}
          data-testid="file-input"
        />
      </div>
      {error && (
        <p
          id={errorId}
          className="text-[13px] leading-[1.45] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default FilePicker;
