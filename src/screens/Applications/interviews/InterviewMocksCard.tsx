// "Your mock interviews" on an interview's page (Web-A8-Interview-Questions, D100, doc 24 §19): the
// ones held for this interview, the newest first, each opening its page in Sessions. Only once there
// is one; up to 3, then "See all n in Sessions", the application's Sessions tab. One still going is
// left out: its page is the interview itself.
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import Card from '@/components/ui/Card';
import { isMockGoing, type MockSession } from '@/core/profile/mockInterviews';
import { applicationSessionsPath } from '@/core/profile/paths';
import { useNow } from '@/screens/Applications/interviews/interviewText';
import MockSessionLink from '@/screens/Mock/MockSessionLink';

/** The rows the card shows before "See all n in Sessions". */
export const INTERVIEW_MOCKS_SHOWN = 3;

/** Held and over, the newest first. */
export const heldMockSessions = (sessions: MockSession[], now: number) =>
  sessions
    .filter(session => !isMockGoing(session, now))
    .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

export const InterviewMocksCard: React.FC<{
  applicationId: string;
  sessions: MockSession[];
}> = ({ applicationId, sessions }) => {
  const { t } = useTranslation();
  const now = useNow();
  const held = heldMockSessions(sessions, now);
  if (held.length === 0) {
    return null;
  }
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="interview-mocks"
      className="gap-0 p-5">
      <div className="flex flex-col gap-1 pb-1">
        <h2
          id="interview-mocks"
          className="font-display text-[18px] leading-tight font-semibold">
          {t('mock.interviewMocksTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('mock.interviewMocksText')}
        </p>
      </div>
      <ul className="flex flex-col">
        {held.slice(0, INTERVIEW_MOCKS_SHOWN).map(session => (
          <MockSessionLink key={session.id} session={session} />
        ))}
      </ul>
      {held.length > INTERVIEW_MOCKS_SHOWN && (
        // A rule across the card, as under the likely questions.
        <div className="flex border-t border-border-faint pt-2">
          <Link
            to={applicationSessionsPath(applicationId)}
            className="flex min-h-11 items-center text-[15px] leading-natural font-bold">
            {t('mock.seeAllMocksLink', { count: held.length })}
          </Link>
        </div>
      )}
    </Card>
  );
};

export default InterviewMocksCard;
