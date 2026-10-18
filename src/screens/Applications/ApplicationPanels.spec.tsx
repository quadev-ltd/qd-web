import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import DetailsTab from './DetailsTab';
import { changesOf, EditApplicationPanel } from './EditApplicationPanel';
import JobCard from './JobCard';
import NewApplicationPanel from './NewApplicationPanel';
import RemoveApplicationDialog from './RemoveApplicationDialog';
import { type ReadPostingAgain } from './useReadPostingAgain';

import { type JobApplication } from '@/core/profile/applications';
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
  const how = (option: string) =>
    userEvent.click(screen.getByRole('radio', { name: option }));
  const pdf = new File(['%PDF-1.7 fictional'], 'northwind-job.pdf', {
    type: 'application/pdf',
  });

  it('asks for the job only, pasted by default, and says when it is missing', async () => {
    const { gateway } = setUp();
    expect(
      screen.queryByRole('textbox', { name: 'applications.titleLabel' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('radio', { name: 'applications.howText' }),
    ).toBeChecked();

    await userEvent.click(add());

    expect(
      await screen.findByText('applications.jobRequiredError'),
    ).toBeInTheDocument();
    expect(gateway.createApplication).not.toHaveBeenCalled();
  });

  it('refuses a job longer than 20,000 characters before anything is sent', async () => {
    setUp();
    await userEvent.click(
      screen.getByRole('textbox', { name: 'applications.jobLabel' }),
    );
    await userEvent.paste('a'.repeat(20_001));

    expect(
      await screen.findByText('applications.jobLengthError'),
    ).toBeInTheDocument();
    expect(add()).toBeDisabled();
  });

  it('adds a pasted job, puts the application in the list and opens its page', async () => {
    const gateway = createMockProfileGateway();
    gateway.getApplication.mockResolvedValue(
      applicationFixture({ id: 'application-1' }),
    );
    const { store } = setUp(gateway);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.jobLabel' }),
      '  Go services in production. ',
    );
    await userEvent.click(add());

    expect(
      await screen.findByText('at /applications/application-1'),
    ).toBeInTheDocument();
    expect(gateway.createApplication).toHaveBeenCalledExactlyOnceWith({
      job: { source: 'text', text: 'Go services in production.' },
    });
    expect(store.getState().applications.applications[0]?.id).toBe(
      'application-1',
    );
  });

  it('adds a posting by its address, and refuses one that is not a public page', async () => {
    const gateway = createMockProfileGateway();
    setUp(gateway);
    await how('applications.howLink');
    const address = screen.getByRole('textbox', {
      name: 'applications.linkLabel',
    });

    await userEvent.type(address, 'http://intranet.local/job');
    await userEvent.click(add());
    expect(
      await screen.findByText('addResource.addressError'),
    ).toBeInTheDocument();
    expect(gateway.createApplication).not.toHaveBeenCalled();

    await userEvent.clear(address);
    await userEvent.type(address, 'https://northwind.example/jobs/1482#apply');
    await userEvent.click(add());

    await screen.findByText('at /applications/application-1');
    expect(gateway.createApplication).toHaveBeenCalledExactlyOnceWith({
      job: { source: 'link', url: 'https://northwind.example/jobs/1482' },
    });
  });

  it('adds a job as a file: creates the application, uploads the file where the backend said, then opens its page', async () => {
    const gateway = createMockProfileGateway();
    const upload = {
      path: 'users/uid-1/application-docs/application-1/job.pdf',
      contentType: 'application/pdf' as const,
      maxBytes: 10_485_760,
    };
    gateway.createApplication.mockResolvedValue({
      applicationId: 'application-1',
      upload,
    });
    setUp(gateway);
    await how('applications.howFile');

    await userEvent.upload(
      document.querySelector('input[type=file]') as HTMLInputElement,
      pdf,
    );
    await userEvent.click(add());

    await screen.findByText('at /applications/application-1');
    expect(gateway.createApplication).toHaveBeenCalledExactlyOnceWith({
      job: {
        source: 'file',
        contentType: 'application/pdf',
        fileName: 'northwind-job.pdf',
      },
    });
    expect(gateway.uploadFile).toHaveBeenCalledWith(
      upload,
      pdf,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
  });

  it('offers to try the upload again when it failed, to the same place', async () => {
    const gateway = createMockProfileGateway();
    const upload = {
      path: 'users/uid-1/application-docs/application-1/job.pdf',
      contentType: 'application/pdf' as const,
      maxBytes: 10_485_760,
    };
    gateway.createApplication.mockResolvedValue({
      applicationId: 'application-1',
      upload,
    });
    gateway.uploadFile.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );
    setUp(gateway);
    await how('applications.howFile');
    await userEvent.upload(
      document.querySelector('input[type=file]') as HTMLInputElement,
      pdf,
    );
    await userEvent.click(add());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'addResource.uploadFailedMessage',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'addResource.retryUploadButton' }),
    );

    await screen.findByText('at /applications/application-1');
    expect(gateway.createApplication).toHaveBeenCalledTimes(1);
    expect(gateway.uploadFile).toHaveBeenCalledTimes(2);
  });

  it('refuses a file of another kind before anything is sent', async () => {
    const gateway = createMockProfileGateway();
    setUp(gateway);
    await how('applications.howFile');

    await userEvent.upload(
      document.querySelector('input[type=file]') as HTMLInputElement,
      new File(['x'], 'photo.png', { type: 'image/png' }),
      { applyAccept: false },
    );

    expect(
      await screen.findByText('addResource.fileTypeError'),
    ).toBeInTheDocument();
    expect(add()).toBeDisabled();
  });

  it.each([
    [ProfileErrorCode.MaxApplications, 'applications.maxMessage'],
    [ProfileErrorCode.DailyLimit, 'applications.jobLimitMessage'],
    [ProfileErrorCode.FlagOff, 'applications.notAvailableMessage'],
    [ProfileErrorCode.Network, 'applications.failedMessage'],
  ])(
    'says why it could not be added (%s), and logs the code only',
    async (code, message) => {
      const gateway = createMockProfileGateway();
      gateway.createApplication.mockRejectedValue(new ProfileError(code));
      setUp(gateway);

      await userEvent.type(
        screen.getByRole('textbox', { name: 'applications.jobLabel' }),
        'Job',
      );
      await userEvent.click(add());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(
        [
          ...mockLogger.logMessage.mock.calls.map(([text]) => text),
          ...mockLogger.logError.mock.calls.map(([error]) => String(error)),
        ].some(text =>
          String(text).includes(
            `createApplication failed: code=${code} uid=uid-1`,
          ),
        ),
      ).toBe(true);
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

  it('leaves the job out while its posting is read again, and says a posting’s copy is replaced by reading it again', () => {
    const posting = applicationFixture({
      job: { source: 'link', status: 'ready', edited: false },
    });
    const { unmount } = renderProfilePage(
      <EditApplicationPanel application={posting} onClose={vi.fn()} />,
    );
    expect(
      screen.getByText('applications.jobCopyEditHint'),
    ).toBeInTheDocument();
    unmount();

    renderProfilePage(
      <EditApplicationPanel
        application={{
          ...posting,
          job: {
            ...posting.job!,
            refresh: { status: 'reading', startedAt: Date.now() },
          },
        }}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('textbox', { name: 'applications.jobLabel' }),
    ).not.toBeInTheDocument();
  });

  it('leaves the job out while it is being read, and saves the rest', async () => {
    const gateway = createMockProfileGateway();
    const reading = applicationFixture({
      title: '',
      jobDescription: undefined,
      job: { source: 'link', status: 'reading', edited: false },
    });
    const onClose = vi.fn();
    renderProfilePage(
      <EditApplicationPanel application={reading} onClose={onClose} />,
      {
        gateway,
        applications: {
          uid: 'uid-1',
          status: 'loaded',
          applications: [reading],
        },
      },
    );

    expect(
      screen.queryByRole('textbox', { name: 'applications.jobLabel' }),
    ).not.toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'applications.titleLabel' }),
      'Platform Engineer',
    );
    await userEvent.click(save());

    await waitFor(() =>
      expect(gateway.updateApplication).toHaveBeenCalledExactlyOnceWith({
        applicationId: 'a1',
        title: 'Platform Engineer',
      }),
    );
  });

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
      name: 'textPreview.showAll',
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('textPreview.showLess');
  });

  it.each([
    [
      { source: 'file' as const, fileName: 'northwind.pdf' },
      'applications.jobReadFrom',
    ],
    [{ source: 'link' as const }, 'applications.jobCopyTakenOn'],
    [{ source: 'text' as const }, 'applications.jobPastedOn'],
  ])('says where the job came from (%o)', (from, line) => {
    renderProfilePage(
      <JobCard
        application={applicationFixture({
          job: { ...from, status: 'ready', edited: true, takenAt: 1 },
        })}
      />,
    );

    expect(
      screen.getByRole('region', { name: 'applications.jobTitle' }),
    ).toHaveTextContent(`${line} applications.jobEditedHint`);
  });

  it('says when the job was pasted, or only that it was', () => {
    renderProfilePage(
      <JobCard application={applicationFixture({ createdAt: null })} />,
    );

    expect(screen.getByText('applications.jobPasted')).toBeInTheDocument();
  });

  describe('a posting read again', () => {
    const readAgain = (overrides: Partial<ReadPostingAgain> = {}) => ({
      start: vi.fn(() => Promise.resolve()),
      confirming: false,
      confirm: vi.fn(() => Promise.resolve()),
      cancel: vi.fn(),
      busy: false,
      ...overrides,
    });
    const posting = (
      overrides: Partial<NonNullable<JobApplication['job']>> = {},
      brief = true,
    ) =>
      applicationFixture({
        brief: brief
          ? {
              requirements: [],
              questions: [],
              applicationRevision: 1,
              profileRevision: 0,
              builtAt: 1,
            }
          : undefined,
        postingUrl: 'https://careers.northwind.example/sbe',
        job: {
          source: 'link',
          status: 'ready',
          edited: false,
          takenAt: 1,
          ...overrides,
        },
      });

    it('reads it again on request, saying what it does to the brief', async () => {
      const reread = readAgain();
      renderProfilePage(<JobCard application={posting()} readAgain={reread} />);

      expect(
        screen.getByText('applications.rereadPostingBriefHint'),
      ).toBeInTheDocument();
      await userEvent.click(
        screen.getByRole('button', {
          name: 'applications.rereadPostingButton',
        }),
      );

      expect(reread.start).toHaveBeenCalledOnce();
    });

    it('says the posting is being read again, and that the copy stays', () => {
      renderProfilePage(
        <JobCard
          application={posting({
            refresh: { status: 'reading', startedAt: Date.now() },
          })}
          readAgain={readAgain()}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'applications.rereadingPostingTitle',
      );
      expect(
        screen.queryByRole('button', {
          name: 'applications.rereadPostingButton',
        }),
      ).not.toBeInTheDocument();
    });

    it.each([
      [{ changed: true }, true, 'applications.postingChangedBriefMessage'],
      [{ changed: true }, false, 'applications.postingChangedMessage'],
      [{ changed: false }, true, 'applications.postingUnchangedMessage'],
      [
        { status: 'failed' as const, failure: 'link-unreadable' as const },
        true,
        'applications.postingGoneBriefMessage',
      ],
      [
        { status: 'failed' as const, failure: 'link-unreadable' as const },
        false,
        'applications.postingGoneMessage',
      ],
    ])('says how it went (%o, a brief: %s)', (refresh, brief, message) => {
      renderProfilePage(
        <JobCard
          application={posting(
            {
              refresh: {
                status: 'done',
                startedAt: Date.now() - 60_000,
                finishedAt: Date.now() - 30_000,
                ...refresh,
              },
            },
            brief,
          )}
          readAgain={readAgain()}
        />,
      );

      expect(
        screen.getByRole('region', { name: 'applications.jobTitle' }),
      ).toHaveTextContent(message);
    });

    it('offers nothing to read again for a pasted job', () => {
      renderProfilePage(<JobCard application={applicationFixture()} />);

      expect(
        screen.queryByRole('button', {
          name: 'applications.rereadPostingButton',
        }),
      ).not.toBeInTheDocument();
    });
  });
});

