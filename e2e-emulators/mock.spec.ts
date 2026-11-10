// Mock interviews taken in turns (D100, doc 24 slice 1) against the real backend code:
// startMockInterview through App Check and both flags, with the offline `interviewer-plan` fake's
// plan (a warm-up, the interview's likely question, then written ones) and the emulator's WAV
// lines played by Web Audio; answerMockQuestion with a real recording, heard by the offline
// `answer-transcript` fake ("fake-transcript: N bytes of audio/webm.", nothing under 1,000 bytes)
// and followed up by the `interviewer-next` fake; rephraseMockQuestion, skipMockQuestion,
// pauseMockInterview, resumeMockInterview after a reload, endMockInterview, sendMockFeedback; the
// session read back under the rules in Sessions, the day's count from `usage`, and
// removeMockSession; the hints (H1) the trigger writes, read again until in; and the feedback on
// the answers with the overall view (F1), written by the same trigger from the offline
// `answer-feedback` and `mock-summary` fakes, one asked for again, and a question practised from
// it (the `mock` source); and the real-time way over the `live-assist` relay with its fakes (doc
// 24 §15.7: any sound is speech, 1.5 seconds of silence ends an answer, each line is 400 ms of
// silence). The clock is moved as the backend's own tests move it.
import { expect, type Page, test } from '@playwright/test';

import {
  createAccount,
  failMockAnswerFeedback,
  moveMockSessionBack,
  setUsageToday,
  signIn,
} from './support';

/**
 * A microphone for the browser: a tone played into a real audio stream, which the page records
 * as it would a microphone (Chromium's fake devices wait on the Mac's own permission).
 * `window.qdMicrophone.gain` silences it, so a short answer is "nothing heard".
 */
const microphone = (page: Page) =>
  page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const context = new AudioContext();
      const tone = context.createOscillator();
      const gain = context.createGain();
      const known = window as unknown as {
        qdMicrophone: GainNode;
        qdMicrophoneVolume?: number;
      };
      gain.gain.value = known.qdMicrophoneVolume ?? 1;
      const destination = context.createMediaStreamDestination();
      tone.connect(gain).connect(destination);
      tone.start();
      known.qdMicrophone = gain;
      return destination.stream;
    };
  });

const setMicrophone = (page: Page, volume: number) =>
  page.evaluate(level => {
    (window as unknown as { qdMicrophone: GainNode }).qdMicrophone.gain.value =
      level;
  }, volume);

test.beforeEach(async ({ page }) => {
  await microphone(page);
});

/** A date this many days from today in London, as the date field takes it. */
const inDays = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(
    Date.now() + days * 86_400_000,
  );

/** A new account with text practice and mock interviews on, an application, its interview and its likely question. */
const openInterview = async (page: Page) => {
  const account = await createAccount({
    interviewAssistant: true,
    textPractice: true,
    mockInterview: true,
  });
  await signIn(page, account);
  await page.getByRole('button', { name: /Prepare for a job/ }).click();
  const panel = page.getByRole('dialog', { name: 'New application' });
  await panel
    .getByLabel('Job description')
    .fill('Go services in production, Kafka, and incident response.');
  await panel.getByRole('button', { name: 'Add the job' }).click();
  await expect(page).toHaveURL(/\/applications\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^fake-/);
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('button', { name: 'Add an interview' }).click();
  const add = page.getByRole('dialog', { name: 'Add an interview' });
  await add.getByLabel('Name (optional)').fill('Technical interview');
  await add.getByLabel('Date').fill(inDays(7));
  await add.getByLabel('Start time').fill('14:00');
  await add.getByRole('button', { name: 'Add the interview' }).click();
  await expect(add).toBeHidden();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const questions = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('listitem')).toHaveCount(1, {
    timeout: 30_000,
  });
  return account;
};

const interviewer = (page: Page) =>
  page.getByRole('region', { name: 'AI interviewer' });
const answer = (page: Page) =>
  page.getByRole('region', { name: 'Your answer' });

