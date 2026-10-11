import { type ReactNode } from 'react';

import BrandLink from './BrandLink';

export interface SiteHeaderProps {
  /** brand: transparent, over the brand background. solid: dark bar, on light pages. */
  tone?: 'brand' | 'solid';
  /** Shown next to the brand: the main navigation of the signed-in pages. */
  nav?: ReactNode;
  /** Shown on the right: navigation or account actions. */
  children?: ReactNode;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  tone = 'brand',
  nav,
  children,
}) => (
  <header
    data-surface="dark"
    className={`relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-gutter text-white ${
      tone === 'solid' ? 'bg-primary-dark py-3.5' : 'py-[18px]'
    }`}>
    {nav ? (
      <div className="flex flex-wrap items-center gap-x-9 gap-y-3">
        <BrandLink />
        {nav}
      </div>
    ) : (
      <BrandLink />
    )}
    {children}
  </header>
);

export default SiteHeader;
