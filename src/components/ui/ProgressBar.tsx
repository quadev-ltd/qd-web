export interface ProgressBarProps {
  /** What is in progress, for assistive technology ("Upload"). */
  label: string;
  /** The part done, from 0 to 1. */
  value: number;
}

// The native element, drawn with its pseudo-elements: the Content-Security-Policy forbids
// the `style` attribute a bar made of two boxes would need for its width.
const BAR =
  'h-2 w-full appearance-none overflow-hidden rounded-full bg-border-faint [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-border-faint [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-primary';

/** How far something has got. */
export const ProgressBar: React.FC<ProgressBarProps> = ({ label, value }) => (
  <progress
    aria-label={label}
    max={100}
    value={Math.round(Math.min(1, Math.max(0, value)) * 100)}
    className={BAR}
  />
);

export default ProgressBar;
