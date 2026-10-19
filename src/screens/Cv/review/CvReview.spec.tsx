import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CvReview } from './CvReview';

import { type CvEditVersion } from '@/core/profile/cvVersions';
import { CV_TEXT, cvVersionFixture } from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const RECON =
  'Built reconciliation service for card transactions, approx. 2M/day.';

/** A version with a rewrite, a line added from an item, a removal and a question. */
const full = (overrides: Partial<CvEditVersion> = {}) =>
  cvVersionFixture({
    findings: [
      {
        kind: 'structure',
        severity: 'low',
        passage: '',
        text: 'The dates show the year only.',
      },
      {
        kind: 'results',
        severity: 'high',
        passage: 'Responsible for various API tasks.',
        text: 'Says what you were responsible for, not what came of it.',
      },
    ],
    unsupportedJobTerms: ['running Kafka at scale'],
    changes: [
      {
        id: 'c1',
        action: 'rewrite',
        original: RECON,
        after: '',
        proposed:
          'Built the reconciliation service for two million card transactions a day.',
        reason: 'Reads as a full sentence.',
        sources: [{ kind: 'cv' }],
        decision: 'open',
      },
      {
        id: 'c2',
        action: 'add',
        original: '',
        after: RECON,
        proposed: 'Cut payment incidents by 40% in two quarters.',
        reason: 'Your profile shows it.',
        sources: [{ kind: 'item', itemId: 'i1' }],
        decision: 'open',
      },
      {
        id: 'c3',
        action: 'remove',
        original: 'Responsible for various API tasks.',
        after: '',
        proposed: '',
        reason: 'Says nothing a reader can check.',
        sources: [],
        decision: 'open',
      },
    ],
    ...overrides,
  });

const setUp = (
  version: CvEditVersion,
  gateway = createMockProfileGateway(),
) => {
  gateway.getItems.mockResolvedValue([itemFixture()]);
  gateway.getCvVersion.mockResolvedValue(version);
  return renderCvPage(
    <CvReview
      version={version}
      cvTitle="Maya Okafor CV 2026"
      fileTitle="Senior Backend Engineer - CV - 14 Oct 2026"
    />,
    {
      gateway,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [resourceFixture({ textAt: 1_500 })],
      },
      cvVersions: { uid: 'uid-1', status: 'loaded', versions: [version] },
    },
  );
};

