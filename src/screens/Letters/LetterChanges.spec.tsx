// Changing a ready letter (D98, slice 29): a sentence edited, removed and restored; the questions;
// "Change it quickly" and "Write this letter again"; "Edit the whole letter" with "Save my version"
// and "Improve my version"; a saved letter's "Your version"; the draft beside it.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { LetterScreen } from './LetterScreen';

import { type CoverLetter, coverLetterBody } from '@/core/profile/coverLetters';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { coverLetterFixture } from '@/testUtil/coverLetterFixtures';
import {
  cvDetailsFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

/** Where the page is, shown outside its routes: a new letter opens on the same route. */
const Location = () => <p>now at {useLocation().pathname}</p>;

const setUp = (letter: CoverLetter = coverLetterFixture()) => {
  const gateway = createMockProfileGateway();
  gateway.getApplicationLetters.mockResolvedValue([letter]);
  gateway.getCoverLetter.mockResolvedValue(letter);
  gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
  renderCvPage(
    <>
      <Routes>
        <Route
          path="/applications/:applicationId/cv/letters/:letterId"
          element={<LetterScreen />}
        />
      </Routes>
      <Location />
    </>,
    {
      gateway,
      route: '/applications/a1/cv/letters/letter-1',
      flags: { coverLetters: true },
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
        profileRevision: 3,
      },
      cvVersions: {
        uid: 'uid-1',
        status: 'loaded',
        versions: [
          writtenVersionFixture({
            id: 'v1',
            target: { kind: 'job', applicationId: 'a1' },
          }),
        ],
        details: cvDetailsFixture(),
      },
    },
  );
  return { gateway };
};

const sentence = async (index: number) =>
  within(
    await screen.findByRole('article', { name: 'letters.documentLabel' }),
  ).getAllByRole('button', { name: 'letters.sentenceLabel' })[index];

const sentencePanel = () =>
  screen.getByRole('region', { name: 'letters.thisSentence' });

