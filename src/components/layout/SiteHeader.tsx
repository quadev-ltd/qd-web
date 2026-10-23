import { type ReactNode } from 'react';

import BrandLink from './BrandLink';

export interface SiteHeaderProps {
  /** brand: transparent, over the brand background. solid: dark bar, on light pages. */
  tone?: 'brand' | 'solid';
  /** Shown next to the brand: the main navigation of the signed-in pages. */
  nav?: ReactNode;
  /** Where the brand leads (the public home by default). */
  brandPath?: string;
  /** Shown on the right: navigation or account actions. */
  children?: ReactNode;
}

export const SiteHeader: React.FC<SiteHeaderProps> = ({
  tone = 'brand',
  nav,
  brandPath,
  children,
}) => {
  const surface = `relative flex flex-wrap items-center px-gutter text-white ${
    tone === 'solid' ? 'bg-primary-dark py-3.5' : 'py-[18px]'
  }`;
  if (!nav) {
    return (
      <header
        data-surface="dark"
        className={`${surface} justify-between gap-x-6 gap-y-3`}>
        <BrandLink to={brandPath} />
        {children}
      </header>
    );
  }
  // With a navigation: the brand, the navigation next to it and the actions on the right.
  // On a narrow screen the navigation takes a row of its own under the other two, so the
  // account button stays in the corner (the interview tools artboards at 390).
  return (
    <header data-surface="dark" className={`${surface} gap-x-9 gap-y-2`}>
      <BrandLink to={brandPath} />
      <div className="order-3 basis-full min-[721px]:order-none min-[721px]:basis-auto">
        {nav}
      </div>
      <div className="ml-auto">{children}</div>
    </header>
  );
};

export default SiteHeader;
