// Mock interviews taken in turns (X6, R2, D100, doc 24): "Practise for this interview" and its
// setup, the Ready page with "Before you start", the interview with a recorded answer and real
// sound (a stand-in microphone, the preview's interviewer voicing each line as a short
// tone), "I'm done", a follow-up, Skip, Pause, a failed send and nothing heard, a blocked
// microphone, the end with the feedback card, what was said in Sessions, the hints (H2) when
// asked for and after the answer, and the feedback on the answers with "How it went" (D101), one
// failed and asked for again, and a question practised from it. The preview's backend plays the
// backend's part.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

/**
 * A microphone for the browser: a tone played into a real audio stream, which the page records
 * as it would a microphone. Chromium's fake devices wait on the system's own microphone
 * permission on a Mac, which a headless run never gets. `refuse` blocks it instead. Its volume
 * (`setMicrophone`) is the candidate speaking or not, for the real-time way; it starts at
 * `window.qdMicrophoneVolume`, else 1.
 */
const microphone = (page: Page, refuse = false) =>
  page.addInitScript(blocked => {
    navigator.mediaDevices.getUserMedia = async () => {
      if (blocked) {
        throw new DOMException('Blocked', 'NotAllowedError');
      }
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
  }, refuse);

/** The candidate speaking (1) or silent (0), on the real-time way. */
const setMicrophone = (page: Page, volume: number) =>
  page.evaluate(level => {
    const known = window as unknown as {
      qdMicrophone?: GainNode;
      qdMicrophoneVolume?: number;
    };
    known.qdMicrophoneVolume = level;
    if (known.qdMicrophone) {
      known.qdMicrophone.gain.value = level;
    }
  }, volume);

test.beforeEach(async ({ page }) => {
  await microphone(page);
});

/** The designs' technical interview, its likely questions written, mock interviews on. */
const openInterview = async (page: Page) => {
  await openApplications(page);
  await page.evaluate(() => {
    window.qdPreview?.setFlag('textPractice', true);
    window.qdPreview?.setFlag('mockInterview', true);
  });
  await seedApplications(page);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const questions = page.getByRole('region', {
    name: 'Likely questions for this interview',
  });
  await questions
    .getByRole('button', { name: 'Write likely questions' })
    .click();
  await expect(questions.getByRole('listitem')).toHaveCount(5);
};

const interviewer = (page: Page) =>
  page.getByRole('region', { name: 'AI interviewer' });
const answer = (page: Page) =>
  page.getByRole('region', { name: 'Your answer' });

/** Set up and started: the opening and the first question played, recording. */
const start = async (page: Page) => {
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  await page
    .getByRole('dialog', { name: 'Mock interview' })
    .getByRole('button', { name: 'Continue' })
    .click();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(answer(page)).toContainText('Recording ·', { timeout: 15_000 });
};

/** A second or so of answer, then "I'm done", and the next line recording. */
const answerNow = async (page: Page) => {
  await page.waitForTimeout(1_200);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('Sending your answer…');
  await expect(answer(page)).toContainText('Recording ·', { timeout: 15_000 });
};

/** "End interview" during an answer, which asks first. */
const endNow = async (page: Page) => {
  await page.getByRole('button', { name: 'End interview' }).click();
  await page
    .getByRole('dialog', { name: 'End the interview?' })
    .getByRole('button', { name: 'End the interview' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible();
};

test('a mock interview taken in turns: set up, started, answered, a follow-up, skipped, ended, rated, and read in Sessions', async ({
  page,
}) => {
  await openInterview(page);

  // The setup, from the interview
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(setup.getByRole('radio', { name: 'Take turns' })).toBeChecked();
  await expect(setup).toContainText('3 of 3 mock interviews left today');
  await setup.getByText('20 minutes').click();
  await setup.getByText('Voice 2').click();
  await setup.getByRole('button', { name: 'Continue' }).click();

  // Ready: the choices in short, and the notice before the first one
  await expect(page).toHaveURL(
    /\/interviews\/[^/]+\/mock\?length=20&voice=chirp&hints=on-request&way=take-turns$/,
  );
  const summary = page.getByRole('region', { name: 'Your interview' });
  await expect(summary).toContainText('About 20 minutes, 6 to 8 questions');
  await expect(summary).toContainText('Voice 2');
  await expect(summary).toContainText('When you ask');
  await expect(
    page.getByRole('region', { name: 'Before you start' }),
  ).toContainText('The audio is never kept.');

  // Started: the opening, then the first question, then the answer records by itself
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'Tell me about an incident you led from alert to fix.',
    { timeout: 15_000 },
  );
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });
  await expect(page).toHaveURL(/\/mock\/[^/?]+$/);
  await expect(page.getByText(/Question 1 of 6 · \d+ min left/)).toBeVisible();

  // "I'm done": the interviewer thinks, then asks a follow-up, which keeps the question's number
  await page.waitForTimeout(1_200);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('Sending your answer…');
  await expect(interviewer(page)).toContainText(
    'What was your own part in it',
    { timeout: 10_000 },
  );
  await expect(
    interviewer(page).getByText('Follow-up', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText(/Question 1 of 6/)).toBeVisible();
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });

  // Skip: the next planned question
  await interviewer(page).getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/Question 2 of 6/)).toBeVisible({
    timeout: 10_000,
  });
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });

  // "End interview" during an answer asks first
  await page.getByRole('button', { name: 'End interview' }).click();
  const ending = page.getByRole('dialog', { name: 'End the interview?' });
  await expect(ending).toContainText('hasn’t been sent');
  await ending.getByRole('button', { name: 'End the interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible();

  // One answer: no overall view, its feedback in Sessions
  await expect(page.getByRole('region', { name: 'How it went' })).toContainText(
    'An overall view needs at least 2 answers.',
  );

  // The feedback card
  const feedback = page.getByRole('region', { name: 'How did it go?' });
  await feedback.getByText('4', { exact: true }).click();
  await feedback.getByText('A bit long').click();
  await feedback.getByRole('button', { name: 'Send' }).click();
  await expect(feedback).toContainText('Thank you.');

  // What was said, in Sessions
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(page).toHaveURL(/\/sessions\/mock\/[^/]+$/);
  const said = page.getByRole('region', { name: 'What was said' });
  await expect(said).toContainText(
    'Tell me about an incident you led from alert to fix.',
  );
  await expect(said).toContainText(/I answered for about \d+ seconds\./);
  await expect(said).toContainText('Skipped');
  await expect(
    page.getByText('4 of 5 · the wait was a bit long'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Sessions' }).first().click();
  await expect(
    page.getByRole('link', { name: 'Mock interview · Technical interview' }),
  ).toBeVisible();
  await expect(page.getByText(/1 mock interview/)).toBeVisible();
});

test('nothing heard, a failed send sent again, and a pause with the same answer kept', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);

  // Nothing heard: the question stays open, and the answer starts again
  await page.evaluate(() =>
    window.qdPreviewProfile?.failNextMock('nothing-heard'),
  );
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('We didn’t hear anything.', {
    timeout: 10_000,
  });
  await answer(page).getByRole('button', { name: 'Answer again' }).click();
  await expect(answer(page)).toContainText('Recording ·');

  // A send that failed is sent again, the same answer: a second of it, as an empty recording
  // is nothing heard without asking the backend
  await page.evaluate(() => window.qdPreviewProfile?.failNextMock('model'));
  await page.waitForTimeout(1_200);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('We couldn’t send your answer.', {
    timeout: 10_000,
  });
  await answer(page).getByRole('button', { name: 'Send again' }).click();
  await expect(interviewer(page)).toContainText(
    'What was your own part in it',
    { timeout: 10_000 },
  );
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });

  // Paused: the clock stops; the same answer goes on
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('heading', { name: 'Paused' })).toBeVisible();
  await expect(answer(page)).toContainText('Recording paused');
  await page.getByRole('button', { name: 'Continue answering' }).click();
  await expect(answer(page)).toContainText('Recording ·');
});

