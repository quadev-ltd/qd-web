import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { JobStatusPanel } from './JobStatusPanel';

import { type ApplicationJob } from '@/core/profile/applications';

const job = (overrides: Partial<ApplicationJob>): ApplicationJob => ({
  source: 'link',
  status: 'reading',
  edited: false,
  ...overrides,
});

const panel = (
  value: ApplicationJob,
  postingUrl = 'https://northwind.example/jobs/1482',
) => {
  const onPaste = vi.fn();
  render(
    <JobStatusPanel
      application={{ job: value, postingUrl }}
      onPaste={onPaste}
    />,
  );
  return { onPaste };
};

describe('JobStatusPanel', () => {
  it('says the job is being read, with a turning ring', () => {
    panel(job({ status: 'reading' }));

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('applications.readingJobTitle');
    expect(status).toHaveTextContent('applications.readingJobDescription');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('says the file has not arrived yet', () => {
    panel(job({ source: 'file', status: 'awaitingUpload' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'applications.waitingJobTitle',
    );
  });

  it('says a posting could not be read, with "Paste the text instead" and the posting to open', async () => {
    const { onPaste } = panel(
      job({ status: 'failed', failure: 'link-unreadable' }),
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'applications.pageUnreadableTitle',
    );
    expect(
      screen.getByRole('link', { name: 'applications.openPostingLink' }),
    ).toHaveAttribute('href', 'https://northwind.example/jobs/1482');
    await userEvent.click(
      screen.getByRole('button', { name: 'applications.pasteInsteadButton' }),
    );
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it('says a file could not be read, with no posting to open', () => {
    panel(job({ source: 'file', status: 'failed', failure: 'empty' }), '');

    expect(screen.getByRole('status')).toHaveTextContent(
      'applications.fileUnreadableTitle',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('says any other failure as the job not read', () => {
    panel(job({ source: 'text', status: 'failed', failure: 'model' }), '');

    expect(screen.getByRole('status')).toHaveTextContent(
      'applications.jobUnreadableTitle',
    );
  });
});
