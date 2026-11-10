// Mock interviews taken in turns (X6, R2, D100, doc 24): "Practise for this interview" and its
// setup, the Ready page with "Before you start", the interview with a recorded answer and real
// sound (a stand-in microphone, the preview's interviewer voicing each line as a short
// tone), "I'm done", a follow-up, Skip, Pause, a failed send and nothing heard, a blocked
// microphone, the end with the feedback card, and what was said in Sessions. The preview's backend
// plays the backend's part.
import { expect, type Page, test } from '@playwright/test';

import { openApplications, seedApplications } from './support';

/**
 * A microphone for the browser: a tone played into a real audio stream, which the page records
 * as it would a microphone. Chromium's fake devices wait on the system's own microphone
 * permission on a Mac, which a headless run never gets. `refuse` blocks it instead.
 */
const microphone = (page: Page, refuse = false) =>
  page.addInitScript(blocked => {
    navigator.mediaDevices.getUserMedia = async () => {
      if (blocked) {
        throw new DOMException('Blocked', 'NotAllowedError');
      }
      const context = new AudioContext();
      const tone = context.createOscillator();
      const destination = context.createMediaStreamDestination();
      tone.connect(destination);
      tone.start();
      return destination.stream;
    };
  }, refuse);

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

test('a mock interview taken in turns: set up, started, answered, a follow-up, skipped, ended, rated, and read in Sessions', async ({
  page,
}) => {
  await openInterview(page);

  // The setup, from the interview
  await page
    .getByRole('button', { name: 'Practise for this interview' })
    .click();
  const setup = page.getByRole('dialog', { name: 'Mock interview' });
  await expect(setup).toContainText('You’ll take turns');
  await expect(setup).toContainText('3 of 3 mock interviews left today');
  await setup.getByText('20 minutes').click();
  await setup.getByText('Voice 2').click();
  await setup.getByRole('button', { name: 'Continue' }).click();

  // Ready: the choices in short, and the notice before the first one
  await expect(page).toHaveURL(
    /\/interviews\/[^/]+\/mock\?length=20&voice=chirp$/,
  );
  const summary = page.getByRole('region', { name: 'Your interview' });
  await expect(summary).toContainText('About 20 minutes, 6 to 8 questions');
  await expect(summary).toContainText('Voice 2');
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

  // The feedback card
  const feedback = page.getByRole('region', { name: 'How did it go?' });
  await feedback.getByText('4', { exact: true }).click();
  await feedback.getByText('A bit long').click();
  await feedback.getByRole('button', { name: 'Send' }).click();
  await expect(feedback).toContainText('Thank you.');

  // What was said, in Sessions
  await page.getByRole('link', { name: 'See the transcript' }).click();
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

  // A send that failed is sent again, the same answer
  await page.evaluate(() => window.qdPreviewProfile?.failNextMock('model'));
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
