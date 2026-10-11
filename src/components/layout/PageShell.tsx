import { type ReactNode } from 'react';

import Arcs from './Arcs';
import SiteFooter from './SiteFooter';
import SiteHeader from './SiteHeader';

export interface PageShellProps {
  /** brand: the purple background with the arcs. light: the grey page with a dark header. */
  tone?: 'brand' | 'light';
  /** The browser tab title. */
  title: string;
  /** Shown on the right of the header. */
  headerActions?: ReactNode;
  /** Layout classes for the main area. */
  mainClassName?: string;
  children: ReactNode;
}

/** The frame of every page: header, main area and footer, at least one screen tall. */
export const PageShell: React.FC<PageShellProps> = ({
  tone = 'light',
  title,
  headerActions,
  mainClassName,
  children,
}) => (
  <div
    className={`relative flex min-h-screen flex-col overflow-hidden ${
      tone === 'brand' ? 'bg-primary text-white' : 'bg-background text-text'
    }`}>
    <title>{title}</title>
    {tone === 'brand' && <Arcs />}
    <SiteHeader tone={tone === 'brand' ? 'brand' : 'solid'}>
      {headerActions}
    </SiteHeader>
    <main className={`relative flex-1 ${mainClassName ?? ''}`}>{children}</main>
    <SiteFooter />
  </div>
);

export default PageShell;
