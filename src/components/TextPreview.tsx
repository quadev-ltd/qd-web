import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Button from '@/components/ui/Button';

/** A text longer than this opens with its start only, and "Show all". */
export const SHORT_TEXT_CHARS = 700;

/**
 * A kept text as it is read on a page (D78): its start, fading out, and "Show all", which opens
 * it in place with "Show less". A short text is shown whole.
 */
export const TextPreview: React.FC<{ text: string }> = ({ text }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const textId = useId();
  const long = text.length > SHORT_TEXT_CHARS;
  return (
    <>
      <div
        id={textId}
        className={`relative overflow-hidden rounded-control bg-background px-4 py-3 ${
          long && !open ? 'max-h-[240px]' : ''
        }`}>
        <p className="text-[15px] leading-normal whitespace-pre-wrap wrap-anywhere">
          {text}
        </p>
        {long && !open && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-b from-transparent to-background"
          />
        )}
      </div>
      {long && (
        <Button
          variant="quiet"
          size="small"
          aria-expanded={open}
          aria-controls={textId}
          onClick={() => setOpen(!open)}
          className="gap-1.5 self-start text-[15px]">
          <Icon name={open ? 'up' : 'down'} size={18} />
          {t(open ? 'textPreview.showLess' : 'textPreview.showAll')}
        </Button>
      )}
    </>
  );
};

export default TextPreview;