test('a reload during the interview continues it; a finished one ends with "Interview finished"', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);
  const address = page.url();
  expect(address).toMatch(/\/mock\/[^/?]+$/);

  // Back after a reload: the question again, after a press
  page.on('dialog', dialog => void dialog.accept());
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Continue the interview' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Continue the interview' }).click();
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });

  // Skipped to the end: 4 questions for 10 minutes, and the closing
  for (let question = 0; question < 4; question += 1) {
    await interviewer(page).getByRole('button', { name: 'Skip' }).click();
    await expect(
      answer(page)
        .getByText('Recording ·', { exact: false })
        .or(page.getByRole('heading', { name: 'Interview finished' })),
    ).toBeVisible({ timeout: 10_000 });
  }
  await expect(
    page.getByRole('heading', { name: 'Interview finished' }),
  ).toBeVisible({ timeout: 10_000 });
});

const hints = (page: Page) =>
  page.getByRole('region', { name: 'Hints', exact: true });

test('hints when I ask (H2): beside the interview, shown for this question, on their way for a follow-up', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);

  // Beside the answer at 1280, under it on a phone
  const column = await hints(page).boundingBox();
  const yours = await answer(page).boundingBox();
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    expect(column!.x).toBeGreaterThan(yours!.x + yours!.width - 1);
  } else {
    expect(column!.y).toBeGreaterThan(yours!.y + yours!.height - 1);
  }

  // Hidden until asked, then this question's points
  await expect(hints(page)).toContainText('Hidden until you ask');
  await hints(page).getByRole('button', { name: 'Show hints' }).click();
  await expect(hints(page).getByRole('listitem').first()).toBeVisible();
  await expect(hints(page)).toContainText('Advice');

  // A follow-up: hidden again, then on their way, then in
  await page.waitForTimeout(1_200);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(interviewer(page)).toContainText(
    'What was your own part in it',
    { timeout: 10_000 },
  );
  await expect(hints(page)).toContainText('Hidden until you ask');
  await hints(page).getByRole('button', { name: 'Show hints' }).click();
  await expect(hints(page)).toContainText(
    'Hints for this follow-up are on their way.',
  );
  await expect(hints(page).getByRole('listitem').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('hints after I answer (H2): hidden while answering, the answered question’s until the next answer, and none when they failed', async ({
  page,
}) => {
  await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await setup.getByText('After I answer').click();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('region', { name: 'Your interview' }),
  ).toContainText('After you answer');
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(answer(page)).toContainText('Recording ·', { timeout: 15_000 });

  await expect(hints(page)).toContainText('Shown once you’ve answered');
  await page.waitForTimeout(1_200);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  // The answered question's points, through the follow-up being asked
  await expect(
    hints(page).getByText('For the question you just answered'),
  ).toBeVisible();
  await expect(hints(page).getByRole('listitem').first()).toBeVisible();
  // The follow-up's answer starts: its own hints, hidden again
  await expect(answer(page)).toContainText('Recording ·', { timeout: 10_000 });
  await expect(hints(page)).toContainText('Shown once you’ve answered');

  // The next question's hints failed: "Show them now" says so
  await page.evaluate(() => window.qdPreviewProfile?.failNextHints());
  await interviewer(page).getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/Question 2 of/)).toBeVisible({
    timeout: 10_000,
  });
  await hints(page).getByRole('button', { name: 'Show them now' }).click();
  await expect(hints(page)).toContainText(
    'No hints for this question this time.',
  );
});

