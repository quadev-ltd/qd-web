import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { changesOf, EditApplicationPanel } from './EditApplicationPanel';
import JobCard from './JobCard';
import NewApplicationPanel from './NewApplicationPanel';
import RemoveApplicationDialog from './RemoveApplicationDialog';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NewApplicationPanel', () => {
  const setUp = (gateway = createMockProfileGateway()) => {
    const onClose = vi.fn();
    const utils = renderProfilePage(
      <Routes>
        <Route
          path="/home"
          element={<NewApplicationPanel onClose={onClose} />}
        />
        <Route path="*" element={<Location />} />
      </Routes>,
      {
        gateway,
        route: '/home',
        applications: { uid: 'uid-1', status: 'loaded' },
      },
    );
    return { onClose, ...utils };
  };
  const add = () =>
    screen.getByRole('button', { name: 'applications.addButton' });

  it('asks for a title and the job, and says what is missing', async () => {
    const { gateway } = setUp();

    await userEvent.click(add());

    expect(
      await screen.findByText('applications.titleRequiredError'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('applications.jobRequiredError'),
    ).toBeInTheDocument();
    expect(gateway.createApplication).not.toHaveBeenCalled();
  });

  it('refuses a job longer than 20,000 characters before anything is sent', async () => {
    setUp();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.titleLabel' }),
      'Go',
    );
    await userEvent.click(
      screen.getByRole('textbox', { name: 'applications.jobLabel' }),
    );
    await userEvent.paste('a'.repeat(20_001));

    expect(
      await screen.findByText('applications.jobLengthError'),
    ).toBeInTheDocument();
    expect(add()).toBeDisabled();
  });

  it('adds the application, puts it in the list and opens its page', async () => {
    const gateway = createMockProfileGateway();
    gateway.getApplication.mockResolvedValue(
      applicationFixture({ id: 'application-1' }),
    );
    const { store } = setUp(gateway);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.titleLabel' }),
      '  Senior Backend Engineer ',
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.jobLabel' }),
      'Go services in production.',
    );
    await userEvent.click(add());

    expect(
      await screen.findByText('at /applications/application-1'),
    ).toBeInTheDocument();
    expect(gateway.createApplication).toHaveBeenCalledExactlyOnceWith({
      title: 'Senior Backend Engineer',
      jobDescription: 'Go services in production.',
    });
    expect(store.getState().applications.applications[0]?.id).toBe(
      'application-1',
    );
  });

  it.each([
    [ProfileErrorCode.MaxApplications, 'applications.maxMessage'],
    [ProfileErrorCode.FlagOff, 'applications.notAvailableMessage'],
    [ProfileErrorCode.Network, 'applications.failedMessage'],
  ])(
    'says why it could not be added (%s), and logs the code only',
    async (code, message) => {
      const gateway = createMockProfileGateway();
      gateway.createApplication.mockRejectedValue(new ProfileError(code));
      setUp(gateway);

      await userEvent.type(
        screen.getByRole('textbox', { name: 'applications.titleLabel' }),
        'Go',
      );
      await userEvent.type(
        screen.getByRole('textbox', { name: 'applications.jobLabel' }),
        'Job',
      );
      await userEvent.click(add());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        `createApplication failed: code=${code} uid=uid-1`,
      );
      expect(add()).toBeEnabled();
    },
  );
});

