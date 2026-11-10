// Feedback on an answer as text practice shows it (D94), and a mock interview's on each spoken
// answer (D101, Web-R2-Mock): the `answer-feedback` pack's sections in its order, an empty one left
// out. The overall view of a mock interview uses the same sections and lists.
import { useTranslation } from 'react-i18next';

import Icon, { type IconName } from '@/components/Icon';
import { type PracticeFeedback } from '@/core/profile/practice';

const TONES = {
  covered: { icon: 'check', className: 'text-success' },
  missing: { icon: 'alert', className: 'text-warning' },
  tip: { icon: 'bulb', className: 'text-primary' },
} as const satisfies Record<string, { icon: IconName; className: string }>;

export const FeedbackList: React.FC<{
  items: string[];
  tone: keyof typeof TONES;
}> = ({ items, tone }) => (
  <ul className="flex flex-col gap-2.5">
    {items.map((item, index) => (
      <li key={`${index}-${item}`} className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`flex pt-0.5 ${TONES[tone].className}`}>
          <Icon name={TONES[tone].icon} size={18} />
        </span>
        <span className="min-w-0 flex-1 text-[15px] leading-normal wrap-anywhere">
          {item}
        </span>
      </li>
    ))}
  </ul>
);

export const FeedbackSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="flex flex-col gap-2 border-t border-border-faint pt-3.5">
    <h3 className="text-sm leading-normal font-bold tracking-[0.04em] text-muted uppercase">
      {title}
    </h3>
    {children}
  </section>
);

/** What was covered and left out, structure, clarity, what to try, and the example. */
export const FeedbackSections: React.FC<{ feedback: PracticeFeedback }> = ({
  feedback,
}) => {
  const { t } = useTranslation();
  return (
    <>
      {feedback.covered.length > 0 && (
        <FeedbackSection title={t('practice.coveredTitle')}>
          <FeedbackList items={feedback.covered} tone="covered" />
        </FeedbackSection>
      )}
      {feedback.missing.length > 0 && (
        <FeedbackSection title={t('practice.missingTitle')}>
          <FeedbackList items={feedback.missing} tone="missing" />
        </FeedbackSection>
      )}
      {feedback.structure && (
        <FeedbackSection title={t('practice.structureTitle')}>
          <p className="text-[15px] leading-normal wrap-anywhere">
            {feedback.structure}
          </p>
        </FeedbackSection>
      )}
      {feedback.clarity && (
        <FeedbackSection title={t('practice.clarityTitle')}>
          <p className="text-[15px] leading-normal wrap-anywhere">
            {feedback.clarity}
          </p>
        </FeedbackSection>
      )}
      {feedback.suggestions.length > 0 && (
        <FeedbackSection title={t('practice.suggestionsTitle')}>
          <FeedbackList items={feedback.suggestions} tone="tip" />
        </FeedbackSection>
      )}
      {feedback.example && (
        <FeedbackSection title={t('practice.exampleTitle')}>
          <p className="text-[15px] leading-normal whitespace-pre-line wrap-anywhere">
            {feedback.example}
          </p>
          <p className="text-sm leading-normal text-muted">
            {t('practice.exampleNote')}
          </p>
        </FeedbackSection>
      )}
    </>
  );
};

export default FeedbackSections;