/** The setup's choices kept, the interview started: the opening, then the warm-up, recording. */
const start = async (page: Page) => {
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(setup).toContainText('3 of 3 mock interviews left today');
  await setup.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'fake-warm-up: tell me about your background.',
  );
  await expect(answer(page)).toContainText('Recording ·');
  await expect(page).toHaveURL(/\/mock\/[^/?]+$/);
  return new URL(page.url()).pathname.split('/').pop() ?? '';
};

/** Recorded long enough to be heard (well over 1,000 bytes), then sent. */
const answerNow = async (page: Page) => {
  await page.waitForTimeout(1_500);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
};

test('mock interview (D100 slice 1): started, answered, followed up, said differently, skipped, resumed after a reload, paused, ended, rated, read in Sessions and removed', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);
  // The plan for 10 minutes: 4 questions, the warm-up first
  await expect(page.getByText(/Question 1 of 4 · \d+ min left/)).toBeVisible();

  // answerMockQuestion: the fake hears the recording and asks a follow-up
  await answerNow(page);
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
  );
  await expect(
    interviewer(page).getByText('Follow-up', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Question 1 of 4/)).toBeVisible();
  await expect(answer(page)).toContainText('Recording ·');

  // rephraseMockQuestion: the follow-up in other words
  await interviewer(page)
    .getByRole('button', { name: 'Say it differently' })
    .click();
  await expect(interviewer(page)).toContainText(
    'fake-rephrased: what was the result?',
  );
  await expect(answer(page)).toContainText('Recording ·');

  // skipMockQuestion: the interview's likely question, second in the plan
  await interviewer(page).getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible();
  await expect(answer(page)).toContainText('Recording ·');

  // resumeMockInterview: after a reload, the same question again
  page.on('dialog', dialog => void dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Continue the interview' }).click();
  await expect(answer(page)).toContainText('Recording ·');
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible();

  // pauseMockInterview, both ways
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue answering' }).click();
  await expect(answer(page)).toContainText('Recording ·');

  // endMockInterview, then sendMockFeedback
  await page.getByRole('button', { name: 'End interview' }).click();
  await page
    .getByRole('dialog', { name: 'End the interview?' })
    .getByRole('button', { name: 'End the interview' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible();
  const feedback = page.getByRole('region', { name: 'How did it go?' });
  await feedback.getByText('4', { exact: true }).click();
  await feedback.getByText('A bit long').click();
  await feedback.getByRole('button', { name: 'Send' }).click();
  await expect(feedback).toContainText('Thank you.');
  // One answer: no overall view (F1)
  await expect(page.getByRole('region', { name: 'How it went' })).toContainText(
    'An overall view needs at least 2 answers.',
  );

  // The session as stored, read under the rules
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(page).toHaveURL(/\/sessions\/mock\/[^/]+$/);
  const said = page.getByRole('region', { name: 'What was said' });
  await expect(said).toContainText(
    'fake-warm-up: tell me about your background.',
  );
  await expect(said).toContainText(
    /fake-transcript: \d+ bytes of audio\/webm\./,
  );
  // The follow-up as last said, in other words, with the first wording under it, and skipped
  await expect(said).toContainText('fake-rephrased: what was the result?');
  await expect(said).toContainText('Said differently');
  await expect(said).toContainText(
    'First asked: “fake-follow-up: what came of it?”',
  );
  await expect(said).toContainText('Skipped');
  await expect(
    page.getByText('4 of 5 · the wait was a bit long'),
  ).toBeVisible();

  // In Sessions, counted
  await page.getByRole('link', { name: 'Sessions' }).first().click();
  await expect(
    page.getByRole('link', { name: 'Mock interview · Technical interview' }),
  ).toBeVisible();
  await expect(page.getByText(/1 mock interview/)).toBeVisible();

  // removeMockSession
  await page
    .getByRole('link', { name: 'Mock interview · Technical interview' })
    .click();
  await page
    .getByRole('button', { name: 'Remove this mock interview' })
    .click();
  await page
    .getByRole('dialog', { name: 'Remove this mock interview?' })
    .getByRole('button', { name: 'Remove the mock interview' })
    .click();
  await expect(page).toHaveURL('/sessions');
  await expect(
    page.getByRole('heading', { name: 'Nothing practised yet' }),
  ).toBeVisible();
});

test('mock interview: nothing heard in a silent answer, then out of time, the closing ends it', async ({
  page,
}) => {
  const account = await openInterview(page);
  const sessionId = await start(page);

  // Silence, sent at once: under 1,000 bytes, the question stays open
  await setMicrophone(page, 0);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('We didn’t hear anything.');
  await answer(page).getByRole('button', { name: 'Answer again' }).click();
  await expect(answer(page)).toContainText('Recording ·');
  await expect(page.getByText(/Question 1 of 4/)).toBeVisible();

  // 9 minutes gone: the next answer gets the closing, and the interview is finished
  await setMicrophone(page, 1);
  await moveMockSessionBack(account.uid, sessionId, 'startedAt', 9);
  await answerNow(page);
  await expect(interviewer(page)).toContainText("We're out of time", {
    timeout: 30_000,
  });
  await expect(
    page.getByRole('heading', { name: 'Interview finished' }),
  ).toBeVisible();
});

test('hints (H1, H2): chosen at the setup and kept by the session, the trigger’s points read for a planned question and for a follow-up', async ({
  page,
}) => {
  await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await setup.getByText('With each question').click();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'fake-warm-up: tell me about your background.',
  );

  // The warm-up's hints, keyed by its plan question: with an empty profile, the fake's advice
  const hints = page.getByRole('region', { name: 'Hints', exact: true });
  await expect(hints.getByRole('listitem')).toHaveCount(3);
  await expect(hints).toContainText('fake-advice');

  // The follow-up's, keyed by its turn, written once it is asked and read again until in
  await answerNow(page);
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
  );
  await expect(hints.getByRole('listitem')).toHaveCount(3);
  await expect(hints).toContainText('fake-advice');

  // The choice is the session's: after a reload, still shown with each question
  page.on('dialog', dialog => void dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Continue the interview' }).click();
  await expect(answer(page)).toContainText('Recording ·');
  await expect(hints.getByRole('listitem')).toHaveCount(3);
  await expect(
    hints.getByRole('button', { name: 'Show hints' }),
  ).not.toBeVisible();
});

