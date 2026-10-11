// The web version of qd-mobile src/components/SignIn/Layout.tsx: the frame of the sign-in,
// sign-up and forgot-password screens (brand background, white card with the title).
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import logo from '@/assets/images/QuaDevIconAlpha.png';
import PageShell from '@/components/layout/PageShell';
import Card from '@/components/ui/Card';

export interface LayoutProps {
  /** The browser tab title. */
  documentTitle: string;
  /** The card's heading. */
  title: string;
  subtitle?: string;
  /** Shown on the right of the header. */
  headerActions?: ReactNode;
  /** The QuaDev logo above the card (sign in). */
  showLogo?: boolean;
  /** narrow: 440px (sign in). wide: 520px (sign up, two fields side by side). */
  width?: 'narrow' | 'wide';
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  documentTitle,
  title,
  subtitle,
  headerActions,
  showLogo = false,
  width = 'narrow',
  children,
}) => {
  const { t } = useTranslation();
  return (
    <PageShell
      tone="brand"
      arcs="auth"
      title={documentTitle}
      headerActions={headerActions}
      mainClassName={`flex flex-col items-center justify-center gap-7 px-5 pb-14 ${
        showLogo ? 'pt-6' : 'pt-4'
      }`}>
      {showLogo && (
        <img
          src={logo}
          alt={t('brand.logoAlt')}
          width={720}
          height={888}
          className="h-32 w-auto"
        />
      )}
      <Card
        elevation="floating"
        padding="roomy"
        className={`w-full gap-5 ${
          width === 'wide' ? 'max-w-[520px]' : 'max-w-[440px]'
        }`}>
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] leading-[1.2] font-semibold">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[15px] leading-normal text-muted">{subtitle}</p>
          )}
        </div>
        {children}
      </Card>
    </PageShell>
  );
};

export default Layout;
