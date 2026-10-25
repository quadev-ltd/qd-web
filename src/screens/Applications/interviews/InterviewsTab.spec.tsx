import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { ApplicationScreen } from '../ApplicationScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type ApplicationInterview } from '@/core/profile/interviews';
import {
  applicationFixture,
  interviewFixture,
} from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

// Sunday 25 Oct 2026 at noon in London, the day the clocks went back.
const NOW = Date.parse('2026-10-25T12:00:00Z');

const RECRUITER_CALL = interviewFixture({
  id: 'i0',
  name: 'Recruiter call',
  date: '2026-10-08',
  startTime: '11:00',
  startsAt: Date.parse('2026-10-08T10:00:00Z'),
  lengthMinutes: 30,
  type: undefined,
  description: 'Salary range and notice period.',
});
const TECHNICAL = interviewFixture();
const SYSTEM_DESIGN = interviewFixture({
  id: 'i2',
  name: undefined,
  type: 'system-design',
  date: '2026-11-05',
  startTime: '10:00',
  startsAt: Date.parse('2026-11-05T10:00:00Z'),
  lengthMinutes: undefined,
  description: '',
});

const setUp = ({
  interviews = [],
  gateway = createMockProfileGateway(),
  flags,
}: {
  interviews?: ApplicationInterview[];
  gateway?: ReturnType<typeof createMockProfileGateway>;
  flags?: { cvTool: boolean };
} = {}) => {
  gateway.getInterviews.mockResolvedValue(interviews);
  // Read again after a change, for its interviews' times.
  gateway.getApplication.mockResolvedValue(applicationFixture());
  return renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId/interviews"
        element={<ApplicationScreen tab="interviews" />}
      />
    </Routes>,
    {
      gateway,
      route: '/applications/a1/interviews',
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
      },
      flags,
    },
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the Interviews tab', () => {
  it('comes right after the brief, and is marked while open (D89)', async () => {
    setUp({ flags: { cvTool: true } });

    const tabs = screen.getByRole('navigation', {
      name: 'applications.tabsLabel',
    });
    expect(
      within(tabs)
        .getAllByRole('link')
        .map(link => link.textContent),
    ).toEqual([
      'applications.briefTab',
      'applications.interviewsTab',
      'applications.detailsTab',
      'applications.cvTab',
    ]);
    expect(
      within(tabs).getByRole('link', { name: 'applications.interviewsTab' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      await screen.findByRole('heading', { name: 'interviews.emptyTitle' }),
    ).toBeInTheDocument();
  });

  it('with none yet, says what to add, and opens "Add an interview"', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();

    expect(
      await screen.findByText('interviews.emptyDescription'),
    ).toBeInTheDocument();
    expect(gateway.getInterviews).toHaveBeenCalledWith('uid-1', 'a1');

    await user.click(
      screen.getByRole('button', { name: 'interviews.addButton' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'interviews.addTitle' }),
    ).toBeInTheDocument();
  });

  it('lists those coming up, the next first, then the past ones, each opening its interview', async () => {
    setUp({ interviews: [RECRUITER_CALL, SYSTEM_DESIGN, TECHNICAL] });

    const comingUp = await screen.findByRole('region', {
      name: 'interviews.comingUpTitle',
    });
    const past = screen.getByRole('region', { name: 'interviews.pastTitle' });
    expect(
      within(comingUp)
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent),
    ).toEqual(['Technical interview', 'interviews.typedTitle_system-design']);
    expect(
      within(past)
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent),
    ).toEqual(['Recruiter call']);
    expect(
      within(comingUp).getByRole('link', { name: 'Technical interview' }),
    ).toHaveAttribute('href', '/applications/a1/interviews/i1');
    expect(screen.getByText('interviews.zoneNote')).toBeInTheDocument();
  });

  it('says on each row when it is, how soon while it is coming up, the start of what the candidate knows, and the type and length', async () => {
    setUp({ interviews: [RECRUITER_CALL, SYSTEM_DESIGN, TECHNICAL] });

    const rows = await screen.findAllByRole('listitem');
    expect(rows).toHaveLength(3);
    const [technical, systemDesign, recruiterCall] = rows;
    expect(
      within(technical).getByText(
        'Wednesday 28 Oct · interviews.timeRange · interviews.inDays',
      ),
    ).toBeInTheDocument();
    expect(
      within(technical).getByText(TECHNICAL.description),
    ).toBeInTheDocument();
    expect(
      within(technical).getByText('interviews.type_technical'),
    ).toBeInTheDocument();
    expect(
      within(technical).getByText('interviews.lengthChip'),
    ).toBeInTheDocument();
    // No length: the start alone.
    expect(
      within(systemDesign).getByText(
        'Thursday 5 Nov · 10:00 · interviews.inDays',
      ),
    ).toBeInTheDocument();
    // Past: no "in n days".
    expect(
      within(recruiterCall).getByText('Thursday 8 Oct · interviews.timeRange'),
    ).toBeInTheDocument();
  });

  it('says when nothing is coming up, with "Add an interview" still there', async () => {
    setUp({ interviews: [RECRUITER_CALL] });

    expect(
      await screen.findByText('interviews.noneComingUp'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'interviews.addButton' }),
    ).toBeEnabled();
  });

  it('keeps an interview going on now under "Coming up" until it ends', async () => {
    const now = interviewFixture({
      id: 'now',
      name: 'Final interview',
      startsAt: NOW - 30 * 60_000,
      lengthMinutes: 60,
    });
    setUp({ interviews: [now] });

    const comingUp = await screen.findByRole('region', {
      name: 'interviews.comingUpTitle',
    });
    expect(within(comingUp).getByText('Final interview')).toBeInTheDocument();
  });

  it('disables "Add an interview" at 20, and says why', async () => {
    setUp({
      interviews: Array.from({ length: 20 }, (_, index) =>
        interviewFixture({
          id: `i${index}`,
          startsAt: NOW + index * 86_400_000,
        }),
      ),
    });

    expect(
      await screen.findByText('interviews.limitMessage'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'interviews.addButton' }),
    ).toBeDisabled();
  });

  it('says when they could not be read, and reads them again', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getInterviews.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );
    setUp({ gateway, interviews: [TECHNICAL] });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interviews.loadErrorMessage',
    );
    await user.click(
      screen.getByRole('button', { name: 'interviews.retryButton' }),
    );

    expect(
      await screen.findByRole('link', { name: 'Technical interview' }),
    ).toBeInTheDocument();
  });
});