test('feedback after the end (D101): how it went on its way then ready, each answer’s in Sessions, and a question practised from it', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);
  await answerNow(page);
  await answerNow(page);
  await endNow(page);

  // The end page: "How it went" on its way, then ready, above the testers' card
  const overall = page.getByRole('region', { name: 'How it went' });
  await expect(overall).toContainText(
    /Preparing your feedback · \d of 2 answers ready/,
  );
  await expect(overall).toContainText('It takes about a minute.');
  await expect(overall).toContainText('What went well', { timeout: 20_000 });
  await expect(overall).toContainText('What to work on');
  await expect(overall).toContainText('Worth practising again');
  await expect(overall).toContainText('Never on your voice or tone.');
  await expect(
    overall.getByRole('button', { name: 'Practise it' }),
  ).toBeVisible();

  // In Sessions: how it went at the top, each answer with its length and its feedback
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(page.getByRole('region', { name: 'How it went' })).toContainText(
    'What went well',
  );
  const said = page.getByRole('region', { name: 'What was said' });
  await expect(said).not.toContainText('Feedback on each answer comes later.');
  const first = said.getByRole('listitem').first();
  await expect(first).toContainText(/Your answer · 0:0\d spoken/);
  await first.getByRole('button', { name: 'Show feedback' }).click();
  await expect(first).toContainText('Try this next time');
  await first.getByRole('button', { name: 'Hide feedback' }).click();
  await expect(first).not.toContainText('Try this next time');

  // "Practise this question": text practice with the question, from the mock interview
  await first.getByRole('button', { name: 'Practise this question' }).click();
  await expect(page).toHaveURL(/\/sessions\/[^/]+$/, { timeout: 15_000 });
  await expect(page.getByText('From your mock interview')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Tell me about an incident you led from alert to fix.',
    }),
  ).toBeVisible();
});

