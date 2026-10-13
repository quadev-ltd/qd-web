// The line icons of the interview tools, from the design artboards: one 24 by 24 drawing
// each, in the current text colour. Icons that only one screen uses stay with that screen
// (src/screens/Home/icons.tsx).
import { type ReactNode } from 'react';

const PATHS = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
} as const satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export interface IconProps {
  name: IconName;
  /** Width and height in pixels. */
  size?: number;
  /** What the icon says, when no text next to it does. Without it the icon is decorative. */
  label?: string;
}

export const Icon: React.FC<IconProps> = ({ name, size = 20, label }) => (
  <svg
    {...(label
      ? { role: 'img', 'aria-label': label }
      : { 'aria-hidden': true })}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="flex-none">
    {PATHS[name]}
  </svg>
);

export default Icon;
