// "Mock interview" set up (Web-X6-Setup, D100): how you'll talk, the ways built so far each in one
// line (take turns, real time, the voice model; doc 24 §16), the length on a slider up to the
// interview's own (D103, doc 24 §20), Voice 1 or Voice 2 with "Hear it", none for the voice
// model, which speaks in its own (a sample the backend voiced once, served with the site), when
// the hints show (slice H2), where the questions come from, and "Continue", which opens the mock
// interview's page with these choices. The sessions left today are under it.
import { useEffect, useId, useRef, useState } from 'react';
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
  MOCK_LENGTH_DEFAULT_MINUTES,
  MOCK_LENGTH_MIN_MINUTES,
  MOCK_LENGTH_STEP_MINUTES,
  MOCK_VOICES,
  MOCK_WAYS_BUILT,
  mockLengthMax,
  mockLengthOf,
  type MockHintsShown,
  type MockVoice,
  type MockWay,
} from '@/core/profile/mockInterviews';
import { applicationInterviewMockPath } from '@/core/profile/paths';
import { useMockLeft } from '@/core/profile/useMockInterviews';
import {
  HINTS_SHOWN_KEYS,
  questionRange,
  VOICE_KEYS,
  WAY_KEYS,
  WAY_TEXT_KEYS,
} from '@/screens/Mock/mockParts';

export interface MockChoices {
  way: MockWay;
  lengthMinutes: number;
  voice: MockVoice;
  hints: MockHintsShown;
}

export const DEFAULT_MOCK_CHOICES: MockChoices = {
  way: 'take-turns',
  lengthMinutes: MOCK_LENGTH_DEFAULT_MINUTES,
  voice: 'gemini',
  hints: DEFAULT_MOCK_HINTS_SHOWN,
};

/**
 * The choices an address carries (`?length=20&voice=chirp&hints=after-answer&way=real-time`), the
 * defaults otherwise. Only a way built so far, and a length the interview allows.
 */
export const mockChoicesOf = (
  search: URLSearchParams,
  interviewLengthMinutes?: number,
): MockChoices => {
  const length = Number(search.get('length'));
  const voice = search.get('voice');
  const hints = search.get('hints');
  const way = search.get('way');
  return {
    way: MOCK_WAYS_BUILT.includes(way as MockWay)
      ? (way as MockWay)
      : DEFAULT_MOCK_CHOICES.way,
    lengthMinutes: mockLengthOf(length, interviewLengthMinutes),
    voice: (MOCK_VOICES as readonly string[]).includes(voice ?? '')
      ? (voice as MockVoice)
      : DEFAULT_MOCK_CHOICES.voice,
    hints: (MOCK_HINTS_SHOWN as readonly string[]).includes(hints ?? '')
      ? (hints as MockHintsShown)
      : DEFAULT_MOCK_CHOICES.hints,
  };
};

export const mockChoicesSearch = ({
  way,
  lengthMinutes,
  voice,
  hints,
}: MockChoices) =>
  `?length=${lengthMinutes}&voice=${voice}&hints=${hints}&way=${way}`;

/**
 * "Length" (Web-X6-Setup, D103): a native range from 5 minutes up to the interview's own length in
 * steps of 5, drawn as the board's track with a dot for each step. The arrow keys move one step,
 * and it is read as "25 minutes, about 8 to 10 questions". The right end names the interview's
 * length only when it is the highest step; with one step, only that end shows.
 */
