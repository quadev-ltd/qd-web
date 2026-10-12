// The web version of qd-mobile src/components/StatusDisplay.tsx: the picture above the text
// of a status. The app plays animated GIFs (mail, sending, check, error); the website shows
// a static icon in a round tile, and a turning ring while something is in progress.
import { type ReactNode } from 'react';

import Spinner from './Spinner';

export type StatusIconName = 'mail' | 'check' | 'error' | 'trash' | 'busy';

interface StatusIconProps {
  icon: StatusIconName;
  /** brand: the usual tile. danger: a failure, or an action that cannot be undone. */
  tone?: 'brand' | 'danger';
}

const PATHS: Record<Exclude<StatusIconName, 'busy'>, ReactNode> = {
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M4 8l8 6 8-6" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  error: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <path d="M12 16.5v.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </>
  ),
};

const TONES = {
  brand: 'bg-tint text-primary',
  danger: 'bg-danger-tint text-danger',
};

/**
 * Decorative: the text next to it says what is happening, so it is hidden from assistive
 * technology.
 */
export const StatusIcon: React.FC<StatusIconProps> = ({
  icon,
  tone = 'brand',
}) => (
  <span
    aria-hidden="true"
    data-testid={`status-icon-${icon}`}
    className={`flex size-16 flex-none items-center justify-center rounded-full ${TONES[tone]}`}>
    {icon === 'busy' ? (
      <Spinner size="medium" decorative />
    ) : (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round">
        {PATHS[icon]}
      </svg>
    )}
  </span>
);

export default StatusIcon;
