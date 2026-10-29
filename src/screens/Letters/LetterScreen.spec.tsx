import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { LetterScreen } from './LetterScreen';

import { type CoverLetter } from '@/core/profile/coverLetters';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { coverLetterFixture, NOTICE } from '@/testUtil/coverLetterFixtures';
import {
  cvDetailsFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Elsewhere = () => <p>at {useLocation().pathname}</p>;

const setUp = (
  letter: CoverLetter | null = coverLetterFixture(),
  gateway = createMockProfileGateway(),
) => {
  gateway.getApplicationLetters.mockResolvedValue(letter ? [letter] : []);
  gateway.getCoverLetter.mockResolvedValue(letter);
  gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'item-1', resourceId: 'r1' }),
  ]);
  renderCvPage(
    <Routes>
      <Route
        path="/applications/:applicationId/cv/letters/:letterId"
        element={<LetterScreen />}
      />
      <Route path="*" element={<Elsewhere />} />
    </Routes>,
    {
      gateway,
      route: '/applications/a1/cv/letters/letter-1',
      flags: { coverLetters: true },
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [
          resourceFixture({ id: 'r1', title: 'Maya Okafor CV 2026' }),
        ],
      },
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

const letterDocument = () =>
  screen.findByRole('article', { name: 'letters.documentLabel' });

describe('a cover letter (D98)', () => {
  it('shows the letter as it copies, with its heading from the CV details, its sources and its marks', async () => {
    setUp();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'letters.pageTitleCompany',
      }),
    ).toBeInTheDocument();
    const letter = await letterDocument();
    expect(letter).toHaveTextContent('Maya Okafor');
    expect(letter).toHaveTextContent('Hiring Manager, Northwind Logistics');
    expect(letter).toHaveTextContent('Senior Backend Engineer (ref. NW-2231)');
    expect(letter).toHaveTextContent('Dear Hiring Manager,');
    expect(letter).toHaveTextContent('Yours sincerely,');
    // "four weeks" only the draft gives: marked, with its line
    expect(within(letter).getByText('four weeks').tagName).toBe('MARK');
    expect(
      within(letter).getByText('letters.draftOnlyLine'),
    ).toBeInTheDocument();
    expect(
      within(letter).getAllByText('letters.paragraphSources'),
    ).toHaveLength(2);
    expect(within(letter).getByText('letters.framesOnly')).toBeInTheDocument();

    // Sources off: the paragraphs' lines go, the mark's line stays
    await userEvent.click(
      screen.getByRole('switch', { name: 'letters.showSources' }),
    );
    expect(
      within(letter).queryByText('letters.paragraphSources'),
    ).not.toBeInTheDocument();
    expect(
      within(letter).getByText('letters.draftOnlyLine'),
    ).toBeInTheDocument();
  });

  it('opens a sentence with where it says this: the profile’s item, the CV it goes with, the candidate’s words, the posting', async () => {
    setUp();

    await userEvent.click(
      within(await letterDocument()).getAllByRole('button', {
        name: 'letters.sentenceLabel',
      })[0],
    );
    // The first sentence frames the letter
    const frame = screen.getByRole('region', { name: 'letters.thisSentence' });
    expect(frame).toHaveTextContent('letters.frameNoFacts');

    const sentences = within(await letterDocument()).getAllByRole('button', {
      name: 'letters.sentenceLabel',
    });
    await userEvent.click(sentences[1]);
    let panel = screen.getByRole('region', { name: 'letters.thisSentence' });
    expect(
      await within(panel).findByText('Maya Okafor CV 2026'),
    ).toBeInTheDocument();
    expect(within(panel).getByText('letters.cvTitle')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: 'letters.openCvLink' }),
    ).toHaveAttribute('href', '/applications/a1/cv/versions/v1');

    await userEvent.click(sentences[2]);
    panel = screen.getByRole('region', { name: 'letters.thisSentence' });
    expect(within(panel).getByText('letters.whyTitle')).toBeInTheDocument();
    expect(within(panel).getByText('letters.jobTitle')).toBeInTheDocument();
    expect(within(panel).getByText('Two million parcels a day.')).toBeVisible();
  });

  it('says the job posting without a passage, with the way to its text in Details', async () => {
    setUp(
      coverLetterFixture({
        paragraphs: [
          {
            sentences: [
              {
                id: 's1',
                text: 'Your team runs parcel tracking.',
                kind: 'fact',
                sources: [{ kind: 'job' }],
                state: 'written',
                proposed: 'Your team runs parcel tracking.',
              },
            ],
          },
        ],
      }),
    );

    await userEvent.click(
      within(await letterDocument()).getByRole('button', {
        name: 'letters.sentenceLabel',
      }),
    );

    const panel = screen.getByRole('region', { name: 'letters.thisSentence' });
    expect(within(panel).getByText('letters.jobNoQuote')).toBeInTheDocument();
    expect(
      within(panel).getByRole('link', { name: 'letters.openDetailsLink' }),
    ).toHaveAttribute('href', '/applications/a1/details');
  });

  it('copies the text, with no mark in it, and marks it as sent', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    const { gateway } = setUp();

    await user.click(
      await screen.findByRole('button', { name: 'letters.copyButton' }),
    );

    expect(writeText).toHaveBeenCalledOnce();
    const [text] = writeText.mock.calls[0];
    expect(text).toContain('Dear Hiring Manager,');
    expect(text).toContain(NOTICE);
    expect(
      await screen.findByRole('button', { name: 'letters.copiedButton' }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'letters.markButton' }),
    );
    expect(gateway.markCoverLetterSent).toHaveBeenCalledWith('letter-1', true);
    await waitFor(() =>
      expect(gateway.getApplicationLetters).toHaveBeenCalledTimes(2),
    );
  });

  it('shows a form’s box as plain text with its counter, to copy only', async () => {
    setUp(coverLetterFixture({ length: { kind: 'box', maxChars: 1500 } }));

    const letter = await letterDocument();
    expect(letter).not.toHaveTextContent('Maya Okafor ·');
    expect(screen.getByText('letters.boxCounter')).toBeInTheDocument();
    expect(screen.getByText('letters.copyBoxTitle')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'cv.downloadPdfButton' }),
    ).not.toBeInTheDocument();
  });

  it('says it is being written', async () => {
    setUp(coverLetterFixture({ status: 'creating', paragraphs: undefined }));

    expect(
      await screen.findByRole('heading', { name: 'letters.writingTitle' }),
    ).toBeInTheDocument();
  });

  it('says why it could not be written, and tries again with the same settings, the failed one removed', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.createCoverLetter.mockResolvedValue({ letterId: 'letter-2' });
    setUp(
      coverLetterFixture({
        status: 'failed',
        failure: 'model',
        paragraphs: undefined,
        addressee: 'Priya Shah',
        asked: 'Put first: on-call',
        length: { kind: 'short' },
      }),
      gateway,
    );

    expect(await screen.findByText('letters.failedModel')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'letters.tryAgainButton' }),
    );

    expect(gateway.createCoverLetter).toHaveBeenCalledWith({
      applicationId: 'a1',
      cvVersionId: 'v1',
      convention: 'uk',
      length: { kind: 'short' },
      addressee: 'Priya Shah',
      why: 'Tracking parcels is like matching payments.',
      asked: 'Put first: on-call',
    });
    expect(gateway.removeCoverLetter).toHaveBeenCalledWith('letter-1');
  });

  it('removes it after asking, and goes back to the tab', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();

    await user.click(
      await screen.findByRole('button', { name: 'letters.removeLink' }),
    );
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'letters.removeDialogTitle' }),
      ).getByRole('button', { name: 'letters.removeConfirmButton' }),
    );

    expect(gateway.removeCoverLetter).toHaveBeenCalledWith('letter-1');
    expect(await screen.findByText('at /applications/a1/cv')).toBeVisible();
  });

  it('says a letter that is gone isn’t here any more, with the way back', async () => {
    setUp(null);

    expect(
      await screen.findByRole('heading', { name: 'letters.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'letters.notFoundLink' }),
    ).toHaveAttribute('href', '/applications/a1/cv');
  });
});
