import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WrittenReview } from './WrittenReview';

import { type CvDocument } from '@/core/profile/cvDocument';
import { type CvWrittenVersion } from '@/core/profile/cvVersions';
import {
  cvDetailsFixture,
  writtenDocumentFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const setUp = (
  version: CvWrittenVersion & { document: CvDocument },
  writtenAgainDay?: string,
) => {
  const gateway = createMockProfileGateway();
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'i1', resourceId: 'r1' }),
  ]);
  gateway.getCvDetails.mockResolvedValue(cvDetailsFixture());
  renderCvPage(
    <WrittenReview
      version={version}
      fileTitle="Senior Backend Engineer - CV - 15 Oct 2026"
      writtenAgainDay={writtenAgainDay}
    />,
    {
      gateway,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [resourceFixture()],
      },
      cvVersions: {
        uid: 'uid-1',
        status: 'loaded',
        versions: [version],
        detailsStatus: 'loaded',
        details: cvDetailsFixture(),
      },
    },
  );
  return gateway;
};

const ready = (overrides: Partial<CvWrittenVersion> = {}) =>
  writtenVersionFixture(overrides) as CvWrittenVersion & {
    document: CvDocument;
  };

const cv = () => screen.getByRole('article', { name: 'cv.yourCvTitle' });

describe('WrittenReview', () => {
  it('reads as a CV: the header from the CV details, then the sections that have something, in order', () => {
    setUp(ready());

    expect(cv()).toHaveTextContent('Maya Okafor');
    expect(cv()).toHaveTextContent(
      'London, UK · maya.okafor@example.com · 07700 900123',
    );
    expect(cv()).toHaveTextContent('Right to work in the UK: British citizen');
    expect(
      within(cv())
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent),
    ).toEqual(['Profile', 'Experience', 'Skills', 'Education', 'Languages']);
    expect(cv()).toHaveTextContent(
      'Senior Backend Engineer · Fenwick Pay · London2021 – 2026',
    );
    expect(cv()).toHaveTextContent(
      'Languages and data: Go · PostgreSQL · Java',
    );
  });

  it('says where each line comes from, until the switch is off', async () => {
    setUp(ready(), '15 Oct 2026');

    expect(await within(cv()).findAllByText('cv.sourceFrom')).not.toHaveLength(
      0,
    );
    expect(cv()).toHaveTextContent('cv.sourceDetails');
    await userEvent.click(
      screen.getByRole('switch', { name: 'cv.showSources' }),
    );

    expect(cv()).not.toHaveTextContent('cv.sourceFrom');
    expect(cv()).not.toHaveTextContent('cv.sourceDetails');
  });

  it('leaves out a removed line and marks an edited one as the candidate’s', async () => {
    const document = writtenDocumentFixture();
    document.experience[0]!.bullets[0]!.state = 'removed';
    document.skills[0] = {
      ...document.skills[0]!,
      text: 'Go and Kotlin',
      state: 'edited',
    };
    setUp(ready({ document }));

    expect(cv()).not.toHaveTextContent('Moved the payments ledger');
    expect(cv()).toHaveTextContent('Languages and data: Go and Kotlin');
    expect(
      await within(cv()).findByText('cv.sourceEditedByYou'),
    ).toBeInTheDocument();
  });

  it('shows what we did and why, three notes first, and the lines left out', async () => {
    setUp(
      ready({
        notes: ['One.', 'Two.', 'Three.', 'Four.'],
        dropped: { lines: 1, numbers: 1, names: 1 },
      }),
    );

    const notes = screen.getByRole('region', { name: 'cv.notesTitle' });
    expect(within(notes).getAllByRole('listitem')).toHaveLength(3);
    expect(notes).toHaveTextContent('cv.droppedLines');
    await userEvent.click(
      within(notes).getByRole('button', { name: 'cv.notesShowAll' }),
    );
    expect(within(notes).getAllByRole('listitem')).toHaveLength(4);
  });

  it('offers the download at once, with its length, and says when it is longer than asked', () => {
    const document = writtenDocumentFixture();
    document.summary[0]!.text = 'word '.repeat(700).trim();
    setUp(ready({ pages: 1, document }));

    const download = screen.getByRole('region', {
      name: 'cv.aboutPagesAndHalf',
    });
    expect(download).toHaveTextContent('cv.longerThanAsked');
    expect(
      within(download).getByRole('button', { name: 'cv.downloadPdfButton' }),
    ).toBeEnabled();
  });

  it('asks "Did you send it?" for a job, lists the questions, and the job’s words it doesn’t show', () => {
    setUp(ready());

    expect(
      screen.getByRole('region', { name: 'cv.sentTitle' }),
    ).toBeInTheDocument();
    const questions = screen.getByRole('region', {
      name: 'cv.writtenQuestionsTitle',
    });
    expect(questions).toHaveTextContent('Have you run Kafka at high volume?');
    expect(questions).toHaveTextContent('cv.questionNotAnswered');
    expect(
      screen.getByRole('region', { name: 'cv.termsTitle' }),
    ).toHaveTextContent('running Kafka at scale');
  });

  it('asks nothing about sending a general CV', () => {
    setUp(ready({ target: { kind: 'general' }, unsupportedJobTerms: [] }));

    expect(
      screen.queryByRole('region', { name: 'cv.sentTitle' }),
    ).not.toBeInTheDocument();
  });

  it('opens the CV details from the CV’s header', async () => {
    setUp(ready());

    await userEvent.click(
      within(cv()).getByRole('button', { name: 'cv.detailsEditButton' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'cv.detailsTitle' }),
    ).toBeInTheDocument();
  });
});
