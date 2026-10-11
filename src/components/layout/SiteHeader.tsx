import { type ReactNode } from 'react';

import BrandLink from './BrandLink';

export interface SiteHeaderProps {
  /** brand: transparent, over the brand background. solid: dark bar, on light pages. */
  tone?: 'brand' | 'solid';
  /** Shown on the right: navigation or account actions. */
  children?: ReactNode;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  tone = 'brand',
  children,
}) => (
  <header
    data-surface="dark"
    className={`relative flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-gutter text-white ${
      tone === 'solid' ? 'bg-primary-dark py-3.5' : 'py-[18px]'
    }`}>
    <BrandLink />
    {children}
  </header>
);

export default SiteHeader;
