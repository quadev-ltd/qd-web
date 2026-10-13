import { type ReactNode, type Ref } from 'react';

import Icon from '@/components/Icon';

export interface BannerProps {
  /** warning: worth knowing before going on. danger: something failed. success: done. */
  tone?: 'warning' | 'danger' | 'info' | 'success';
  /**
   * status: read out when there is a pause. alert: read out at once, for something that
   * just went wrong.
   */
  role?: 'status' | 'alert';
  /** Shown on the right, or under the text when there is no room: one short action. */
  action?: ReactNode;
  /** To move the focus to the message when it appears (it is not in the tab order). */
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

const TONES = {
  warning: { surface: 'bg-warning-tint', icon: 'text-warning' },
  danger: { surface: 'bg-danger-tint', icon: 'text-danger' },
  info: { surface: 'bg-chip', icon: 'text-chip-text' },
  success: { surface: 'bg-success-tint', icon: 'text-success' },
};

/** A message across the top of a page or a form, with the icon of its tone. */
export const Banner: React.FC<BannerProps> = ({
  tone = 'warning',
  role = 'status',
  action,
  ref,
  children,
}) => (
  <div
    ref={ref}
    role={role}
    tabIndex={-1}
    className={`flex flex-wrap items-start gap-2.5 rounded-[14px] px-3.5 py-3 ${TONES[tone].surface}`}>
    <span className={`flex pt-px ${TONES[tone].icon}`}>
      <Icon name={tone === 'success' ? 'check' : 'alert'} />
    </span>
    <p className="min-w-0 flex-[1_1_180px] text-[15px] leading-normal">
      {children}
    </p>
    {action}
  </div>
);

export default Banner;
