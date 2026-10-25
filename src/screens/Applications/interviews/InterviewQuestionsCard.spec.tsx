import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { InterviewScreen } from './InterviewScreen';

import { type JobApplication } from '@/core/profile/applications';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import {
  type ApplicationInterview,
  type InterviewQuestions,
} from '@/core/profile/interviews';
import {
  applicationFixture,
  interviewFixture,
} from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const NOW = Date.parse('2026-10-25T12:00:00Z');

const questions = (
  count: number,
  more: Partial<InterviewQuestions> = {},
): InterviewQuestions => ({
  items: Array.from({ length: count }, (_, index) => ({
    id: `q${index + 1}`,
    text: `Question ${index + 1}?`,
    kind: (['behavioural', 'technical', 'role', 'motivation'] as const)[
      index % 4
    ],
    why: `Why ${index + 1}.`,
  })),
  builtAt: Date.parse('2026-10-25T09:00:00Z'),
  interviewRevision: 1,
  applicationRevision: 1,
  profileRevision: 3,
  ...more,
});

const setUp = ({
  interview = interviewFixture(),
  application = applicationFixture(),
  profileRevision = 3,
  gateway = createMockProfileGateway(),
  textPractice = true,
}: {
  interview?: ApplicationInterview;
  application?: JobApplication;
  profileRevision?: number;
  gateway?: ReturnType<typeof createMockProfileGateway>;
  textPractice?: boolean;
} = {}) => {
  gateway.getInterviews.mockResolvedValue([interview]);
  gateway.getApplication.mockResolvedValue(application);
  gateway.getProfileRevision.mockResolvedValue(profileRevision);
  return renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId/interviews/:interviewId"
        element={<InterviewScreen />}
      />
    </Routes>,
    {
      gateway,
      route: '/applications/a1/interviews/i1',
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [application],
        profileRevision,
      },
      flags: { textPractice },
    },
  );
};

