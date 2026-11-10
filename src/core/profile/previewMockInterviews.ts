// What the preview gateway's fake interviewer says (D100): a plan from the interview's likely
// questions, else a few of its own; the opening and closing the backend writes without a model;
// one follow-up, after the first answer; and each line voiced as a short tone, so the page plays
// real audio. Test and preview only.
import {
  type MockLine,
  type MockLineKind,
  type MockPlanQuestion,
  type MockSession,
  type MockTurn,
} from './mockInterviews';

/** How long a voiced line lasts: a tone, long enough to hear and short enough for the tests. */
const TONE_MS = 500;

let tone: string | null = null;

/** A 0.5 second tone as a WAV file in base64: 8 kHz, 16-bit, mono. */
export const previewToneBase64 = (): string => {
  if (tone) {
    return tone;
  }
  const rate = 8_000;
  const samples = (rate * TONE_MS) / 1_000;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) =>
    [...value].forEach((char, index) =>
      view.setUint8(at + index, char.charCodeAt(0)),
    );
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const value = Math.sin((2 * Math.PI * 440 * index) / rate) * 0.2;
    view.setInt16(44 + index * 2, value * 0x7fff, true);
  }
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  tone = btoa(binary);
  return tone;
};

const OWN_QUESTIONS: Pick<MockPlanQuestion, 'text' | 'kind'>[] = [
  { text: 'Tell me about yourself and the work you do now.', kind: 'role' },
  {
    text: 'Tell me about an incident you led from alert to fix.',
    kind: 'behavioural',
  },
  {
    text: 'How would you keep a service correct when events arrive late or twice?',
    kind: 'technical',
  },
  { text: 'Why this role, and why now?', kind: 'motivation' },
  {
    text: 'Tell me about a time you disagreed with a decision.',
    kind: 'behavioural',
  },
  {
    text: 'What would you change first in your next team?',
    kind: 'role',
  },
];

/** 4 questions for 10 minutes, 6 for 20: the interview's likely questions first. */
export const previewMockPlan = (
  likely: Pick<MockPlanQuestion, 'text' | 'kind'>[],
  lengthMinutes: number,
): MockPlanQuestion[] =>
  [...likely, ...OWN_QUESTIONS]
    .slice(0, lengthMinutes >= 20 ? 6 : 4)
    .map(({ text, kind }, index) => ({
      id: `p${index + 1}`,
      text,
      rephrased: `In other words: ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
      kind,
    }));

export const previewOpening = (title: string, lengthMinutes: number) =>
  `Hello. I’m an AI interviewer, and this is a practice interview for the ${title} role. It takes about ${lengthMinutes} minutes. Let’s begin.`;

export const previewClosing = (outOfTime: boolean) =>
  `${outOfTime ? 'We’re out of time, so that’s' : 'That’s'} all my questions. Thank you, this is the end of the interview.`;

/** The one follow-up of the fake: after the first planned question's answer. */
export const PREVIEW_FOLLOW_UP =
  'What was your own part in it, and what changed afterwards?';

export const previewLine = (
  lineId: string,
  kind: MockLineKind,
  text: string,
  turnId?: string,
): MockLine => ({
  lineId,
  kind,
  ...(turnId ? { turnId } : {}),
  text,
  audio: {
    mimeType: 'audio/wav',
    base64: previewToneBase64(),
    durationMs: TONE_MS,
  },
});

/** What comes after an answered or skipped turn: a follow-up, the next planned question, or the end. */
export const previewNextStep = (
  session: Pick<MockSession, 'plan' | 'turns'>,
  turn: MockTurn,
  answered: boolean,
):
  | { kind: 'follow-up'; planId: string }
  | { kind: 'question'; question: MockPlanQuestion }
  | { kind: 'closing' } => {
  const index = session.plan.questions.findIndex(
    ({ id }) => id === turn.planId,
  );
  if (answered && turn.kind === 'planned' && index === 0) {
    return { kind: 'follow-up', planId: turn.planId };
  }
  const next = session.plan.questions[index + 1];
  return next ? { kind: 'question', question: next } : { kind: 'closing' };
};