describe('changing a letter (D98, slice 29)', () => {
  it('edits a sentence in the candidate’s words, then removes it', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();

    await user.click(await sentence(1));
    await user.click(
      within(sentencePanel()).getByRole('button', {
        name: 'letters.editSentenceButton',
      }),
    );
    const box = within(sentencePanel()).getByRole('textbox', {
      name: 'letters.editSentenceField',
    });
    expect(box).toHaveValue('I moved the payments ledger to event sourcing.');
    await user.clear(box);
    await user.type(box, 'I rebuilt the ledger around events.');
    await user.click(
      within(sentencePanel()).getByRole('button', {
        name: 'letters.saveSentenceButton',
      }),
    );

    expect(gateway.reviseCoverLetterSentence).toHaveBeenCalledWith(
      'letter-1',
      's2',
      { action: 'edit', text: 'I rebuilt the ledger around events.' },
    );
    expect(gateway.getCoverLetter).toHaveBeenCalledWith('uid-1', 'letter-1');

    await user.click(
      within(sentencePanel()).getByRole('button', {
        name: 'letters.removeSentenceButton',
      }),
    );
    expect(gateway.reviseCoverLetterSentence).toHaveBeenLastCalledWith(
      'letter-1',
      's2',
      { action: 'remove' },
    );
  });

  it('shows a removed sentence struck through, out of the text, with Restore', async () => {
    const user = userEvent.setup();
    const letter = coverLetterFixture();
    const [first, second] = letter.paragraphs?.[0].sentences ?? [];
    const { gateway } = setUp({
      ...letter,
      paragraphs: [
        { sentences: [first, { ...second, state: 'removed' }] },
        ...(letter.paragraphs ?? []).slice(1),
      ],
    });

    // Its label says it is removed
    const removed = within(
      await screen.findByRole('article', { name: 'letters.documentLabel' }),
    ).getByRole('button', { name: 'letters.sentenceLabelRemoved' });
    await user.click(removed);
    await user.click(
      within(sentencePanel()).getByRole('button', {
        name: 'letters.restoreSentenceButton',
      }),
    );

    expect(gateway.reviseCoverLetterSentence).toHaveBeenCalledWith(
      'letter-1',
      's2',
      { action: 'restore' },
    );
  });

  it('answers a question, skips one, and writes the letter again with the answers', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(
      coverLetterFixture({
        questions: [
          { id: 'q1', text: 'Who will read it?', status: 'open' },
          { id: 'q2', text: 'Why Northwind?', status: 'open' },
        ],
      }),
    );
    const questions = await screen.findByRole('region', {
      name: 'letters.questionsTitle',
    });

    const [first] = within(questions).getAllByRole('textbox', {
      name: 'letters.answerField',
    });
    await user.type(first, 'Priya Shah');
    await user.click(
      within(questions).getAllByRole('button', {
        name: 'letters.saveAnswerButton',
      })[0],
    );
    expect(gateway.answerCoverLetterQuestion).toHaveBeenCalledWith(
      'letter-1',
      'q1',
      'Priya Shah',
    );
    await user.click(
      within(questions).getAllByRole('button', { name: 'letters.skipButton' })[
        within(questions).getAllByRole('button', { name: 'letters.skipButton' })
          .length - 1
      ],
    );
    expect(gateway.answerCoverLetterQuestion).toHaveBeenLastCalledWith(
      'letter-1',
      'q2',
      undefined,
    );

    await user.click(
      within(questions).getByRole('button', {
        name: 'letters.writeAgainButton',
      }),
    );
    expect(gateway.rewriteCoverLetter).toHaveBeenCalledWith('letter-1', {});
    expect(
      await screen.findByText('now at /applications/a1/cv/letters/letter-2'),
    ).toBeVisible();
  });

  it('writes it again from a quick change, its line in what is asked, to change first', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(
      coverLetterFixture({ asked: 'Put first: on-call' }),
    );

    await user.click(
      await screen.findByRole('button', { name: 'letters.quickShorter' }),
    );
    const panel = screen.getByRole('dialog', { name: 'letters.againTitle' });
    const asked = within(panel).getByRole('textbox', {
      name: 'letters.askedTitle',
    });
    expect(asked).toHaveValue('Put first: on-call\nletters.quickShorterLine');
    // A chip takes its line out again
    await user.click(
      within(panel).getByRole('button', {
        name: 'letters.quickShorter',
        pressed: true,
      }),
    );
    expect(asked).toHaveValue('Put first: on-call');
    await user.click(
      within(panel).getByRole('button', { name: 'letters.quickWarmer' }),
    );
    await user.click(
      within(panel).getByRole('button', { name: 'letters.writeAgainButton' }),
    );

    expect(gateway.rewriteCoverLetter).toHaveBeenCalledWith('letter-1', {
      asked: 'Put first: on-call\nletters.quickWarmerLine',
    });
    expect(
      await screen.findByText('now at /applications/a1/cv/letters/letter-2'),
    ).toBeVisible();
  });

  it('edits the whole letter: "Save my version" in place, "Improve my version" as a new letter', async () => {
    const user = userEvent.setup();
    const letter = coverLetterFixture();
    const body = coverLetterBody(letter.paragraphs ?? []);
    const { gateway } = setUp(letter);

    await user.click(
      await screen.findByRole('button', { name: 'letters.editAllButton' }),
    );
    const box = screen.getByRole('textbox', { name: 'letters.editAllField' });
    expect(box).toHaveValue(body);
    await user.type(box, ' Thank you.');
    await user.click(
      screen.getByRole('button', { name: 'letters.saveVersionButton' }),
    );
    expect(gateway.saveCoverLetterText).toHaveBeenCalledWith(
      'letter-1',
      `${body} Thank you.`,
    );

    await user.click(
      await screen.findByRole('button', { name: 'letters.editAllButton' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'letters.improveVersionButton' }),
    );
    expect(gateway.rewriteCoverLetter).toHaveBeenCalledWith('letter-1', {
      draft: body,
    });
  });

  it('a saved letter: "Your version", its words with no sources, no quick changes or questions; restored', async () => {
    const user = userEvent.setup();
    const letter = coverLetterFixture();
    const { gateway } = setUp({
      ...letter,
      writtenParagraphs: letter.paragraphs,
      savedAt: Date.parse('2026-10-28T10:00:00Z'),
    });

    expect(
      await screen.findByRole('heading', { name: 'letters.yourVersionTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('letters.editedChip')).toBeInTheDocument();
    expect(
      screen.queryByRole('switch', { name: 'letters.showSources' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'letters.quickTitle' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'letters.questionsTitle' }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole('button', {
        name: 'letters.restoreWrittenLetterButton',
      }),
    );
    expect(gateway.restoreCoverLetterText).toHaveBeenCalledWith('letter-1');
  });

  it('shows the draft beside a letter improved from it, to change and write again', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp(
      coverLetterFixture({
        draft: { text: 'hi, saw the role', mode: 'polish' },
      }),
    );

    // "Show my draft beside it" off, then on again
    await user.click(
      await screen.findByRole('switch', { name: 'letters.showDraft' }),
    );
    expect(
      screen.queryByRole('region', { name: 'letters.draftTitle' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'letters.showDraft' }));

    const draft = screen.getByRole('region', { name: 'letters.draftTitle' });
    expect(draft).toHaveTextContent('hi, saw the role');
    await user.click(
      within(draft).getByRole('button', { name: 'letters.changeDraftButton' }),
    );
    const panel = screen.getByRole('dialog', {
      name: 'letters.draftAgainTitle',
    });
    const box = within(panel).getByRole('textbox', {
      name: 'letters.draftField',
    });
    await user.type(box, ' and it fits me.');
    await user.click(
      within(panel).getByRole('button', { name: 'letters.writeAgainButton' }),
    );

    expect(gateway.rewriteCoverLetter).toHaveBeenCalledWith('letter-1', {
      draft: 'hi, saw the role and it fits me.',
    });
  });
});
