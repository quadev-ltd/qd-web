// "Anything to put first, leave out or add?" (D97, doc 13 §27): what the candidate asks of one CV,
// in their own words, up to 1,000 characters. Read as their wishes and statements, never as
// instructions that change how the CV is written. With nothing carried over, three ways to start;
// carried over from another CV, or this one written again, a line says where it comes from, with
// "Clear".
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import FormTextArea from '@/components/FormTextArea';
import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';
import { CV_ASKED_MAX_CHARS } from '@/core/profile/cvVersions';

const STARTERS = [
  { label: 'cv.askedStarterFirst', prefix: 'cv.askedPrefixFirst' },
  { label: 'cv.askedStarterLeaveOut', prefix: 'cv.askedPrefixLeaveOut' },
  { label: 'cv.askedStarterAdd', prefix: 'cv.askedPrefixAdd' },
] as const;

/** The box with a starter added: on a line of its own when the box has text. */
export const withStarter = (value: string, prefix: string) => {
  const kept = value.replace(/\s+$/, '');
  return kept ? `${kept}\n${prefix}` : prefix;
};

export interface AskedFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Where the text comes from, when it was carried over: the line above the box. */
  carried?: string;
  onClear: () => void;
  disabled?: boolean;
}

export const AskedField: React.FC<AskedFieldProps> = ({
  value,
  onChange,
  carried,
  onClear,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const box = useRef<HTMLTextAreaElement>(null);
  const length = value.trim().length;

  const start = (prefix: string) => {
    const next = withStarter(value, prefix);
    onChange(next);
    // The cursor after what was added, to type the rest: a focused box given new text puts the
    // caret at its end. Moving it later would move it back over what was typed meanwhile.
    box.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {carried && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-chip py-1 pr-1.5 pl-3">
          <span aria-hidden="true" className="flex text-chip-text">
            <Icon name="refresh" size={16} />
          </span>
          <p className="min-w-0 flex-1 text-sm leading-normal">{carried}</p>
          <Button
            variant="quiet"
            size="small"
            disabled={disabled}
            onClick={() => {
              onClear();
              box.current?.focus();
            }}>
            {t('cv.askedClearButton')}
          </Button>
        </div>
      )}
      <FormTextArea
        ref={box}
        rows={value ? 6 : 3}
        label={t('cv.askedField')}
        placeholder={t('cv.askedPlaceholder')}
        hint={t('cv.askedHint')}
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        counter={{ length, max: CV_ASKED_MAX_CHARS }}
      />
      {!carried && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] leading-normal text-muted">
            {t('cv.askedStartWith')}
          </p>
          <div className="flex flex-wrap gap-2">
            {STARTERS.map(({ label, prefix }) => (
              <button
                key={label}
                type="button"
                disabled={disabled}
                onClick={() => start(t(prefix))}
                className="flex h-11 cursor-pointer items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3.5 text-[15px] leading-natural font-medium text-text hover:bg-tint disabled:cursor-not-allowed disabled:opacity-60">
                <Icon name="plus" size={16} />
                {t(label)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AskedField;
