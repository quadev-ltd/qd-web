// Parts the mock interview pages share (X6, R2, D100): the status panel of the boards, the
// summary of a mock interview's choices, and the words for its voice, length, hints and ending.
import { type TFunction } from 'i18next';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import Icon, { type IconName } from '@/components/Icon';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import {
  type MockHintsShown,
  type MockLength,
  type MockSession,
  type MockVoice,
  type MockWay,
} from '@/core/profile/mockInterviews';

/** Each way's name (doc 24 §16): "Take turns", "Real time". */
export const WAY_KEYS = {
  'take-turns': 'mock.wayTakeTurnsName',
  'real-time': 'mock.wayRealTimeName',
  'voice-model': 'mock.wayVoiceModelName',
} as const satisfies Record<MockWay, string>;

/** Each way in one line, for the setup. */
export const WAY_TEXT_KEYS = {
  'take-turns': 'mock.wayTakeTurnsText',
  'real-time': 'mock.wayRealTimeText',
  'voice-model': 'mock.wayVoiceModelText',
} as const satisfies Record<MockWay, string>;

export const VOICE_KEYS = {
  gemini: 'mock.voiceGemini',
  chirp: 'mock.voiceChirp',
} as const satisfies Record<MockVoice, string>;

export const LENGTH_SUMMARY_KEYS = {
  10: 'mock.lengthSummary10',
  20: 'mock.lengthSummary20',
} as const satisfies Record<MockLength, string>;

/** The setup's choice, in the candidate's words. */
export const HINTS_SHOWN_KEYS = {
  'with-question': 'mock.hintsWithQuestion',
  'on-request': 'mock.hintsOnRequest',
  'after-answer': 'mock.hintsAfterAnswer',
} as const satisfies Record<MockHintsShown, string>;

/** The same, in "Your interview": "When you ask". */
const HINTS_SUMMARY_KEYS = {
  'with-question': 'mock.hintsSummaryWithQuestion',
  'on-request': 'mock.hintsSummaryOnRequest',
  'after-answer': 'mock.hintsSummaryAfterAnswer',
} as const satisfies Record<MockHintsShown, string>;

const PANEL_SURFACES = {
  plain: 'bg-surface shadow-card',
  success: 'bg-success-tint',
  warning: 'bg-warning-tint',
  danger: 'bg-danger-tint',
};
const PANEL_TILES = {
  plain: 'bg-tint text-primary',
  success: 'bg-surface text-success',
  warning: 'bg-surface text-warning',
  danger: 'bg-surface text-danger',
};

/** The boards' status panel: a tile or a spinner, a heading, what it means, and what to do. */
export const MockPanel: React.FC<{
  tone?: keyof typeof PANEL_SURFACES;
  icon?: IconName;
  /** Instead of the icon's tile: a spinner. */
  lead?: ReactNode;
  title: string;
  /** The heading's level: 1 when the panel is what the page is about. */
  level?: 1 | 2;
  children: ReactNode;
  actions?: ReactNode;
  role?: 'status' | 'alert';
}> = ({
  tone = 'plain',
  icon,
  lead,
  title,
  level = 2,
  children,
  actions,
  role = 'status',
}) => {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div
      role={role}
      className={`flex flex-col gap-2.5 rounded-card p-5 ${PANEL_SURFACES[tone]}`}>
      <div className="flex items-center gap-3">
        {lead ??
          (icon && (
            <span
              aria-hidden="true"
              className={`flex size-10 flex-none items-center justify-center rounded-full ${PANEL_TILES[tone]}`}>
              <Icon name={icon} size={20} />
            </span>
          ))}
        <Heading className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {title}
        </Heading>
      </div>
      <div className="flex flex-col gap-2 text-[15px] leading-normal">
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
};

/** "Your interview": the way, the length and the voice, with "Change" before it starts. */
export const MockSummaryCard: React.FC<{
  way: MockWay;
  lengthMinutes: MockLength;
  voice: MockVoice;
  hints: MockHintsShown;
  onChange?: () => void;
}> = ({ way, lengthMinutes, voice, hints, onChange }) => {
  const { t } = useTranslation();
  const rows = [
    [t('mock.summaryWay'), t(WAY_KEYS[way])],
    [t('mock.summaryLength'), t(LENGTH_SUMMARY_KEYS[lengthMinutes])],
    [t('mock.summaryVoice'), t(VOICE_KEYS[voice])],
    [t('mock.summaryHints'), t(HINTS_SUMMARY_KEYS[hints])],
  ];
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby="mock-summary"
      className="gap-3 p-5">
      <div className="flex items-center gap-2">
        <h2
          id="mock-summary"
          className="min-w-0 flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('mock.summaryTitle')}
        </h2>
        {onChange && (
          <Button
            variant="quiet"
            size="small"
            onClick={onChange}
            className="gap-2">
            <Icon name="edit" size={18} />
            {t('mock.changeButton')}
          </Button>
        )}
      </div>
      <dl className="grid grid-cols-[minmax(80px,auto)_1fr] gap-x-4 gap-y-2 text-[15px] leading-normal">
        {rows.map(([term, detail]) => (
          <div key={term} className="contents">
            <dt className="text-muted">{term}</dt>
            <dd className="wrap-anywhere">{detail}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
};

/** "Mock interview · Technical interview", or "Mock interview" without one. */
export const mockTitle = (t: TFunction, interviewName?: string) =>
  interviewName
    ? t('mock.title', { name: interviewName })
    : t('mock.titleNoInterview');

/** The planned questions asked and the follow-ups, from the session's turns. */
export const mockCounts = (session: Pick<MockSession, 'turns'>) => ({
  questions: session.turns.filter(({ kind }) => kind === 'planned').length,
  followUps: session.turns.filter(({ kind }) => kind === 'follow-up').length,
  answered: session.turns.filter(({ status }) => status === 'answered').length,
});

/** The minutes the interview ran, its pauses left out: at least 1. */
export const mockMinutes = (
  session: Pick<
    MockSession,
    'startedAt' | 'endedAt' | 'updatedAt' | 'pausedMs'
  >,
) => {
  const start = session.startedAt ?? 0;
  const end = session.endedAt ?? session.updatedAt ?? start;
  return Math.max(1, Math.round((end - start - session.pausedMs) / 60_000));
};
