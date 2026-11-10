// "Mock interview" set up (Web-X6-Setup, D100): the way in one line (only take turns is built),
// 10 or 20 minutes, Voice 1 or Voice 2 with "Hear it" (a sample the backend voiced once, served
// with the site), when the hints show (slice H2), where the questions come from, and "Continue",
// which opens the mock interview's page with these choices. The sessions left today are under it.
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import Icon from '@/components/Icon';
import Banner from '@/components/ui/Banner';
import Button from '@/components/ui/Button';
import ChoiceChips from '@/components/ui/ChoiceChips';
import SidePanel from '@/components/ui/SidePanel';
import { dailyLimitResetTime } from '@/core/profile/limits';
import {
  DEFAULT_MOCK_HINTS_SHOWN,
  MOCK_HINTS_SHOWN,
  MOCK_LENGTHS,
  MOCK_VOICES,
  type MockHintsShown,
  type MockLength,
  type MockVoice,
} from '@/core/profile/mockInterviews';
import { applicationInterviewMockPath } from '@/core/profile/paths';
import { useMockLeft } from '@/core/profile/useMockInterviews';
import { HINTS_SHOWN_KEYS, VOICE_KEYS } from '@/screens/Mock/mockParts';

export interface MockChoices {
  lengthMinutes: MockLength;
  voice: MockVoice;
  hints: MockHintsShown;
}

export const DEFAULT_MOCK_CHOICES: MockChoices = {
  lengthMinutes: 10,
  voice: 'gemini',
  hints: DEFAULT_MOCK_HINTS_SHOWN,
};

/** The choices an address carries (`?length=20&voice=chirp&hints=after-answer`), the defaults otherwise. */
export const mockChoicesOf = (search: URLSearchParams): MockChoices => {
  const length = Number(search.get('length'));
  const voice = search.get('voice');
  const hints = search.get('hints');
  return {
    lengthMinutes: (MOCK_LENGTHS as readonly number[]).includes(length)
      ? (length as MockLength)
      : DEFAULT_MOCK_CHOICES.lengthMinutes,
    voice: (MOCK_VOICES as readonly string[]).includes(voice ?? '')
      ? (voice as MockVoice)
      : DEFAULT_MOCK_CHOICES.voice,
    hints: (MOCK_HINTS_SHOWN as readonly string[]).includes(hints ?? '')
      ? (hints as MockHintsShown)
      : DEFAULT_MOCK_CHOICES.hints,
  };
};

export const mockChoicesSearch = ({
  lengthMinutes,
  voice,
  hints,
}: MockChoices) => `?length=${lengthMinutes}&voice=${voice}&hints=${hints}`;

/** Each voice saying the same line (doc 24 §13.8): "Hello, I'm an AI interviewer. …". */
export const VOICE_SAMPLES = {
  gemini: '/mock/voice-gemini.mp3',
  chirp: '/mock/voice-chirp.mp3',
} as const satisfies Record<MockVoice, string>;

export interface MockSetupPanelProps {
  applicationId: string;
  interviewId: string;
  /** "Technical interview · Senior Backend Engineer, Northwind Logistics". */
  description: string;
  initial?: MockChoices;
  onClose: () => void;
}

export const MockSetupPanel: React.FC<MockSetupPanelProps> = ({
  applicationId,
  interviewId,
  description,
  initial = DEFAULT_MOCK_CHOICES,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { left } = useMockLeft();
  const [lengthMinutes, setLengthMinutes] = useState(initial.lengthMinutes);
  const [voice, setVoice] = useState(initial.voice);
  const [hints, setHints] = useState(initial.hints);
  const sample = useRef<HTMLAudioElement | null>(null);
  const noneLeft = left?.left === 0;

  // A sample still playing stops with the panel.
  useEffect(() => () => sample.current?.pause(), []);
  const hear = (option: MockVoice) => {
    sample.current?.pause();
    sample.current = new Audio(VOICE_SAMPLES[option]);
    void sample.current.play().catch(() => {
      // Not played: the choice still stands.
    });
  };

  return (
    <SidePanel
      title={t('mock.setupTitle')}
      description={description}
      onClose={onClose}>
      <div className="flex flex-col gap-5">
        <p className="flex items-start gap-2.5 rounded-[14px] bg-tint px-3.5 py-3 text-[15px] leading-normal">
          <span aria-hidden="true" className="flex pt-0.5 text-primary">
            <Icon name="wave" size={20} />
          </span>
          <span className="min-w-0 flex-1">{t('mock.wayTakeTurns')}</span>
        </p>
        <ChoiceChips
          label={t('mock.lengthLabel')}
          options={MOCK_LENGTHS.map(minutes => ({
            value: minutes,
            label: t('mock.lengthOption', { minutes }),
          }))}
          value={lengthMinutes}
          onChange={setLengthMinutes}
        />
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sm leading-natural font-medium">
            {t('mock.voiceLabel')}
          </legend>
          <div className="flex flex-col rounded-card border border-border-faint px-3.5 py-1">
            {MOCK_VOICES.map(option => (
              <div
                key={option}
                className="flex items-center gap-2 border-t border-border-faint py-1 first:border-t-0">
                <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-[16px] leading-natural font-medium has-checked:font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)">
                  <input
                    type="radio"
                    name="mock-voice"
                    value={option}
                    checked={voice === option}
                    onChange={() => setVoice(option)}
                    className="size-5 flex-none accent-primary"
                  />
                  {t(VOICE_KEYS[option])}
                </label>
                <Button
                  variant="quiet"
                  size="small"
                  onClick={() => hear(option)}
                  aria-label={t('mock.hearVoiceButton', {
                    voice: t(VOICE_KEYS[option]),
                  })}
                  className="gap-2">
                  <Icon name="play" size={18} />
                  {t('mock.hearItButton')}
                </Button>
              </div>
            ))}
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('mock.voiceNote')}
          </p>
        </fieldset>
        <ChoiceChips
          label={t('mock.hintsLabel')}
          options={MOCK_HINTS_SHOWN.map(option => ({
            value: option,
            label: t(HINTS_SHOWN_KEYS[option]),
          }))}
          value={hints}
          onChange={setHints}
        />
        <p className="text-sm leading-normal text-muted">
          {t('mock.sourceNote')}
        </p>
        {noneLeft && (
          <Banner tone="warning" role="alert">
            {t('mock.limitMessage', {
              max: left.max,
              time: dailyLimitResetTime(),
            })}
          </Banner>
        )}
        <div className="flex flex-col items-stretch gap-2">
          <Button
            disabled={noneLeft}
            onClick={() =>
              navigate(
                applicationInterviewMockPath(applicationId, interviewId) +
                  mockChoicesSearch({ lengthMinutes, voice, hints }),
              )
            }>
            {t('mock.continueButton')}
          </Button>
          {left && (
            <p className="text-center text-sm leading-normal text-muted">
              {t('mock.left', left)}
            </p>
          )}
        </div>
      </div>
    </SidePanel>
  );
};

export default MockSetupPanel;
