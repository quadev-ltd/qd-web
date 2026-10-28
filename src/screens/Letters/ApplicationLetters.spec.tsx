import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { ApplicationLetters } from './ApplicationLetters';

import { type JobApplication } from '@/core/profile/applications';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { coverLetterFixture } from '@/testUtil/coverLetterFixtures';
import { writtenVersionFixture } from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Elsewhere = () => <p>at {useLocation().pathname}</p>;

/** The CV sent with the job, and a later one written for it. */
const SENT = writtenVersionFixture({
  id: 'v-sent',
  target: { kind: 'job', applicationId: 'a1' },
  sentAt: Date.parse('2026-10-11T10:00:00Z'),
  createdAt: Date.parse('2026-10-11T09:00:00Z'),
});
const LATER = writtenVersionFixture({
  id: 'v-later',
  target: { kind: 'job', applicationId: 'a1' },
  createdAt: Date.parse('2026-10-15T09:00:00Z'),
});

const setUp = ({
  application = applicationFixture({
    country: 'NL',
    contact: 'Priya Shah, Engineering Manager',
    letterAsked: 'required',
  }),
  gateway = createMockProfileGateway(),
  versions = [SENT, LATER],
  resources = [resourceFixture({ itemCount: 31 })],
}: {
  application?: JobApplication;
  gateway?: ReturnType<typeof createMockProfileGateway>;
  versions?: ReturnType<typeof writtenVersionFixture>[];
  resources?: ReturnType<typeof resourceFixture>[];
} = {}) => {
  renderCvPage(
    <Routes>
      <Route
        path="/applications/:applicationId/cv"
        element={<ApplicationLetters application={application} />}
      />
      <Route path="*" element={<Elsewhere />} />
    </Routes>,
    {
      gateway,
      route: '/applications/a1/cv',
      flags: { coverLetters: true },
      interviewProfile: { uid: 'uid-1', status: 'loaded', resources },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [application],
        profileRevision: 3,
      },
      cvVersions: { uid: 'uid-1', status: 'loaded', versions },
    },
  );
  return { gateway };
};

const panel = () => screen.findByRole('dialog', { name: 'letters.newTitle' });