describe('EditApplicationPanel', () => {
  const application = applicationFixture({
    company: 'Northwind Logistics',
    role: 'Backend',
    postingUrl: 'https://northwind.example/jobs/1',
    notes: 'Recruiter call on 8 Oct.',
  });
  const values = {
    title: application.title,
    company: 'Northwind Logistics',
    role: 'Backend',
    jobDescription: application.jobDescription ?? '',
    postingUrl: 'https://northwind.example/jobs/1',
    notes: 'Recruiter call on 8 Oct.',
  };

  describe('changesOf', () => {
    it('is empty when nothing changed', () => {
      expect(changesOf(application, values)).toEqual({});
    });

    it('sends only what changed, and clears an optional field that was emptied', () => {
      expect(
        changesOf(application, {
          ...values,
          title: 'Staff Engineer',
          role: '',
          notes: '',
        }),
      ).toEqual({ title: 'Staff Engineer', role: null, notes: null });
    });

    it('compares an address in its normal form', () => {
      expect(
        changesOf(application, {
          ...values,
          postingUrl: 'https://NORTHWIND.example/jobs/1#apply',
        }),
      ).toEqual({});
    });
  });

  const setUp = (gateway = createMockProfileGateway()) => {
    const onClose = vi.fn();
    const utils = renderProfilePage(
      <EditApplicationPanel application={application} onClose={onClose} />,
      {
        gateway,
        applications: {
          uid: 'uid-1',
          status: 'loaded',
          applications: [application],
        },
      },
    );
    return { onClose, ...utils };
  };
  const save = () =>
    screen.getByRole('button', { name: 'applications.saveButton' });

  it('starts with what the application has', () => {
    setUp();

    expect(
      screen.getByRole('textbox', { name: 'applications.companyField' }),
    ).toHaveValue('Northwind Logistics');
    expect(
      screen.getByRole('textbox', { name: 'applications.postingField' }),
    ).toHaveValue('https://northwind.example/jobs/1');
  });

  it('closes without a call when nothing changed', async () => {
    const { gateway, onClose } = setUp();

    await userEvent.click(save());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(gateway.updateApplication).not.toHaveBeenCalled();
  });

  it('saves what changed, reads the application again and closes', async () => {
    const gateway = createMockProfileGateway();
    gateway.getApplication.mockResolvedValue(
      applicationFixture({ company: 'Halvorsen' }),
    );
    const { onClose, store } = setUp(gateway);

    const company = screen.getByRole('textbox', {
      name: 'applications.companyField',
    });
    await userEvent.clear(company);
    await userEvent.type(company, 'Halvorsen');
    await userEvent.click(save());

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(gateway.updateApplication).toHaveBeenCalledExactlyOnceWith({
      applicationId: 'a1',
      company: 'Halvorsen',
    });
    expect(store.getState().applications.applications[0]?.company).toBe(
      'Halvorsen',
    );
  });

  it('does not let the job be emptied, nor take an address that is not a public page', async () => {
    const { gateway } = setUp();

    await userEvent.clear(
      screen.getByRole('textbox', { name: 'applications.jobLabel' }),
    );
    const posting = screen.getByRole('textbox', {
      name: 'applications.postingField',
    });
    await userEvent.clear(posting);
    await userEvent.type(posting, 'http://intranet.local/job');
    await userEvent.click(save());

    expect(
      await screen.findByText('applications.jobRequiredError'),
    ).toBeInTheDocument();
    expect(screen.getByText('applications.postingError')).toBeInTheDocument();
    expect(gateway.updateApplication).not.toHaveBeenCalled();
  });

  it('says it could not save, and stays open', async () => {
    const gateway = createMockProfileGateway();
    gateway.updateApplication.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    const { onClose } = setUp(gateway);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.roleField' }),
      ' and platform',
    );
    await userEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'applications.saveFailedMessage',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('RemoveApplicationDialog', () => {
  const setUp = (gateway = createMockProfileGateway()) => {
    const onCancel = vi.fn();
    const onRemoved = vi.fn();
    const utils = renderProfilePage(
      <RemoveApplicationDialog
        applicationId="a1"
        onCancel={onCancel}
        onRemoved={onRemoved}
      />,
      {
        gateway,
        applications: {
          uid: 'uid-1',
          status: 'loaded',
          applications: [applicationFixture()],
        },
      },
    );
    return { onCancel, onRemoved, ...utils };
  };
  const confirm = () =>
    screen.getByRole('button', { name: 'applications.removeConfirmButton' });

  it('removes nothing on Cancel', async () => {
    const { gateway, onCancel } = setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.cancelButton' }),
    );

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(gateway.removeApplication).not.toHaveBeenCalled();
  });

  it('counts an application that is already gone as removed', async () => {
    const gateway = createMockProfileGateway();
    gateway.removeApplication.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );
    const { onRemoved, store } = setUp(gateway);

    await userEvent.click(confirm());

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(store.getState().applications.applications).toEqual([]);
  });

  it('says it could not remove it, and keeps it', async () => {
    const gateway = createMockProfileGateway();
    gateway.removeApplication.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Network),
    );
    const { onRemoved, store } = setUp(gateway);

    await userEvent.click(confirm());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'applications.removeFailedMessage',
    );
    expect(onRemoved).not.toHaveBeenCalled();
    expect(store.getState().applications.applications).toHaveLength(1);
  });
});

describe('JobCard', () => {
  it('shows a short job whole, with nothing to open', () => {
    renderProfilePage(<JobCard application={applicationFixture()} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('opens a long job with "Show all", and closes it with "Show less"', async () => {
    renderProfilePage(
      <JobCard
        application={applicationFixture({ jobDescription: 'a'.repeat(900) })}
      />,
    );
    const card = screen.getByRole('region', { name: 'applications.jobTitle' });
    const toggle = within(card).getByRole('button', {
      name: 'applications.showAllButton',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('applications.showLessButton');
  });

  it('says when the job was pasted, or only that it was', () => {
    renderProfilePage(
      <JobCard application={applicationFixture({ createdAt: null })} />,
    );

    expect(screen.getByText('applications.jobPasted')).toBeInTheDocument();
  });
});