describe('adding an interview', () => {
  const fillIn = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      await screen.findByRole('button', { name: 'interviews.addButton' }),
    );
    const panel = screen.getByRole('dialog', { name: 'interviews.addTitle' });
    await user.type(
      within(panel).getByLabelText('interviews.nameField'),
      ' Final interview ',
    );
    fireEvent.change(within(panel).getByLabelText('interviews.dateField'), {
      target: { value: '2026-11-12' },
    });
    fireEvent.change(within(panel).getByLabelText('interviews.timeField'), {
      target: { value: '16:30' },
    });
    return panel;
  };

  it('sends the date and time with the browser’s zone, and only the optional fields given', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.getInterview.mockResolvedValue(
      interviewFixture({ id: 'interview-1', name: 'Final interview' }),
    );
    const panel = await fillIn(user);
    const [, , sixty] = within(panel).getAllByRole('button', {
      name: 'interviews.lengthChip',
    });
    await user.click(sixty);
    await user.click(
      within(panel).getByRole('button', { name: 'interviews.type_mixed' }),
    );

    await user.click(
      within(panel).getByRole('button', { name: 'interviews.addSubmit' }),
    );

    await waitFor(() => {
      expect(gateway.createInterview).toHaveBeenCalledWith({
        applicationId: 'a1',
        name: 'Final interview',
        date: '2026-11-12',
        startTime: '16:30',
        timeZone: 'Europe/London',
        lengthMinutes: 60,
        type: 'mixed',
      });
    });
    // The panel closes and the new one is on the tab; the application is read again for the
    // list of applications.
    expect(
      await screen.findByRole('link', { name: 'Final interview' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'interviews.addTitle' }),
    ).not.toBeInTheDocument();
    expect(gateway.getInterview).toHaveBeenCalledWith(
      'uid-1',
      'a1',
      'interview-1',
    );
    expect(gateway.getApplication).toHaveBeenCalledWith('uid-1', 'a1');
  });

  it('asks for the date and the start time', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    await user.click(
      await screen.findByRole('button', { name: 'interviews.addButton' }),
    );
    const panel = screen.getByRole('dialog', { name: 'interviews.addTitle' });

    await user.click(
      within(panel).getByRole('button', { name: 'interviews.addSubmit' }),
    );

    expect(
      await within(panel).findByText('interviews.dateRequiredError'),
    ).toBeInTheDocument();
    expect(
      within(panel).getByText('interviews.timeRequiredError'),
    ).toBeInTheDocument();
    expect(gateway.createInterview).not.toHaveBeenCalled();
  });

  it('says so when the application already holds 20', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.createInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MaxInterviews),
    );
    const panel = await fillIn(user);

    await user.click(
      within(panel).getByRole('button', { name: 'interviews.addSubmit' }),
    );

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'interviews.limitMessage',
    );
  });

  it('says so when the application is gone', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.createInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );
    const panel = await fillIn(user);

    await user.click(
      within(panel).getByRole('button', { name: 'interviews.addSubmit' }),
    );

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'interviews.goneMessage',
    );
  });
});
