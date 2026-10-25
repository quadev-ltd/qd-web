import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { InterviewScreen } from './InterviewScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type ApplicationInterview } from '@/core/profile/interviews';
import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
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

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const setUp = ({
  interviews = [interviewFixture()],
  applications = {
    uid: 'uid-1',
    status: 'loaded',
    applications: [applicationFixture()],
  },
  gateway = createMockProfileGateway(),
  route = '/applications/a1/interviews/i1',
}: {
  interviews?: ApplicationInterview[];
  applications?: Partial<ApplicationsState>;
  gateway?: ReturnType<typeof createMockProfileGateway>;
  route?: string;
} = {}) => {
  gateway.getInterviews.mockResolvedValue(interviews);
  gateway.getApplication.mockResolvedValue(applicationFixture());
  return renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId/interviews/:interviewId"
        element={<InterviewScreen />}
      />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route,
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications,
    },
  );
};

const details = () =>
  screen.getByRole('region', { name: 'interviews.detailsTitle' });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('InterviewScreen', () => {
  it('names the interview, with its application under it and a link back to its interviews', async () => {
    setUp();

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Technical interview',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Senior Backend Engineer · Northwind Logistics'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Senior Backend Engineer' }),
    ).toHaveAttribute('href', '/applications/a1/interviews');
    expect(document.title).toBe('interviews.documentTitle');
    // Under Applications, which stays marked in the bar.
    expect(
      screen.getByRole('link', { name: 'applications.title', current: 'page' }),
    ).toBeInTheDocument();
  });

  it('says when it is, how soon, its type and length, and what the candidate knows in their words', async () => {
    setUp();

    await screen.findByRole('heading', { level: 1 });
    const card = details();
    expect(
      within(card).getByText('Wednesday 28 October 2026'),
    ).toBeInTheDocument();
    expect(
      within(card).getByText('interviews.timesInZone'),
    ).toBeInTheDocument();
    expect(within(card).getByText('interviews.inDaysChip')).toBeInTheDocument();
    expect(within(card).getByText('interviews.type_technical')).toBeVisible();
    expect(within(card).getByText('interviews.lengthValue')).toBeVisible();
    expect(
      within(card).getByText(interviewFixture().description, {
        selector: 'blockquote',
      }),
    ).toBeInTheDocument();
    expect(
      within(card).queryByText('interviews.addedInZone'),
    ).not.toBeInTheDocument();
  });

  it('says what will come, not built yet', async () => {
    setUp();

    const ready = await screen.findByRole('region', {
      name: 'interviews.readyTitle',
    });
    expect(within(ready).getByText('home.comingSoonChip')).toBeInTheDocument();
    expect(
      within(ready).getByText('interviews.readyDescription'),
    ).toBeInTheDocument();
  });

  it('without a name, type, length or description: "Interview", and a line saying nothing is written yet', async () => {
    setUp({
      interviews: [
        interviewFixture({
          name: undefined,
          type: undefined,
          lengthMinutes: undefined,
          description: '',
        }),
      ],
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'interviews.untitled',
      }),
    ).toBeInTheDocument();
    expect(
      within(details()).queryByText('interviews.typeLabel'),
    ).not.toBeInTheDocument();
    expect(
      within(details()).getByText('interviews.descriptionEmpty'),
    ).toBeInTheDocument();
  });

  it('once past, says no more how soon it is', async () => {
    setUp({
      interviews: [
        interviewFixture({ startsAt: Date.parse('2026-10-08T10:00:00Z') }),
      ],
    });

    await screen.findByRole('heading', { level: 1 });
    expect(
      within(details()).queryByText(/^interviews\.(today|tomorrow|inDays)/),
    ).not.toBeInTheDocument();
  });

  it('says when it was added in another time zone', async () => {
    setUp({
      interviews: [
        interviewFixture({ timeZone: 'America/New_York', startTime: '10:00' }),
      ],
    });

    await screen.findByRole('heading', { level: 1 });
    expect(
      within(details()).getByText('interviews.addedInZone'),
    ).toBeInTheDocument();
  });

  it('says when the interview is not there, with a way back to the interviews', async () => {
    setUp({ route: '/applications/a1/interviews/gone' });

    expect(
      await screen.findByRole('heading', { name: 'interviews.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'interviews.notFoundLink' }),
    ).toHaveAttribute('href', '/applications/a1/interviews');
  });

  it('says when the application is not there', () => {
    setUp({ route: '/applications/gone/interviews/i1' });

    expect(
      screen.getByRole('heading', { name: 'applications.notFoundTitle' }),
    ).toBeInTheDocument();
  });

  it('says when the interviews could not be read, and reads them again', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getInterviews.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );
    setUp({ gateway });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interviews.loadErrorMessage',
    );
    await user.click(
      screen.getByRole('button', { name: 'interviews.retryButton' }),
    );

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Technical interview',
      }),
    ).toBeInTheDocument();
  });
});