describe('DetailsTab, reading a posting again', () => {
  const edited = applicationFixture({
    postingUrl: 'https://careers.northwind.example/sbe',
    job: { source: 'link', status: 'ready', edited: true, takenAt: 1 },
  });
  const setUp = (gateway = createMockProfileGateway()) =>
    renderProfilePage(<DetailsTab application={edited} />, {
      gateway,
      applications: { uid: 'uid-1', status: 'loaded', applications: [edited] },
    });

  it('asks before replacing a text the candidate edited, then reads it again over it', async () => {
    const gateway = createMockProfileGateway();
    setUp(gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.rereadPostingButton' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'applications.replaceDialogTitle',
    });
    expect(gateway.readPostingAgain).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'applications.replaceConfirmButton',
      }),
    );

    expect(gateway.readPostingAgain).toHaveBeenCalledExactlyOnceWith(
      edited.id,
      { replaceEdited: true },
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('leaves the text as it is on "Cancel"', async () => {
    const gateway = createMockProfileGateway();
    setUp(gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.rereadPostingButton' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'applications.cancelButton' }),
    );

    expect(
      screen.queryByRole('dialog', { name: 'applications.replaceDialogTitle' }),
    ).not.toBeInTheDocument();
    expect(gateway.readPostingAgain).not.toHaveBeenCalled();
  });
});
