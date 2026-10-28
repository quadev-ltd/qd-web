// Sessions (R1, D85, D94): the practice kept, one card per job, the most recently practised first.
// Each question shows its kind, where it came from and when it was last practised, and opens its
// practice. A removed application's practice stays under its name (from the turn's snapshot) with
// "Application removed" and "Remove all", asked first (D99). Mock interviews will join this page.
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
import { type JobApplication } from '@/core/profile/applications';
import { useApplications } from '@/core/profile/ApplicationsProvider';
import { logProfileError } from '@/core/profile/errors';
import { APPLICATIONS_PATH, sessionPracticePath } from '@/core/profile/paths';
import { type PracticeTurn } from '@/core/profile/practice';
import { useProfileGateway } from '@/core/profile/ProfileGatewayProvider';
import { useSessionUser } from '@/core/session/hooks';
import { useAppSelector } from '@/core/state/hooks';
import { selectPractice } from '@/core/state/selectors/practice';
import { QUESTION_KIND_KEYS } from '@/screens/Applications/BriefCards';
import { interviewTitle } from '@/screens/Applications/interviews/interviewText';
import { PROFILE_MAIN } from '@/screens/Profile/ProfileRoutes';
import { formatDay } from '@/screens/Profile/Resource/resourceMeta';

/** One job's practice: its turns, the most recently practised first. */
interface Group {
  applicationId: string;
  title: string;
  company?: string;
  removed: boolean;
  turns: PracticeTurn[];
}

/**
 * The turns by application, in the order of their latest practice. A job is named as it is now,
 * or as it was when its practice started once it is removed.
 */
export const groupsOf = (
  turns: PracticeTurn[],
  applications: JobApplication[],
  untitled: string,
): Group[] => {
  const groups = new Map<string, Group>();
  const newestFirst = [...turns].sort(
    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
  );
  for (const turn of newestFirst) {
    let group = groups.get(turn.applicationId);
    if (!group) {
      const application = turn.applicationRemoved
        ? undefined
        : applications.find(({ id }) => id === turn.applicationId);
      group = {
        applicationId: turn.applicationId,
        title: application?.title || turn.application.title || untitled,
        company: application?.company || turn.application.company,
        removed: Boolean(turn.applicationRemoved),
        turns: [],
      };
      groups.set(turn.applicationId, group);
    }
    group.turns.push(turn);
  }
  return [...groups.values()];
};

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; turns: PracticeTurn[] };

/** Every turn, read when the page opens, after every change, and after "Try again". */
const usePracticeTurns = () => {
  const gateway = useProfileGateway();
  const uid = useSessionUser()?.uid;
  const { changes } = useAppSelector(selectPractice);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; state: Loaded } | null>(
    null,
  );
  const key = `${changes}/${attempt}`;

  useEffect(() => {
    if (!uid) {
      return undefined;
    }
    let live = true;
    gateway.getPracticeTurns(uid).then(
      turns => live && setLoaded({ key, state: { status: 'loaded', turns } }),
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
  }, [gateway, key, uid]);

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

const GroupCard: React.FC<{ group: Group; onRemoveAll: () => void }> = ({
  group,
  onRemoveAll,
}) => {
  const { t } = useTranslation();
  const subtitle = [
    group.company,
    t('sessions.questions', { count: group.turns.length }),
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
  const { state, reload } = usePracticeTurns();
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
  } else if (state.turns.length === 0) {
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
              {t('sessions.description')}
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
          onCancel={() => setRemoving(null)}
          onRemoved={() => setRemoving(null)}
        />
      )}
    </SignedInShell>
  );
};

export default SessionsScreen;
