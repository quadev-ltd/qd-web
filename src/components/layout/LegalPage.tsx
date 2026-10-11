import { type ReactNode } from 'react';

import PageShell from './PageShell';

export interface LegalPageProps {
  /** The browser tab title. */
  title: string;
  children: ReactNode;
}

/** A light page with one readable column, for the legal documents. */
export const LegalPage: React.FC<LegalPageProps> = ({ title, children }) => (
  <PageShell
    tone="light"
    title={title}
    mainClassName="px-gutter py-[clamp(24px,5vw,48px)]">
    <article className="legal-document mx-auto w-full max-w-[800px] rounded-card bg-surface p-[clamp(22px,6vw,48px)]">
      {children}
    </article>
  </PageShell>
);

export default LegalPage;