describe('CvReview', () => {
  it('shows how far the review is, what we found (most serious first) and the job’s missing terms', () => {
    setUp(full());

    expect(screen.getByText('cv.reviewedProgress')).toBeInTheDocument();
    const found = screen.getByRole('region', { name: 'cv.findingsTitle' });
    const chips = within(found).getAllByText(/cv\.severity_/);
    expect(chips.map(chip => chip.textContent)).toEqual([
      'cv.severity_high',
      'cv.severity_low',
    ]);
    expect(
      screen.getByRole('region', { name: 'cv.termsTitle' }),
    ).toHaveTextContent('running Kafka at scale');
  });

  it('marks each change in the CV where it applies, and the open question where its line would go', () => {
    setUp(full());

    const cv = screen.getByRole('article', { name: 'cv.yourCvTitle' });
    expect(cv).toHaveTextContent('cv.markChange');
    expect(cv).toHaveTextContent(
      'Cut payment incidents by 40% in two quarters.',
    );
    expect(cv).toHaveTextContent('cv.markRemoves');
    expect(cv).toHaveTextContent('cv.questionInCv');
  });

  it('shows the CV as it would be downloaded with "Show changes" off', async () => {
    setUp(full());

    await userEvent.click(
      screen.getByRole('switch', { name: 'cv.showChanges' }),
    );

    const cv = screen.getByRole('article', { name: 'cv.yourCvTitle' });
    // Nothing accepted yet: the CV as it was, without marks.
    expect(cv).toHaveTextContent(RECON);
    expect(cv).not.toHaveTextContent('cv.markChange');
    expect(cv.textContent).toBe(CV_TEXT);
  });

  it('opens the first open change, and accepts it', async () => {
    const gateway = createMockProfileGateway();
    setUp(full(), gateway);

    const aside = screen.getByRole('complementary', {
      name: 'cv.changesAside',
    });
    expect(within(aside).getByText('cv.yourLine')).toBeInTheDocument();
    expect(within(aside).getByText(/cv.sourceCv/)).toBeInTheDocument();
    await userEvent.click(
      within(aside).getByRole('button', { name: 'cv.acceptButton' }),
    );

    expect(gateway.decideCvChange).toHaveBeenCalledExactlyOnceWith(
      'v1',
      'c1',
      'accept',
      undefined,
    );
    expect(gateway.getCvVersion).toHaveBeenCalledWith('uid-1', 'v1');
  });

  it('edits a line in the candidate’s words', async () => {
    const gateway = createMockProfileGateway();
    setUp(full(), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.editButton' }),
    );
    const wording = screen.getByRole('textbox', { name: 'cv.yourWording' });
    await userEvent.clear(wording);
    await userEvent.type(wording, 'Built and ran the reconciliation service.');
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.saveWordingButton' }),
    );

    expect(gateway.decideCvChange).toHaveBeenCalledExactlyOnceWith(
      'v1',
      'c1',
      'edit',
      'Built and ran the reconciliation service.',
    );
  });

  it('opens a line added from the profile with where it says this, and keeps the CV as it was', async () => {
    const gateway = createMockProfileGateway();
    setUp(full(), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: /Cut payment incidents/ }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /cv.sourceItem/ }),
    );
    expect(
      screen.getByText('Reduced Sev-1 and Sev-2 payment incidents 40%.'),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.keepButton' }),
    );

    expect(gateway.decideCvChange).toHaveBeenCalledExactlyOnceWith(
      'v1',
      'c2',
      'keep',
      undefined,
    );
  });

  it('offers no "Edit" on a removed line', async () => {
    setUp(full());

    await userEvent.click(
      screen.getByRole('button', { name: /Responsible for various API tasks/ }),
    );

    expect(
      screen.queryByRole('button', { name: 'cv.editButton' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'cv.acceptButton' }),
    ).toBeInTheDocument();
  });

  it('answers a question in the candidate’s words, or skips it', async () => {
    const gateway = createMockProfileGateway();
    setUp(full(), gateway);

    await userEvent.click(
      screen.getByRole('radio', { name: 'cv.tabQuestions' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /What did these tasks lead to/ }),
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'cv.yourAnswer' }),
      'Moved 14 teams to the new API.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.useAnswerButton' }),
    );
    expect(gateway.answerCvQuestion).toHaveBeenCalledWith(
      'v1',
      'q1',
      'Moved 14 teams to the new API.',
    );

    // Saved: the answer can be changed, or the question skipped after all
    await userEvent.click(
      await screen.findByRole('button', { name: 'cv.changeAnswerButton' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.skipButton' }),
    );
    expect(gateway.answerCvQuestion).toHaveBeenLastCalledWith(
      'v1',
      'q1',
      undefined,
    );
  });

  it('says when a decision could not be saved', async () => {
    const gateway = createMockProfileGateway();
    gateway.decideCvChange.mockRejectedValue(new Error('offline'));
    setUp(full(), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.acceptButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cv.decideFailedMessage',
    );
  });

  it('says the version is ready once nothing is open, and marks it as the one sent', async () => {
    const gateway = createMockProfileGateway();
    const decided = full();
    decided.changes = decided.changes.map(change => ({
      ...change,
      decision: 'accepted' as const,
    }));
    decided.questions = decided.questions.map(question => ({
      ...question,
      status: 'skipped' as const,
    }));
    setUp(decided, gateway);

    expect(
      screen.getByRole('heading', { name: 'cv.readyTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('cv.readySummary')).toBeInTheDocument();
    expect(screen.queryByText('cv.reviewedProgress')).not.toBeInTheDocument();
    // The Done tab: each decision can be changed again
    expect(screen.getByRole('radio', { name: 'cv.tabDone' })).toBeChecked();
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.markSentButton' }),
    );

    expect(gateway.markCvVersionSent).toHaveBeenCalledExactlyOnceWith(
      'v1',
      true,
    );
  });

  it('shows a version sent as sent, which can be unmarked', async () => {
    const gateway = createMockProfileGateway();
    setUp(
      full({
        changes: [],
        questions: [],
        sentAt: Date.parse('2026-10-15T09:00:00Z'),
      }),
      gateway,
    );

    expect(screen.getByText('cv.sentChip')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.unmarkSentButton' }),
    );
    expect(gateway.markCvVersionSent).toHaveBeenCalledExactlyOnceWith(
      'v1',
      false,
    );
  });

  it('asks nothing about sending a general version', () => {
    setUp(full({ target: { kind: 'general' }, changes: [], questions: [] }));

    expect(screen.queryByText('cv.sentTitle')).not.toBeInTheDocument();
  });
});