describe('the letters of an application (D98)', () => {
  it('says the job asks for a letter, and lists its letters with what each goes with and where it is', async () => {
    const gateway = createMockProfileGateway();
    gateway.getApplicationLetters.mockResolvedValue([
      coverLetterFixture({ id: 'l1', cvVersionId: 'v-sent' }),
      coverLetterFixture({
        id: 'l2',
        status: 'creating',
        createdAt: Date.parse('2026-10-28T10:00:00Z'),
      }),
      coverLetterFixture({
        id: 'l3',
        sentAt: 1,
        questions: [],
        createdAt: Date.parse('2026-10-20T10:00:00Z'),
      }),
    ]);
    setUp({ gateway });

    expect(screen.getByText('letters.jobAsksBanner')).toBeInTheDocument();
    const list = await screen.findByRole('region', {
      name: 'letters.forThisJobTitle',
    });
    const rows = within(list).getAllByRole('listitem');
    expect(
      rows.map(row => within(row).getByRole('link').getAttribute('href')),
    ).toEqual([
      '/applications/a1/cv/letters/l2',
      '/applications/a1/cv/letters/l1',
      '/applications/a1/cv/letters/l3',
    ]);
    expect(rows[0]).toHaveTextContent('letters.writingChip');
    expect(rows[1]).toHaveTextContent('letters.questionsChip');
    expect(rows[1]).toHaveTextContent('letters.goesWith');
    expect(rows[2]).toHaveTextContent('letters.sentChip');
  });

  it('writes a letter for the job with what the panel shows: To from the posting, the CV sent, the job’s convention', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.createCoverLetter.mockResolvedValue({ letterId: 'l9' });
    setUp({ gateway });

    await user.click(
      screen.getByRole('button', { name: 'letters.writeButton' }),
    );
    const form = await panel();
    expect(
      within(form).getByRole('textbox', { name: 'letters.toField' }),
    ).toHaveValue('Priya Shah, Engineering Manager');
    expect(
      within(form).getByRole('radio', {
        name: /letters.cvOf.*letters.cvSentMeta/,
      }),
    ).toBeChecked();
    await user.type(
      within(form).getByRole('textbox', { name: 'letters.whyField' }),
      'Parcels are like payments.',
    );
    await user.click(
      within(form).getByRole('button', { name: 'letters.starterNotice' }),
    );
    await user.keyboard('four weeks');
    await user.click(
      within(form).getByRole('button', {
        name: 'letters.writeMyLetterButton',
      }),
    );

    expect(gateway.createCoverLetter).toHaveBeenCalledWith({
      applicationId: 'a1',
      cvVersionId: 'v-sent',
      convention: 'international',
      length: { kind: 'page' },
      addressee: 'Priya Shah, Engineering Manager',
      why: 'Parcels are like payments.',
      asked: 'letters.starterNoticePrefixfour weeks',
    });
    expect(
      await screen.findByText('at /applications/a1/cv/letters/l9'),
    ).toBeVisible();
  });

  it('improves a draft: the draft is needed, no reason or request is sent, the CV and the length as chosen', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();

    await user.click(
      screen.getByRole('button', { name: 'letters.improveDraftButton' }),
    );
    const form = await panel();
    expect(
      within(form).queryByRole('textbox', { name: 'letters.whyField' }),
    ).not.toBeInTheDocument();
    await user.click(
      within(form).getByRole('button', { name: 'letters.improveDraftButton' }),
    );
    expect(within(form).getByText('letters.draftRequired')).toBeInTheDocument();
    expect(gateway.createCoverLetter).not.toHaveBeenCalled();

    await user.type(
      within(form).getByRole('textbox', { name: 'letters.draftField' }),
      'hi! saw the role',
    );
    await user.click(
      within(form).getByRole('radio', { name: /letters.modeRewrite/ }),
    );
    await user.click(
      within(form).getByRole('radio', { name: /letters.noCvChoice/ }),
    );
    await user.click(
      within(form).getByRole('radio', { name: 'letters.lengthOption_box' }),
    );
    const chars = within(form).getByRole('textbox', {
      name: 'letters.boxField',
    });
    await user.clear(chars);
    await user.type(chars, '120');
    expect(within(form).getByText('letters.boxRangeError')).toBeInTheDocument();
    await user.clear(chars);
    await user.type(chars, '1200');
    await user.click(
      within(form).getByRole('button', { name: 'letters.improveDraftButton' }),
    );

    expect(gateway.createCoverLetter).toHaveBeenCalledWith({
      applicationId: 'a1',
      convention: 'international',
      length: { kind: 'box', maxChars: 1200 },
      addressee: 'Priya Shah, Engineering Manager',
      draft: { text: 'hi! saw the role', mode: 'rewrite' },
    });
  });

  it('with no CV for the job, says the letter is written from the profile alone', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp({ versions: [] });

    await user.click(
      screen.getByRole('button', { name: 'letters.writeButton' }),
    );
    const form = await panel();
    expect(within(form).getByText('letters.noCvForJob')).toBeInTheDocument();
    await user.click(
      within(form).getByRole('button', {
        name: 'letters.writeMyLetterButton',
      }),
    );

    expect(gateway.createCoverLetter.mock.calls[0][0]).not.toHaveProperty(
      'cvVersionId',
    );
  });

  it('with nothing in the profile, can only start from a draft', async () => {
    const user = userEvent.setup();
    setUp({ resources: [] });

    await user.click(
      screen.getByRole('button', { name: 'letters.writeButton' }),
    );
    const form = await panel();
    expect(within(form).getByText('letters.noItemsMessage')).toBeVisible();
    expect(
      within(form).getByRole('button', {
        name: 'letters.writeMyLetterButton',
      }),
    ).toBeDisabled();
    await user.click(
      within(form).getByRole('radio', { name: 'letters.startDraft' }),
    );
    expect(
      within(form).getByRole('button', { name: 'letters.improveDraftButton' }),
    ).toBeEnabled();
  });

  it('says the day’s limit, and what the backend refuses', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.createCoverLetter.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MaxLetters),
    );
    setUp({ gateway });

    await user.click(
      screen.getByRole('button', { name: 'letters.writeButton' }),
    );
    const form = await panel();
    await user.click(
      within(form).getByRole('button', {
        name: 'letters.writeMyLetterButton',
      }),
    );
    expect(await within(form).findByText('letters.maxMessage')).toBeVisible();

    gateway.getCoverLettersToday.mockResolvedValue(10);
    gateway.createCoverLetter.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    await user.click(
      within(form).getByRole('button', {
        name: 'letters.writeMyLetterButton',
      }),
    );
    expect(await within(form).findByText('letters.limitMessage')).toBeVisible();
    await waitFor(() =>
      expect(
        within(form).getByRole('button', {
          name: 'letters.writeMyLetterButton',
        }),
      ).toBeDisabled(),
    );
  });

  it('waits for a job not read yet', () => {
    setUp({
      application: applicationFixture({
        job: { source: 'text', status: 'reading', edited: false },
      }),
    });

    expect(screen.getByText('letters.jobNotReady')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'letters.writeButton' }),
    ).toBeDisabled();
  });
});