const card = () =>
  screen.findByRole('region', { name: 'interviews.questionsTitle' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the likely questions of an interview (D94)', () => {
  it('without the textPractice flag, keeps "Get ready for it · Coming soon"', async () => {
    setUp({ textPractice: false });

    expect(
      await screen.findByRole('region', { name: 'interviews.readyTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'interviews.questionsTitle' }),
    ).not.toBeInTheDocument();
  });

  it('not written yet: what they are written from, "Write likely questions" and the lists left today', async () => {
    const { gateway } = setUp();
    gateway.getInterviewQuestionsToday.mockResolvedValue(1);

    const region = await card();
    expect(
      within(region).getByText('interviews.questionsDescription'),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('button', {
        name: 'interviews.writeQuestionsButton',
      }),
    ).toBeEnabled();
    expect(
      await within(region).findByText('interviews.questionsLeft'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'interviews.readyTitle' }),
    ).not.toBeInTheDocument();
  });

  it('writes them on request, says so meanwhile, then shows the first five with "Show all"', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    let finish: () => void = () => undefined;
    gateway.writeInterviewQuestions.mockImplementation(
      () =>
        new Promise(resolve => {
          finish = () => resolve({ questions: 8 });
        }),
    );
    gateway.getInterview.mockResolvedValue(
      interviewFixture({ questions: questions(8) }),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getByRole('button', {
        name: 'interviews.writeQuestionsButton',
      }),
    );

    expect(
      await screen.findByText('interviews.writingTitle'),
    ).toBeInTheDocument();
    expect(screen.getByText('interviews.writingDescription')).toBeVisible();
    expect(gateway.writeInterviewQuestions).toHaveBeenCalledWith('a1', 'i1');

    finish();

    const region = await card();
    expect(await within(region).findByText('Question 1?')).toBeInTheDocument();
    expect(within(region).getAllByRole('listitem')).toHaveLength(5);
    expect(
      within(region).queryByText('interviews.writingTitle'),
    ).not.toBeInTheDocument();
    expect(gateway.getInterview).toHaveBeenCalledWith('uid-1', 'a1', 'i1');
    await user.click(
      within(region).getByRole('button', {
        name: 'applications.showAllCountButton',
      }),
    );
    expect(within(region).getAllByRole('listitem')).toHaveLength(8);
  });

  it('shows each question with its kind and why it is likely, and when the list was written', async () => {
    setUp({ interview: interviewFixture({ questions: questions(3) }) });

    const region = await card();
    expect(
      within(region).getByText('interviews.questionsWrittenOn'),
    ).toBeInTheDocument();
    const [first, second, third] = within(region).getAllByRole('listitem');
    expect(
      within(first).getByText('applications.questionBehavioural'),
    ).toBeInTheDocument();
    expect(within(first).getByText('Question 1?')).toBeInTheDocument();
    expect(within(first).getByText('Why 1.')).toBeInTheDocument();
    expect(
      within(second).getByText('applications.questionTechnical'),
    ).toBeInTheDocument();
    expect(
      within(third).getByText('applications.questionRole'),
    ).toBeInTheDocument();
    // Current: no banner, no button.
    expect(
      within(region).queryByRole('button', {
        name: 'interviews.writeAgainButton',
      }),
    ).not.toBeInTheDocument();
  });

  it.each([
    [
      'the interview',
      { interview: interviewFixture({ revision: 2, questions: questions(6) }) },
      'interviews.questionsChanged_interview',
    ],
    [
      'the job',
      {
        interview: interviewFixture({ questions: questions(6) }),
        application: applicationFixture({ revision: 2 }),
      },
      'interviews.questionsChanged_job',
    ],
    [
      'the profile',
      {
        interview: interviewFixture({ questions: questions(6) }),
        profileRevision: 4,
      },
      'interviews.questionsChanged_profile',
    ],
  ])(
    'out of date because %s changed: kept, with a banner saying so and "Write again"',
    async (_, options, message) => {
      const user = userEvent.setup();
      const { gateway } = setUp(options);

      const region = await card();
      expect(await within(region).findByText(message)).toBeInTheDocument();
      expect(within(region).getAllByRole('listitem')).toHaveLength(5);
      await user.click(
        within(region).getByRole('button', {
          name: 'interviews.writeAgainButton',
        }),
      );
      expect(gateway.writeInterviewQuestions).toHaveBeenCalledWith('a1', 'i1');
    },
  );

  it('with none left today, cannot write, and says so when the backend refuses', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.writeInterviewQuestions.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getByRole('button', {
        name: 'interviews.writeQuestionsButton',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interviews.questionsLimitMessage',
    );
    expect(
      screen.getByRole('button', { name: 'interviews.writeQuestionsButton' }),
    ).toBeDisabled();
  });

  it('cannot write once the lists of the day are used, counting the account’s own limit', async () => {
    const gateway = createMockProfileGateway();
    gateway.getInterviewQuestionsToday.mockResolvedValue(3);
    gateway.getUsageLimits.mockResolvedValue({
      services: { interviewQuestions: { maxCallsPerDay: 3 } },
    });
    setUp({ gateway });

    const region = await card();
    await waitFor(() => {
      expect(
        within(region).getByRole('button', {
          name: 'interviews.writeQuestionsButton',
        }),
      ).toBeDisabled();
    });
  });

  it('offers to try again when the questions could not be written, and keeps an earlier list', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.writeInterviewQuestions
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Network))
      .mockResolvedValue({ questions: 6 });
    gateway.getInterview.mockResolvedValue(
      interviewFixture({
        revision: 2,
        questions: questions(6, { interviewRevision: 2 }),
      }),
    );
    setUp({
      gateway,
      interview: interviewFixture({ revision: 2, questions: questions(6) }),
    });

    await user.click(
      within(await card()).getByRole('button', {
        name: 'interviews.writeAgainButton',
      }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interviews.questionsFailedKeptMessage',
    );
    expect(screen.getAllByText(/^Question \d\?$/)).toHaveLength(5);

    await user.click(
      screen.getByRole('button', { name: 'interviews.retryButton' }),
    );

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(
      screen.queryByText('interviews.questionsChanged_interview'),
    ).not.toBeInTheDocument();
  });

  it('says where the button would be that the job has no description, with the way to Details', async () => {
    setUp({ application: applicationFixture({ jobDescription: undefined }) });

    const region = await card();
    expect(
      within(region).getByText(/interviews\.questionsNoJobMessage/),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole('link', { name: 'interviews.openDetailsLink' }),
    ).toHaveAttribute('href', '/applications/a1/details');
    expect(
      within(region).queryByRole('button', {
        name: 'interviews.writeQuestionsButton',
      }),
    ).not.toBeInTheDocument();
  });

  it('says so when the backend refuses for a job without its text', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.writeInterviewQuestions.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NoJobDescription),
    );
    setUp({ gateway });

    await user.click(
      within(await card()).getByRole('button', {
        name: 'interviews.writeQuestionsButton',
      }),
    );

    expect(
      await screen.findByText(/interviews\.questionsNoJobMessage/),
    ).toBeInTheDocument();
  });

  it('waits for a job being read', async () => {
    setUp({
      application: applicationFixture({
        job: { source: 'link', status: 'reading', edited: false },
      }),
    });

    expect(
      within(await card()).getByText('interviews.questionsJobReadingMessage'),
    ).toBeInTheDocument();
  });

  it('reads the profile’s revision again when the interview opens', async () => {
    const { gateway } = setUp();

    await card();
    await waitFor(() => {
      expect(gateway.getProfileRevision).toHaveBeenCalledWith('uid-1');
    });
  });
});