test('feedback (F1, F2): each answer’s and how it went, written by the trigger; one asked for again; a question practised from it', async ({
  page,
}) => {
  const account = await openInterview(page);
  const sessionId = await start(page);
  // Two answers: the warm-up, then its follow-up
  await answerNow(page);
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
  );
  await expect(answer(page)).toContainText('Recording ·');
  await answerNow(page);
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible();
  await expect(answer(page)).toContainText('Recording ·');
  await page.getByRole('button', { name: 'End interview' }).click();
  await page
    .getByRole('dialog', { name: 'End the interview?' })
    .getByRole('button', { name: 'End the interview' })
    .click();

  // How it went, once every answer's has settled, read again until in
  const overall = page.getByRole('region', { name: 'How it went' });
  await expect(overall).toContainText('fake-went-well: 2 answers.', {
    timeout: 30_000,
  });
  await expect(overall).toContainText('fake-work-on: say what came of it.');
  await expect(overall).toContainText('fake-reason: it left out the result.');
  await expect(
    overall.getByRole('button', { name: 'Practise it' }),
  ).toBeVisible();

  // The first answer's failed after two tries: "Try again" in Sessions writes it again
  await failMockAnswerFeedback(account.uid, sessionId, 't1');
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  const said = page.getByRole('region', { name: 'What was said' });
  // Each question of what was said; an answer's feedback, once open, has lists of its own
  const first = said.locator('ol > li').nth(0);
  const second = said.locator('ol > li').nth(1);
  await expect(first).toContainText(/Your answer · \d:\d\d spoken/);
  await expect(first).toContainText(
    'We couldn’t prepare feedback on this answer.',
  );
  await first.getByRole('button', { name: 'Try again' }).click();
  await first
    .getByRole('button', { name: 'Show feedback' })
    .click({ timeout: 30_000 });
  await expect(first).toContainText(
    'fake-structure: situation, task, action, result.',
  );
  await expect(first).toContainText('fake-suggestion: say what came of it.');

  // "Practise this question": text practice with the follow-up as first asked, from the mock interview
  await second.getByRole('button', { name: 'Practise this question' }).click();
  await expect(page).toHaveURL(/\/sessions\/[^/]+$/, { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: 'fake-follow-up: what came of it?' }),
  ).toBeVisible();
  await expect(page.getByText('From your mock interview')).toBeVisible();
});

