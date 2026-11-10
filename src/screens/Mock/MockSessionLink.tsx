// A mock interview in a list (D100, doc 24 §19; Web-A8-Interview-Questions, Web-R1-Application-Tab):
// the way and the length used, or its interview's name where the list mixes interviews; the day and
// the questions asked; how its feedback stands ("Feedback ready", "Preparing feedback", "No feedback
// yet"); and the whole row opens its page in Sessions.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Chip from '@/components/ui/Chip';
import {
  type MockFeedbackChip,
  mockFeedbackChipOf,
  type MockSession,
} from '@/core/profile/mockInterviews';
import { sessionMockPath } from '@/core/profile/paths';
import {
  interviewTitle,
  useNow,
} from '@/screens/Applications/interviews/interviewText';
import { mockCounts, mockMinutes, WAY_KEYS } from '@/screens/Mock/mockParts';

/** "27 Oct, 19:05", in the browser's time zone. */
const WHEN = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export const MockFeedbackChipView: React.FC<{ chip: MockFeedbackChip }> = ({
  chip,
}) => {
  const { t } = useTranslation();
  switch (chip) {
    case 'ready':
      return (
        <Chip tone="success" icon="check">
          {t('mock.feedbackReadyChip')}
        </Chip>
      );
    case 'preparing':
      return (
        <Chip tone="neutral">
          <Spinner size="small" decorative />
          {t('mock.feedbackPreparingChip')}
        </Chip>
      );
    case 'none':
      return <Chip tone="neutral">{t('mock.feedbackNoneChip')}</Chip>;
  }
};

export const MockSessionLink: React.FC<{
  session: MockSession;
  /** Named by its interview, where the list mixes interviews (the application's Sessions tab). */
  named?: boolean;
}> = ({ session, named = false }) => {
  const { t } = useTranslation();
  const now = useNow();
  const way = t(WAY_KEYS[session.way]);
  const length = t('sessions.mockMinutes', { count: mockMinutes(session) });
  const when =
    session.startedAt === null ? null : WHEN.format(session.startedAt);
  const questions = t('sessions.questions', {
    count: mockCounts(session).questions,
  });
  const title = named
    ? session.interview
      ? interviewTitle(t, session.interview)
      : t('mock.titleNoInterview')
    : `${way} · ${length}`;
  const meta = (named ? [way, length, when, questions] : [when, questions])
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="relative flex items-start gap-3 border-t border-border-faint py-3.5 first:border-t-0">
      <span
        aria-hidden="true"
        className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
        <Icon name="wave" size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link
          to={sessionMockPath(session.id)}
          className="text-[16px] leading-normal font-bold text-text no-underline wrap-anywhere after:absolute after:inset-0 hover:text-text hover:underline">
          {title}
        </Link>
        <p className="text-sm leading-normal text-muted wrap-anywhere">
          {meta}
        </p>
        <span className="flex">
          <MockFeedbackChipView chip={mockFeedbackChipOf(session, now)} />
        </span>
      </div>
      <span aria-hidden="true" className="flex self-center text-muted">
        <Icon name="right" size={18} />
      </span>
    </li>
  );
};

export default MockSessionLink;
