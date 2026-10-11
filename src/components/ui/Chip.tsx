import { type ReactNode } from 'react';

export interface ChipProps {
  children: ReactNode;
}

/** A short status label, for example "Coming soon". */
export const Chip: React.FC<ChipProps> = ({ children }) => (
  <span className="inline-flex items-center rounded-full bg-chip px-2.5 py-1 text-[13px] font-medium text-chip-text">
    {children}
  </span>
);

export default Chip;