test('real time (slices 3, 4): over the relay, the opening and the question, an answer ended by a pause and written down, a reload continued, the follow-up answered with "I’m done", ended, read in Sessions', async ({
  page,
}) => {
  // Silent until the candidate speaks: the relay's fake hears any sound as speech.
  await page.addInitScript(() => {
    (window as unknown as { qdMicrophoneVolume: number }).qdMicrophoneVolume =
      0;
  });
  await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await setup.getByRole('radio', { name: 'Real time', exact: true }).check();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Start the interview' }).click();

  // The opening and the warm-up, said over the connection
  await expect(interviewer(page)).toContainText(
    'fake-warm-up: tell me about your background.',
    { timeout: 30_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // Speech, the words heard, then 1.5 seconds of silence ends the answer
  await setMicrophone(page, 1);
  await expect(answer(page)).toContainText(/fake-heard: \d+ frames/, {
    timeout: 10_000,
  });
  await setMicrophone(page, 0);
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
    { timeout: 15_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // A reload: "Continue the interview" asks where the relay is (quadev-backend #71), which says
  // the line waiting again
  page.on('dialog', dialog => void dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: 'Continue the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
    { timeout: 15_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // "I'm done" ends the follow-up's answer at once
  await setMicrophone(page, 1);
  await page.waitForTimeout(1_000);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await setMicrophone(page, 0);
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // The end, over the connection
  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible({ timeout: 15_000 });

  // As stored by the relay: the answers written down, the way
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  const said = page.getByRole('region', { name: 'What was said' });
  await expect(said).toContainText(/fake-transcript: \d+ frames of speech\./);
  await expect(page.getByText('Real time', { exact: true })).toBeVisible();
});

test('the voice model (slices 5, website 5): its words after it speaks, an answer it notices and writes down, the follow-up answered with "I’m done", ended, read in Sessions', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { qdMicrophoneVolume: number }).qdMicrophoneVolume =
      0;
  });
  await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await setup.getByRole('radio', { name: 'Real time, voice model' }).check();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('region', { name: 'Your interview' }),
  ).toContainText('The model’s own');
  await page.getByRole('button', { name: 'Start the interview' }).click();

  // The opening with the warm-up in one line, its words once said
  await expect(interviewer(page)).toContainText('fake-warm-up', {
    timeout: 30_000,
  });
  await expect(interviewer(page)).toContainText(/I['’]m an AI interviewer/);
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // Speech, then 1.5 seconds of silence: the model notices, and asks its follow-up
  await setMicrophone(page, 1);
  await page.waitForTimeout(2_000);
  await setMicrophone(page, 0);
  await expect(interviewer(page)).toContainText(
    'fake-follow-up: what came of it?',
    { timeout: 15_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  // "I'm done" tells it to go on: the next planned question
  await setMicrophone(page, 1);
  await page.waitForTimeout(1_000);
  await setMicrophone(page, 0);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(answer(page)).toContainText('Listening ·', { timeout: 15_000 });

  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(
    page.getByRole('region', { name: 'What was said' }),
  ).toContainText(/fake-transcript: \d+ frames of speech\./);
  await expect(
    page.getByText('Real time, voice model', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('The model’s own', { exact: true }),
  ).toBeVisible();
});

test('mock interview: the backend refuses over the day’s 3, and the page says so', async ({
  page,
}) => {
  const account = await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(setup).toContainText('3 of 3 mock interviews left today');
  await setup.getByRole('button', { name: 'Continue' }).click();

  // Used up since the page read the count: only the backend knows
  await setUsageToday(account.uid, 'mockInterview', 3);
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'You’ve started today’s 3 mock interviews, the daily limit.',
  );
});