test('an answer’s feedback that failed is asked for again in Sessions; one answer has no overall view', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);
  await page.evaluate(() =>
    window.qdPreviewProfile?.failNextFeedback('answer', 'failed'),
  );
  await answerNow(page);
  await endNow(page);

  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(page.getByRole('region', { name: 'How it went' })).toContainText(
    'An overall view needs at least 2 answers. Your answer’s feedback is under it',
  );
  const first = page
    .getByRole('region', { name: 'What was said' })
    .getByRole('listitem')
    .first();
  await expect(first).toContainText(
    'We couldn’t prepare feedback on this answer.',
  );
  await first.getByRole('button', { name: 'Try again' }).click();
  await expect(first).toContainText('Preparing feedback on this answer…');
  await expect(
    first.getByRole('button', { name: 'Show feedback' }),
  ).toBeVisible({ timeout: 15_000 });
});

test('real time (doc 24 §16): set up, the opening and the question, an answer ended by a pause, "I’m done" with nothing heard, a lost connection, another tab, skipped and ended', async ({
  page,
}) => {
  // Silent until the candidate speaks: any sound would interrupt the interviewer.
  await page.addInitScript(() => {
    (window as unknown as { qdMicrophoneVolume: number }).qdMicrophoneVolume =
      0;
  });
  await openInterview(page);

  // The setup: real time
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(
    setup.getByRole('group', { name: 'How you’ll talk' }),
  ).toContainText(
    'Like a call: it notices when you’ve finished, and you can interrupt it.',
  );
  await setup.getByRole('radio', { name: 'Real time', exact: true }).check();
  await setup.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/&way=real-time$/);
  await expect(
    page.getByRole('region', { name: 'Your interview' }),
  ).toContainText('Real time');
  await expect(page.getByText('Use headphones if you can.')).toBeVisible();

  // Started: the opening and the question over the connection, then your turn
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'Tell me about an incident you led from alert to fix.',
    { timeout: 15_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });
  await expect(page).toHaveURL(/\/mock\/[^/?]+$/);
  await expect(
    interviewer(page).getByRole('button', { name: 'Repeat' }),
  ).toHaveCount(0);

  // An answer: two seconds of speech, the words heard, then a pause ends it
  await setMicrophone(page, 1);
  await expect(answer(page)).toContainText('I answered for about', {
    timeout: 5_000,
  });
  await page.waitForTimeout(1_000);
  await setMicrophone(page, 0);
  await expect(interviewer(page)).toContainText(
    'What was your own part in it',
    { timeout: 10_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });

  // "I'm done" with nothing heard: still listening
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(answer(page)).toContainText('We didn’t hear anything yet.');

  // The connection lost: reconnecting, then the question said again
  await page.evaluate(() => window.qdPreviewProfile?.dropLiveConnection(2));
  await expect(page.getByText('Reconnecting…')).toBeVisible();
  await expect(page.getByText('Reconnecting…')).toBeHidden({ timeout: 15_000 });
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });

  // Taken over in another tab: "Continue here" takes it back
  await page.evaluate(() => window.qdPreviewProfile?.replaceLiveConnection());
  const replaced = page.getByRole('alert').filter({
    hasText: 'This interview is open in another tab',
  });
  await expect(replaced).toContainText('the other one then stops');
  await replaced.getByRole('button', { name: 'Continue here' }).click();
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });

  // Skip, then the end, with the card's third question
  await interviewer(page).getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText(/Question 2 of 4/)).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page
      .getByRole('region', { name: 'How did it go?' })
      .getByText('Did the interviewer cut you off, or hear itself?'),
  ).toBeVisible();

  // In Sessions: the way
  await page
    .getByRole('link', { name: 'See your answers and feedback' })
    .click();
  await expect(page.getByText('Real time', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'What was said' }),
  ).toContainText(/I answered for about \d+ seconds\./);
});