const LengthSlider: React.FC<{
  value: number;
  interviewLengthMinutes?: number;
  onChange: (minutes: number) => void;
}> = ({ value, interviewLengthMinutes, onChange }) => {
  const { t } = useTranslation();
  const id = useId();
  const max = mockLengthMax(interviewLengthMinutes);
  const span = max - MOCK_LENGTH_MIN_MINUTES;
  const at = (minutes: number) =>
    span === 0 ? 0 : ((minutes - MOCK_LENGTH_MIN_MINUTES) / span) * 100;
  const steps = Array.from(
    { length: span / MOCK_LENGTH_STEP_MINUTES + 1 },
    (_, index) => MOCK_LENGTH_MIN_MINUTES + index * MOCK_LENGTH_STEP_MINUTES,
  );
  const questions = questionRange(t, value);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label
          htmlFor={id}
          className="flex-1 text-sm leading-natural font-medium">
          {t('mock.lengthLabel')}
        </label>
        <p className="text-[16px] leading-normal font-bold">
          {t('mock.lengthOption', { minutes: value })}
        </p>
      </div>
      <div className="relative h-11">
        <div
          aria-hidden="true"
          className="absolute inset-x-3 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border-faint">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${at(value)}%` }}
          />
          {steps.map(minutes => (
            <span
              key={minutes}
              className={`absolute top-1/2 size-1 -translate-1/2 rounded-full ${minutes < value ? 'bg-surface' : 'bg-border-strong'}`}
              style={{ left: `${at(minutes)}%` }}
            />
          ))}
        </div>
        <input
          id={id}
          type="range"
          min={MOCK_LENGTH_MIN_MINUTES}
          max={max}
          step={MOCK_LENGTH_STEP_MINUTES}
          value={value}
          onChange={event => onChange(Number(event.target.value))}
          aria-valuetext={t('mock.lengthValue', { minutes: value, questions })}
          // The board's thumb, for Chrome and Safari, then Firefox.
          className="absolute inset-0 size-full cursor-pointer appearance-none rounded-control bg-transparent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-(--focus-ring) [&::-moz-range-thumb]:box-border [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface [&::-moz-range-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)] [&::-webkit-slider-thumb]:box-border [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-solid [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(0,0,0,0.25)]"
        />
      </div>
      <div className="flex items-center gap-2 text-[13px] leading-normal text-muted">
        {span > 0 && (
          <p className="flex-1">
            {t('mock.lengthEnd', { minutes: MOCK_LENGTH_MIN_MINUTES })}
          </p>
        )}
        <p className="ml-auto">
          {max === interviewLengthMinutes
            ? t('mock.lengthEndInterview', { minutes: max })
            : t('mock.lengthEnd', { minutes: max })}
        </p>
      </div>
      <p className="text-sm leading-normal text-muted">
        {t('mock.lengthQuestions', { questions })}
      </p>
    </div>
  );
};

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
  /** The interview's own length: the longest a mock interview of it can be (D103). */
  interviewLengthMinutes?: number;
  initial?: MockChoices;
  onClose: () => void;
}

export const MockSetupPanel: React.FC<MockSetupPanelProps> = ({
  applicationId,
  interviewId,
  description,
  interviewLengthMinutes,
  initial = DEFAULT_MOCK_CHOICES,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { left } = useMockLeft();
  const [way, setWay] = useState(initial.way);
  const [lengthMinutes, setLengthMinutes] = useState(() =>
    mockLengthOf(initial.lengthMinutes, interviewLengthMinutes),
  );
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
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sm leading-natural font-medium">
            {t('mock.wayLabel')}
          </legend>
          <div className="flex flex-col rounded-card border border-border-faint px-3.5 py-1">
            {MOCK_WAYS_BUILT.map(option => (
              <div
                key={option}
                className="flex flex-col border-t border-border-faint py-1.5 first:border-t-0">
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[16px] leading-natural font-medium has-checked:font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--focus-ring)">
                  <input
                    type="radio"
                    name="mock-way"
                    value={option}
                    checked={way === option}
                    onChange={() => setWay(option)}
                    aria-describedby={`mock-way-${option}`}
                    className="size-5 flex-none accent-primary"
                  />
                  {t(WAY_KEYS[option])}
                </label>
                <p
                  id={`mock-way-${option}`}
                  className="pb-1 pl-7.5 text-sm leading-normal text-muted">
                  {t(WAY_TEXT_KEYS[option])}
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-normal text-muted">
            {t('mock.waysNote')}
          </p>
        </fieldset>
        <LengthSlider
          value={lengthMinutes}
          interviewLengthMinutes={interviewLengthMinutes}
          onChange={setLengthMinutes}
        />
        {way === 'voice-model' ? (
          // The voice model speaks in its own voice (Web-X6-RT-States).
          <div className="flex flex-col gap-1.5">
            <p className="text-sm leading-natural font-medium">
              {t('mock.voiceLabel')}
            </p>
            <p className="text-sm leading-normal text-muted">
              {t('mock.voiceModelNote')}
            </p>
          </div>
        ) : (
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
        )}
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
                  mockChoicesSearch({ way, lengthMinutes, voice, hints }),
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
