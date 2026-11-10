// Sessions (R1, D85, D94, D100): the practice kept, one card per job, the most recently practised
// first. A job's mock interviews come first (with `mockInterview`), each with its way, questions,
// minutes and day, opening what was said; then each question with its kind, where it came from
// and when it was last practised, opening its practice. A removed application's practice stays
// under its name (from the snapshot) with "Application removed" and "Remove all", asked first
// (D99).
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import RemoveAllPracticeDialog from './RemoveAllPracticeDialog';

import Icon from '@/components/Icon';
import SignedInShell from '@/components/layout/SignedInShell';
import Spinner from '@/components/Spinner';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import Chip from '@/components/ui/Chip';
import { useFlag } from '@/core/flags/FlagsProvider';
import { type JobApplication } from '@/core/profile/applications';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { logProfileError } from '@/core/profile/errors';
import { isMockIdle, type MockSession } from '@/core/profile/mockInterviews';
import {
  APPLICATIONS_PATH,
  sessionMockPath,
  sessionPracticePath,
} from '@/core/profile/paths';
import { type PracticeTurn } from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectPractice } from '@/core/state/selectors/practice';
import { QUESTION_KIND_KEYS } from '@/screens/Applications/BriefCards';
import {
  interviewTitle,
  useNow,
} from '@/screens/Applications/interviews/interviewText';
import { mockCounts, mockMinutes, mockTitle } from '@/screens/Mock/mockParts';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** One job's practice: its mock interviews and its turns, the most recently changed first. */
interface Group {
  applicationId: string;
  title: string;
  company?: string;
  removed: boolean;
  sessions: MockSession[];
  turns: PracticeTurn[];
}

/** What a group is made from: a turn or a mock interview, with the job's snapshot. */
type Practised =
  { kind: 'turn'; item: PracticeTurn } | { kind: 'session'; item: MockSession };

/**
 * The turns and mock interviews by application, in the order of their latest change. A job is
 * named as it is now, or as it was when its practice started once it is removed.
 */
export const groupsOf = (
  turns: PracticeTurn[],
  applications: JobApplication[],
  untitled: string,
  sessions: MockSession[] = [],
): Group[] => {
  const groups = new Map<string, Group>();
  const all: Practised[] = [
    ...turns.map(item => ({ kind: 'turn' as const, item })),
    ...sessions.map(item => ({ kind: 'session' as const, item })),
  ].sort((a, b) => (b.item.updatedAt ?? 0) - (a.item.updatedAt ?? 0));
  for (const { kind, item } of all) {
    let group = groups.get(item.applicationId);
    if (!group) {
      const application = item.applicationRemoved
        ? undefined
        : applications.find(({ id }) => id === item.applicationId);
      group = {
        applicationId: item.applicationId,
        title: application?.title || item.application.title || untitled,
        company: application?.company || item.application.company,
        removed: Boolean(item.applicationRemoved),
        sessions: [],
        turns: [],
      };
      groups.set(item.applicationId, group);
    }
    if (kind === 'turn') {
      group.turns.push(item);
    } else {
      group.sessions.push(item);
    }
  }
  return [...groups.values()];
};

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; turns: PracticeTurn[]; sessions: MockSession[] };

/**
 * Every turn and, with mock interviews on, every mock interview: read when the page opens, after
 * every change, and after "Try again".
 */
const usePracticeTurns = (withSessions: boolean) => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { changes } = useAppSelector(selectPractice);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(
    null,
  );
  const key = `${changes}/${attempt}/${withSessions}`;

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    Promise.all([
      gateway.getPracticeTurns(uid),
      withSessions ? gateway.getMockSessions(uid) : Promise.resolve([]),
    ]).then(
      ([turns, sessions]) =>
        live &&
        setLoaded({ key, state: { status: 'loaded', turns, sessions } }),
      error => {
        logProfileError('getPracticeTurns', error, uid);
        if (live) {
          setLoaded({ key, state: { status: 'error' } });
        }
      },
    );
    return () => {
      live = false;
    };
  }, [gateway, key, uid, withSessions]);

  // What was read stays on screen while it is read again.
  return {
    state: loaded?.state ?? ({ status: 'loading' } as const),
    reload: () => setAttempt(count => count + 1),
  };
};

