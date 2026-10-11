// The web version of qd-mobile src/components/Spinner.tsx.
import { useTranslation } from 'react-i18next';

interface SpinnerProps {
  /** small: inside a button. large: a page or a card that is loading. */
  size?: 'small' | 'large';
  /**
   * Inside a control that already says it is busy (a button with aria-busy): the ring is
   * hidden from assistive technology, so it does not change the control's name.
   */
  decorative?: boolean;
  className?: string;
}

const SIZES = {
  small: 'size-5 border-2',
  large: 'size-10 border-4',
};

/** A turning ring, in the current text colour, announced as "Loading". */
const Spinner: React.FC<SpinnerProps> = ({
  size = 'large',
  decorative = false,
  className,
}) => {
  const { t } = useTranslation();
  const accessibility = decorative
    ? { 'aria-hidden': true, 'data-testid': 'spinner' }
    : { role: 'status', 'aria-label': t('spinner.accessibilityLabel') };
  return (
    <span
      {...accessibility}
      className={[
        'inline-block flex-none rounded-full border-current border-r-transparent motion-safe:animate-spin',
        SIZES[size],
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
};

export default Spinner;
