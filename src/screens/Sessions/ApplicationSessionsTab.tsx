// An application's Sessions tab (Web-R1-Application-Tab, D100, doc 24 §19): this job's practice as
// Sessions groups it. Its mock interviews first, each named by its interview with the way, the
// length used, the day, the questions and how its feedback stands; then the questions practised, as
// Sessions lists them. One still going is left out: its page is the interview itself. With none:
// where to start. With text practice or mock interviews on.
import { useTranslation } from 'react-i18next';

import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useFlag } from '@/core/flags/FlagsProvider';
import { type JobApplication } from '@/core/profile/applications';
import { heldMockSessions } from '@/screens/Applications/interviews/InterviewMocksCard';
import { useNow } from '@/screens/Applications/interviews/interviewText';
import MockSessionLink from '@/screens/Mock/MockSessionLink';
import { TurnRow, usePracticeTurns } from '@/screens/Sessions/SessionsScreen';

const HEADING = 'font-display text-[18px] leading-tight font-semibold';

export const ApplicationSessionsTab: React.FC<{
  application: JobApplication;
}> = ({ application }) => {
  const { t } = useTranslation();
  const mockInterview = useFlag('mockInterview');
  const { state, reload } = usePracticeTurns(mockInterview);
  const now = useNow();

  if (state.status === 'loading') {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('sessions.retryButton')}
          </Button>
        }>
        {t('sessions.appLoadError')}
      </Banner>
    );
  }

  const sessions = heldMockSessions(
    state.sessions.filter(
      ({ applicationId }) => applicationId === application.id,
    ),
    now,
  );
  const turns = state.turns
    .filter(({ applicationId }) => applicationId === application.id)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  if (sessions.length === 0 && turns.length === 0) {
    return (
      <p className="text-[16px] leading-normal text-muted">
        {t('sessions.appEmpty')}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {sessions.length > 0 && (
        <section aria-labelledby="app-mocks" className="flex flex-col gap-4">
          <h2 id="app-mocks" className={HEADING}>
            {t('sessions.appMocksTitle', { count: sessions.length })}
          </h2>
          <Card elevation="raised" className="px-5 py-1">
            <ul className="flex flex-col">
              {sessions.map(session => (
                <MockSessionLink key={session.id} session={session} named />
              ))}
            </ul>
          </Card>
        </section>
      )}
      {turns.length > 0 && (
        <section aria-labelledby="app-turns" className="flex flex-col gap-4">
          <h2 id="app-turns" className={HEADING}>
            {t('sessions.appTurnsTitle', { count: turns.length })}
          </h2>
          <Card elevation="raised" className="px-5 py-1">
            <ul className="flex flex-col">
              {turns.map(turn => (
                <TurnRow key={turn.id} turn={turn} />
              ))}
            </ul>
          </Card>
        </section>
      )}
      <p className="text-sm leading-normal text-muted">
        {t('sessions.appKeptNote')}
      </p>
    </div>
  );
};

export default ApplicationSessionsTab;