test('the voice model (doc 24 §16): no voice to choose, its words after it speaks, an answer it notices, cut off within its first word, ended', async ({
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
  await expect(setup).toContainText(
    'The voice model speaks in its own voice, so there’s no choice of voice.',
  );
  await expect(setup.getByRole('radio', { name: 'Voice 2' })).toHaveCount(0);
  await setup.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/&way=voice-model$/);
  await expect(
    page.getByRole('region', { name: 'Your interview' }),
  ).toContainText('The model’s own');

  // The opening asks the first question; its words come once it has said them
  await page.getByRole('button', { name: 'Start the interview' }).click();
  await expect(interviewer(page)).toContainText(
    'Its words appear here when it finishes speaking.',
    { timeout: 15_000 },
  );
  await expect(interviewer(page)).toContainText(
    'Tell me about an incident you led from alert to fix.',
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });

  // An answer it notices: speech, then silence; the follow-up's words after it
  await setMicrophone(page, 1);
  await page.waitForTimeout(2_000);
  await setMicrophone(page, 0);
  await expect(interviewer(page)).toContainText(
    'What was your own part in it',
    { timeout: 10_000 },
  );
  await expect(answer(page)).toContainText('Listening ·', { timeout: 10_000 });

  // "I'm done" while still speaking: the next line is spoken over at once, cut off within its
  // first word, so no words come for it
  await setMicrophone(page, 1);
  await page.waitForTimeout(1_000);
  await answer(page).getByRole('button', { name: 'I’m done' }).click();
  await expect(interviewer(page)).toContainText(
    'The interviewer stopped when you started speaking.',
    { timeout: 10_000 },
  );
  await expect(answer(page)).toContainText('Listening ·');
  await setMicrophone(page, 0);

  await page.getByRole('button', { name: 'End interview' }).click();
  await expect(
    page.getByRole('heading', { name: 'Interview ended' }),
  ).toBeVisible({ timeout: 10_000 });
  await expect(
    page
      .getByRole('region', { name: 'How did it go?' })
      .getByText('Did the interviewer cut you off, or hear itself?'),
  ).toBeVisible();
});

test('where the job is (doc 24 §19): the interview’s page, the Interviews tab and the application’s Sessions tab', async ({
  page,
}) => {
  await openInterview(page);
  await start(page);
  await answerNow(page);
  await endNow(page);

  // Back on the interview: "Your mock interviews", opening its page in Sessions
  await page.getByRole('link', { name: 'Applications', exact: true }).click();
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Senior Backend Engineer' })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('link', { name: 'Interviews' }).click();
  await page.getByRole('link', { name: 'Technical interview' }).click();
  const mocks = page.getByRole('region', { name: 'Your mock interviews' });
  await expect(mocks).toContainText('Take turns · 1 minute');
  await expect(mocks).toContainText(/1 question/);
  await expect(
    mocks.getByText(/Feedback ready|Preparing feedback/),
  ).toBeVisible();

  // The Interviews tab: a chip
  // The way back: the breadcrumb at 1280, its back link on a phone.
  await page.locator('main a[href$="/interviews"]:visible').first().click();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Technical interview' }),
  ).toContainText('1 mock interview');

  // The application's Sessions tab: the mock interview named by its interview
  await page
    .getByRole('navigation', { name: 'Application' })
    .getByRole('link', { name: 'Sessions' })
    .click();
  await expect(page).toHaveURL(/\/applications\/[^/]+\/sessions$/);
  const tab = page.getByRole('region', { name: 'Mock interviews · 1' });
  await expect(tab).toContainText('Technical interview');
  await expect(tab).toContainText('Take turns · 1 minute');
  await tab.getByRole('link', { name: 'Technical interview' }).click();
  await expect(page).toHaveURL(/\/sessions\/mock\/[^/]+$/);
});

test('none left today: the setup says so and can’t continue', async ({
  page,
}) => {
  await openInterview(page);
  await page.evaluate(() => window.qdPreviewProfile?.setMockToday(3));
  await page.reload();
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(setup).toContainText('0 of 3 mock interviews left today');
  await expect(setup.getByRole('alert')).toContainText(
    'You’ve started today’s 3 mock interviews',
  );
  await expect(setup.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test('a blocked microphone says how to allow it again', async ({ page }) => {
  await microphone(page, true);
  await openInterview(page);
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  await page
    .getByRole('dialog', { name: 'Mock interview' })
    .getByRole('button', { name: 'Continue' })
    .click();
  await page.getByRole('button', { name: 'Start the interview' }).click();
  const blocked = page.getByRole('alert');
  await expect(blocked).toContainText('Your browser blocked the microphone');
  await expect(blocked).toContainText('In Safari');
  await expect(
    blocked.getByRole('button', { name: 'Try again' }),
  ).toBeVisible();
});