describe('editing an interview', () => {
  const openEdit = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(
      await screen.findByRole('button', { name: 'interviews.editButton' }),
    );
    return screen.getByRole('dialog', { name: 'interviews.editTitle' });
  };

  it('opens the panel filled in, with "Save changes"', async () => {
    const user = userEvent.setup();
    setUp();
    const panel = await openEdit(user);

    expect(within(panel).getByLabelText('interviews.nameField')).toHaveValue(
      'Technical interview',
    );
    expect(within(panel).getByLabelText('interviews.dateField')).toHaveValue(
      '2026-10-28',
    );
    expect(within(panel).getByLabelText('interviews.timeField')).toHaveValue(
      '14:00',
    );
    expect(
      within(panel).getByRole('button', { name: 'interviews.type_technical' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(panel).getByRole('button', { name: 'interviews.saveButton' }),
    ).toBeInTheDocument();
  });

  it('sends only what changed, and clears an optional field emptied', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.getInterview.mockResolvedValue(
      interviewFixture({ name: undefined, type: undefined }),
    );
    const panel = await openEdit(user);

    await user.clear(within(panel).getByLabelText('interviews.nameField'));
    await user.click(
      within(panel).getByRole('button', { name: 'interviews.type_technical' }),
    );
    await user.click(
      within(panel).getByRole('button', { name: 'interviews.saveButton' }),
    );

    await waitFor(() => {
      expect(gateway.updateInterview).toHaveBeenCalledWith({
        applicationId: 'a1',
        interviewId: 'i1',
        name: null,
        type: null,
      });
    });
    // Read again: the heading follows.
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'interviews.untitled',
      }),
    ).toBeInTheDocument();
  });

  it('sends a new date or time with the zone, all three together', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.getInterview.mockResolvedValue(interviewFixture());
    const panel = await openEdit(user);

    fireEvent.change(within(panel).getByLabelText('interviews.timeField'), {
      target: { value: '15:30' },
    });
    await user.click(
      within(panel).getByRole('button', { name: 'interviews.saveButton' }),
    );

    await waitFor(() => {
      expect(gateway.updateInterview).toHaveBeenCalledWith({
        applicationId: 'a1',
        interviewId: 'i1',
        date: '2026-10-28',
        startTime: '15:30',
        timeZone: 'Europe/London',
      });
    });
  });

  it('closes without a call when nothing changed', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    const panel = await openEdit(user);

    await user.click(
      within(panel).getByRole('button', { name: 'interviews.saveButton' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'interviews.editTitle' }),
      ).not.toBeInTheDocument();
    });
    expect(gateway.updateInterview).not.toHaveBeenCalled();
  });

  it('says so when the changes could not be saved', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.updateInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    const panel = await openEdit(user);

    await user.type(
      within(panel).getByLabelText('interviews.descriptionField'),
      ' And on-call.',
    );
    await user.click(
      within(panel).getByRole('button', { name: 'interviews.saveButton' }),
    );

    expect(await within(panel).findByRole('alert')).toHaveTextContent(
      'interviews.saveFailedMessage',
    );
  });
});

describe('removing an interview', () => {
  it('asks first, then removes it and goes back to the interviews', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();

    await user.click(
      await screen.findByRole('button', { name: 'interviews.removeLink' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'interviews.removeDialogTitle',
    });
    expect(
      within(dialog).getByText('interviews.removeDialogText'),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', {
        name: 'interviews.removeConfirmButton',
      }),
    );

    expect(
      await screen.findByText('at /applications/a1/interviews'),
    ).toBeInTheDocument();
    expect(gateway.removeInterview).toHaveBeenCalledWith('a1', 'i1');
    expect(gateway.getApplication).toHaveBeenCalledWith('uid-1', 'a1');
  });

  it('keeps the dialog, saying so, when it could not be removed', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.removeInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );

    await user.click(
      await screen.findByRole('button', { name: 'interviews.removeLink' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'interviews.removeConfirmButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'interviews.removeFailedMessage',
    );
  });

  it('takes one already gone as removed', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.removeInterview.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );

    await user.click(
      await screen.findByRole('button', { name: 'interviews.removeLink' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'interviews.removeConfirmButton' }),
    );

    expect(
      await screen.findByText('at /applications/a1/interviews'),
    ).toBeInTheDocument();
  });
});