const TurnRow: React.FC<{ turn: PracticeTurn }> = ({ turn }) => {
  const { t } = useTranslation();
  const from =
    turn.question.source === 'brief'
      ? t('sessions.fromBrief')
      : turn.question.source === 'typed'
        ? t('sessions.typed')
        : turn.interview
          ? interviewTitle(t, turn.interview)
          : null;
  const meta = [
    from,
    turn.attempts.length > 0
      ? t('sessions.tries', { count: turn.attempts.length })
      : null,
    turn.updatedAt !== null ? formatDay(turn.updatedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="relative flex items-center gap-3 border-t border-border-faint py-3.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex">
          <Chip tone="info">{t(QUESTION_KIND_KEYS[turn.question.kind])}</Chip>
        </span>
        <Link
          to={sessionPracticePath(turn.id)}
          className="text-[16px] leading-normal font-bold text-text no-underline wrap-anywhere after:absolute after:inset-0 hover:text-text hover:underline">
          {turn.question.text}
        </Link>
        {meta && (
          <p className="text-sm leading-normal text-muted wrap-anywhere">
            {meta}
          </p>
        )}
      </div>
      <span aria-hidden="true" className="flex text-muted">
        <Icon name="right" size={18} />
      </span>
    </li>
  );
};

/** A mock interview: its way, questions asked, minutes and day; one still going says so. */
const MockRow: React.FC<{ session: MockSession }> = ({ session }) => {
  const { t } = useTranslation();
  const now = useNow();
  const { questions } = mockCounts(session);
  const going = session.status === 'active';
  const meta = [
    t('mock.wayName'),
    t('sessions.questions', { count: questions }),
    going
      ? isMockIdle(session, now)
        ? t('sessions.mockNotFinished')
        : t('sessions.mockGoing')
      : t('sessions.mockMinutes', { count: mockMinutes(session) }),
    session.startedAt !== null ? formatDay(session.startedAt) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="relative flex items-center gap-3 border-t border-border-faint py-3.5 first:border-t-0">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex">
          <Chip tone="brand" icon="wave">
            {t('sessions.mockChip')}
          </Chip>
        </span>
        <Link
          to={sessionMockPath(session.id)}
          className="text-[16px] leading-normal font-bold text-text no-underline wrap-anywhere after:absolute after:inset-0 hover:text-text hover:underline">
          {mockTitle(
            t,
            session.interview
              ? interviewTitle(t, session.interview)
              : undefined,
          )}
        </Link>
        <p className="text-sm leading-normal text-muted wrap-anywhere">
          {meta}
        </p>
      </div>
      <span aria-hidden="true" className="flex text-muted">
        <Icon name="right" size={18} />
      </span>
    </li>
  );
};

const GroupCard: React.FC<{ group: Group; onRemoveAll: () => void }> = ({
  group,
  onRemoveAll,
}) => {
  const { t } = useTranslation();
  const subtitle = [
    group.company,
    group.sessions.length > 0
      ? t('sessions.mockInterviews', { count: group.sessions.length })
      : null,
    group.turns.length > 0
      ? t('sessions.questions', { count: group.turns.length })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const headingId = `session-${group.applicationId}`;
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-0 p-5">
      <div className="flex flex-col gap-0.5 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2
            id={headingId}
            className="min-w-0 flex-[1_1_200px] font-display text-[18px] leading-tight font-semibold wrap-anywhere">
            {group.title}
          </h2>
          {group.removed && (
            <Chip tone="neutral">{t('sessions.applicationRemovedChip')}</Chip>
          )}
        </div>
        <p className="text-sm leading-normal text-muted wrap-anywhere">
          {subtitle}
        </p>
      </div>
      <ul className="flex flex-col">
        {group.sessions.map(session => (
          <MockRow key={session.id} session={session} />
        ))}
        {group.turns.map(turn => (
          <TurnRow key={turn.id} turn={turn} />
        ))}
      </ul>
      {group.removed && (
        <div className="flex border-t border-border-faint pt-2">
          <Button
            variant="quietDanger"
            size="small"
            onClick={onRemoveAll}
            className="gap-2 text-[15px]">
            <Icon name="trash" size={18} />
            {t('sessions.removeAllButton')}
          </Button>
        </div>
      )}
    </Card>
  );
};

export const SessionsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { applications } = useApplications();
  const mockInterview = useFlag('mockInterview');
  const { state, reload } = usePracticeTurns(mockInterview);
  const [removing, setRemoving] = useState<Group | null>(null);

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = (
      <div className="flex justify-center py-16 text-primary">
        <Spinner />
      </div>
    );
  } else if (state.status === 'error') {
    body = (
      <Banner
        tone="danger"
        role="alert"
        action={
          <Button variant="quiet" size="small" onClick={reload}>
            {t('sessions.retryButton')}
          </Button>
        }>
        {t('sessions.loadErrorMessage')}
      </Banner>
    );
  } else if (state.turns.length === 0 && state.sessions.length === 0) {
    body = (
      <Card
        elevation="raised"
        className="items-center gap-3 px-6 py-12 text-center">
        <span className="flex size-16 flex-none items-center justify-center rounded-full bg-tint text-primary">
          <Icon name="mic" size={28} />
        </span>
        <h2 className="font-display text-[20px] leading-tight font-semibold">
          {t('sessions.emptyTitle')}
        </h2>
        <p className="max-w-[420px] text-[15px] leading-normal text-muted">
          {t('sessions.emptyDescription')}
        </p>
        <ButtonLink to={APPLICATIONS_PATH} variant="secondary" size="small">
          {t('sessions.emptyLink')}
        </ButtonLink>
      </Card>
    );
  } else {
    const groups = groupsOf(
      state.turns,
      applications,
      t('applications.untitled'),
      state.sessions,
    );
    body = (
      <>
        {groups.map(group => (
          <GroupCard
            key={group.applicationId}
            group={group}
            onRemoveAll={() => setRemoving(group)}
          />
        ))}
        <p className="text-sm leading-normal text-muted">
          {t('sessions.removedNote')}
        </p>
      </>
    );
  }

  return (
    <SignedInShell
      title={t('sessions.documentTitle')}
      mainClassName={PROFILE_MAIN}>
      <div className="mx-auto max-w-[1120px]">
        <div className="flex max-w-[760px] flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-display text-[28px] leading-tight font-semibold">
              {t('sessions.title')}
            </h1>
            <p className="text-[16px] leading-normal text-muted">
              {mockInterview
                ? t('sessions.descriptionWithMock')
                : t('sessions.description')}
            </p>
          </div>
          {body}
        </div>
      </div>
      {removing && (
        <RemoveAllPracticeDialog
          applicationId={removing.applicationId}
          title={removing.title}
          company={removing.company}
          questions={removing.turns.length}
          mockInterviews={removing.sessions.length}
          onCancel={() => setRemoving(null)}
          onRemoved={() => setRemoving(null)}
        />
      )}
    </SignedInShell>
  );
};

export default SessionsScreen;
