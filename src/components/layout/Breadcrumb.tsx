// The way to a page two or more steps into a section (D96): each step a link, the last one the
// page before. At 720 px and below, one link back to the page before, named as it reads there.
// A page one step in keeps its single back link.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Icon from '@/components/Icon';

export interface BreadcrumbStep {
  label: string;
  to: string;
}

export interface BreadcrumbProps {
  /** The pages before this one, the section first. */
  steps: BreadcrumbStep[];
  /** The phone's back link: the last step, or its label when it needs more ("Senior Backend Engineer · CV"). */
  backLabel?: string;
}

const LINK =
  'flex min-h-11 items-center text-[15px] leading-natural font-medium no-underline hover:underline';

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ steps, backLabel }) => {
  const { t } = useTranslation();
  const last = steps[steps.length - 1];
  return (
    <>
      <nav
        aria-label={t('breadcrumb.label')}
        className="self-start max-[720px]:hidden">
        <ol className="flex flex-wrap items-center gap-x-2">
          {steps.map((step, index) => (
            <li key={step.to} className="flex min-w-0 items-center gap-x-2">
              {index > 0 && (
                <span aria-hidden="true" className="flex text-muted">
                  <Icon name="right" size={16} />
                </span>
              )}
              <Link to={step.to} className={`${LINK} wrap-anywhere`}>
                {step.label}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      {last && (
        <Link
          to={last.to}
          className={`${LINK} hidden gap-1 self-start wrap-anywhere max-[720px]:flex`}>
          <Icon name="left" size={18} />
          {backLabel ?? last.label}
        </Link>
      )}
    </>
  );
};

export default Breadcrumb;
