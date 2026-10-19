import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { WrittenReview } from './WrittenReview';

import { type CvDocument } from '@/core/profile/cvDocument';
import { type CvWrittenVersion } from '@/core/profile/cvVersions';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
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

const aside = () =>
  screen.getByRole('complementary', { name: 'cv.writtenAside' });

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

  it('shows a role with no title, and "Earlier career" with no organisation or dates, cleanly', () => {
    const document = writtenDocumentFixture();
    const [role] = document.experience;
    document.experience = [
      { ...role!, title: '', location: '', end: '' },
      {
        ...role!,
        id: 'e2',
        title: 'Earlier career',
        organisation: '',
        location: '',
        start: '',
        end: '',
        bullets: [
          {
            ...role!.bullets[0]!,
            id: 'l9',
            text: 'Backend Engineer, Kestrel Insurance, 2015 – 2018',
          },
        ],
      },
    ];
    setUp(ready({ document }));

    const [first, earlier] = within(cv())
      .getAllByRole('button', { name: /Fenwick Pay|Earlier career/ })
      .map(button => button.firstElementChild?.textContent);
    expect(first).toBe('Fenwick Pay2021');
    expect(earlier).toBe('Earlier career');
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
    expect(
      within(questions).getByRole('textbox', { name: /cv.yourAnswer/ }),
    ).toBeInTheDocument();
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

  describe('a line or a role opened', () => {
    it('shows the line beside the CV, with the words of each item it cites, and closes the notes', async () => {
      setUp(ready());

      await userEvent.click(
        within(cv()).getByRole('button', { name: /Moved the payments ledger/ }),
      );

      const line = within(aside()).getByRole('region', { name: 'cv.thisLine' });
      expect(line).toHaveTextContent(
        'Experience · Senior Backend Engineer, Fenwick Pay',
      );
      expect(
        await within(line).findByText('Maya Okafor CV 2026'),
      ).toBeVisible();
      expect(line).toHaveTextContent('profile.typeCv');
      expect(
        screen.queryByRole('region', { name: 'cv.notesTitle' }),
      ).not.toBeInTheDocument();
    });

    it('edits a line in the candidate’s words, beside what we wrote', async () => {
      const gateway = setUp(ready());

      await userEvent.click(
        within(cv()).getByRole('button', { name: /Moved the payments ledger/ }),
      );
      const line = within(aside()).getByRole('region', { name: 'cv.thisLine' });
      await userEvent.click(
        within(line).getByRole('button', { name: 'cv.editButton' }),
      );
      expect(line).toHaveTextContent('cv.whatWeWrote');
      const wording = within(line).getByRole('textbox', {
        name: /cv.yourWordingLabel/,
      });
      await userEvent.clear(wording);
      await userEvent.type(wording, ' Moved the ledger to events. ');
      await userEvent.click(
        within(line).getByRole('button', { name: 'cv.saveWordingButton' }),
      );

      expect(gateway.reviseCvLine).toHaveBeenCalledExactlyOnceWith('w1', {
        lineId: 'l2',
        action: 'edit',
        text: 'Moved the ledger to events.',
      });
      expect(gateway.getCvVersion).toHaveBeenCalledWith('uid-1', 'w1');
    });

    it('removes a line, and restores one removed or edited', async () => {
      const document = writtenDocumentFixture();
      document.summary[0]!.state = 'edited';
      document.experience[0]!.bullets[1]!.state = 'removed';
      const gateway = setUp(ready({ document }));

      // The removed one keeps its place while the sources show
      expect(cv()).toHaveTextContent('cv.lineRemovedByYou');
      await userEvent.click(
        within(cv()).getByRole('button', { name: 'cv.restoreRemovedLabel' }),
      );
      expect(gateway.reviseCvLine).toHaveBeenLastCalledWith('w1', {
        lineId: 'l3',
        action: 'restore',
      });

      await userEvent.click(
        within(cv()).getByRole('button', {
          name: /Backend engineer who designs/,
        }),
      );
      const line = within(aside()).getByRole('region', { name: 'cv.thisLine' });
      expect(line).toHaveTextContent('cv.yourWordsText');
      await userEvent.click(
        within(line).getByRole('button', { name: 'cv.restoreWrittenButton' }),
      );
      expect(gateway.reviseCvLine).toHaveBeenLastCalledWith('w1', {
        lineId: 'l1',
        action: 'restore',
      });
      await userEvent.click(
        within(line).getByRole('button', { name: 'cv.removeLineButton' }),
      );
      expect(gateway.reviseCvLine).toHaveBeenLastCalledWith('w1', {
        lineId: 'l1',
        action: 'remove',
      });

      await userEvent.click(
        screen.getByRole('switch', { name: 'cv.showSources' }),
      );
      expect(cv()).not.toHaveTextContent('cv.lineRemovedByYou');
    });

    it('edits a role’s heading, sending only the fields changed', async () => {
      const gateway = setUp(ready());

      await userEvent.click(
        within(cv()).getByRole('button', {
          name: /Senior Backend Engineer · Fenwick Pay/,
        }),
      );
      const role = within(aside()).getByRole('region', { name: 'cv.thisRole' });
      await userEvent.click(
        within(role).getByRole('button', { name: 'cv.editButton' }),
      );
      const to = within(role).getByRole('textbox', { name: /cv.roleTo/ });
      await userEvent.clear(to);
      await userEvent.type(to, 'Present');
      await userEvent.click(
        within(role).getByRole('button', { name: 'cv.saveRoleButton' }),
      );

      expect(gateway.reviseCvLine).toHaveBeenCalledExactlyOnceWith('w1', {
        lineId: 'e1',
        action: 'edit',
        fields: { end: 'Present' },
      });
    });

    it('says when a cited item is no longer in the profile, and shows an answer it cites', async () => {
      const document = writtenDocumentFixture();
      document.experience[0]!.bullets[0]!.sources = [
        { kind: 'item', itemId: 'gone' },
      ];
      setUp(ready({ document }), '15 Oct 2026');

      await userEvent.click(
        within(cv()).getByRole('button', { name: /Moved the payments ledger/ }),
      );
      expect(
        await within(aside()).findByText('cv.sourceGoneTitle'),
      ).toBeInTheDocument();
      await userEvent.click(
        within(cv()).getByRole('button', { name: /Led the on-call redesign/ }),
      );
      const line = within(aside()).getByRole('region', { name: 'cv.thisLine' });
      expect(line).toHaveTextContent('cv.yourAnswerOf');
      expect(line).toHaveTextContent('How large was the team?');
      expect(line).toHaveTextContent('Nine engineers.');
    });
  });

  describe('the questions, and "Write again"', () => {
    it('saves an answer, or skips the question', async () => {
      const gateway = setUp(ready());

      const questions = screen.getByRole('region', {
        name: 'cv.writtenQuestionsTitle',
      });
      await userEvent.type(
        within(questions).getByRole('textbox', { name: /cv.yourAnswer/ }),
        'Nine engineers, for two years.',
      );
      await userEvent.click(
        within(questions).getByRole('button', { name: 'cv.saveAnswerButton' }),
      );
      expect(gateway.answerCvQuestion).toHaveBeenCalledExactlyOnceWith(
        'w1',
        'q1',
        'Nine engineers, for two years.',
      );

      await userEvent.click(
        await within(questions).findByRole('button', {
          name: 'cv.changeAnswerButton',
        }),
      );
      await userEvent.click(
        within(questions).getByRole('button', { name: 'cv.skipButton' }),
      );
      expect(gateway.answerCvQuestion).toHaveBeenLastCalledWith(
        'w1',
        'q1',
        undefined,
      );
    });

    it('writes again with the answers given, as a new version', async () => {
      const gateway = setUp(
        ready({
          questions: [
            {
              id: 'q1',
              text: 'How large was the team?',
              status: 'answered',
              answer: 'Nine.',
            },
          ],
        }),
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'cv.writeAgainWithAnswers' }),
      );

      expect(gateway.rewriteCvVersion).toHaveBeenCalledExactlyOnceWith('w1');
      expect(gateway.getCvVersion).toHaveBeenCalledWith('uid-1', 'version-3');
    });

    it('writes again with no answer, and says why it could not', async () => {
      const gateway = setUp(ready({ questions: [] }));
      gateway.rewriteCvVersion.mockRejectedValue(
        new ProfileError(ProfileErrorCode.DailyLimit),
      );

      expect(screen.getByText('cv.writeAgainText')).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', { name: 'cv.writeAgainButton' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'cv.limitMessage',
      );
    });
  });
});
