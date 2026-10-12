// The web version of qd-mobile src/components/SignIn/Layout.tsx: the frame of the sign-in,
// sign-up, forgot-password, verify-email and complete-profile screens (brand background,
// white card with the title).
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
  /** A text, or the paragraphs under the title (they bring their own styles). */
  subtitle?: ReactNode;
  /** A picture above the title (the status of the verify-email screen). */
  icon?: ReactNode;
  /** The picture, the title and the subtitle in the middle of the card. */
  centered?: boolean;
  /** Shown on the right of the header. */
  headerActions?: ReactNode;
  /** The QuaDev logo above the card (sign in). */
  showLogo?: boolean;
  /**
   * narrow: 440px (sign in). medium: 480px (verify email, complete profile). wide: 520px
   * (sign up, two fields side by side).
   */
  width?: 'narrow' | 'medium' | 'wide';
  children: ReactNode;
}

const WIDTHS = {
  narrow: 'max-w-[440px]',
  medium: 'max-w-[480px]',
  wide: 'max-w-[520px]',
};

export const Layout: React.FC<LayoutProps> = ({
  documentTitle,
  title,
  subtitle,
  icon,
  centered = false,
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
        className={`w-full gap-5 ${WIDTHS[width]}`}>
        <div
          className={`flex flex-col ${icon ? 'gap-3.5' : 'gap-1.5'} ${
            centered ? 'items-center text-center' : ''
          }`}>
          {icon}
          <h1 className="font-display text-[28px] leading-[1.2] font-semibold">
            {title}
          </h1>
          {typeof subtitle === 'string' ? (
            <p className="text-[15px] leading-normal text-muted">{subtitle}</p>
          ) : (
            subtitle
          )}
        </div>
        {children}
      </Card>
    </PageShell>
  );
};

export default Layout;
