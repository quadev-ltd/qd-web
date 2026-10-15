import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { ApplicationScreen } from './ApplicationScreen';

import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const setUp = (
  applications: Partial<ApplicationsState>,
  gateway = createMockProfileGateway(),
) =>
  renderProfilePage(
    <Routes>
      <Route
        path="/applications/:applicationId"
        element={<ApplicationScreen tab="details" />}
      />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route: '/applications/a1',
      interviewProfile: { uid: 'uid-1', status: 'loaded' },
      applications,
    },
  );

const loaded = (application = applicationFixture()) => ({
  uid: 'uid-1',
  status: 'loaded' as const,
  applications: [application],
});

const details = () =>
  screen.getByRole('region', { name: 'applications.detailsTitle' });

describe('ApplicationScreen', () => {
  it('names the application and its company, and leads back home', () => {
    setUp(loaded());

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Senior Backend Engineer',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Northwind Logistics').length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole('link', { name: 'applications.backLink' }),
    ).toHaveAttribute('href', '/home');
    expect(document.title).toBe('applications.documentTitle');
  });

  it('shows its details, only the ones it has, and its posting as a link to open in another tab', () => {
    setUp(
      loaded(
        applicationFixture({
          role: 'Backend, parcel tracking',
          postingUrl: 'https://northwind.example/careers/1482',
          notes: 'Two technical rounds.',
        }),
      ),
    );

    expect(details()).toHaveTextContent(
      'applications.titleFieldSenior Backend Engineer',
    );
    expect(details()).toHaveTextContent(
      'applications.roleLabelBackend, parcel tracking',
    );
    expect(details()).toHaveTextContent(
      'applications.notesLabelTwo technical rounds.',
    );
    const posting = within(details()).getByRole('link', {
      name: 'northwind.example/careers/1482',
    });
    expect(posting).toHaveAttribute(
      'href',
      'https://northwind.example/careers/1482',
    );
    expect(posting).toHaveAttribute('target', '_blank');
  });

  it('leaves out what it does not have, and never links an address that is not a public page', () => {
    setUp(
      loaded(
        applicationFixture({
          company: undefined,
          postingUrl: 'javascript:alert(1)',
        }),
      ),
    );

    expect(details()).not.toHaveTextContent('applications.companyLabel');
    expect(details()).not.toHaveTextContent('applications.postingLabel');
    expect(within(details()).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the job, pasted', () => {
    setUp(loaded());

    const job = screen.getByRole('region', { name: 'applications.jobTitle' });
    expect(job).toHaveTextContent('applications.jobPastedOn');
    expect(job).toHaveTextContent('Northwind Logistics is looking for');
  });

  it('opens "Edit the application"', async () => {
    setUp(loaded());

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.editButton' }),
    );

    expect(
      screen.getByRole('dialog', { name: 'applications.editTitle' }),
    ).toBeInTheDocument();
  });

  it('is removed after asking, then the home takes its place', async () => {
    const gateway = createMockProfileGateway();
    const { store } = setUp(loaded(), gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.removeLink' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'applications.removeDialogTitle',
    });
    expect(gateway.removeApplication).not.toHaveBeenCalled();
    await userEvent.click(
      within(dialog).getByRole('button', {
        name: 'applications.removeConfirmButton',
      }),
    );

    expect(await screen.findByText('at /home')).toBeInTheDocument();
    expect(gateway.removeApplication).toHaveBeenCalledExactlyOnceWith('a1');
    expect(store.getState().applications.applications).toEqual([]);
  });

  it('has a tab for its brief and one for its details, the open one marked', () => {
    setUp(loaded());

    const tabs = screen.getByRole('navigation', {
      name: 'applications.tabsLabel',
    });
    expect(
      within(tabs).getByRole('link', { name: 'applications.briefTab' }),
    ).toHaveAttribute('href', '/applications/a1');
    const details = within(tabs).getByRole('link', {
      name: 'applications.detailsTab',
    });
    expect(details).toHaveAttribute('href', '/applications/a1/details');
  });

  it('says so when the application is not in the list', () => {
    setUp(loaded(applicationFixture({ id: 'other' })));

    expect(
      screen.getByRole('heading', { name: 'applications.notFoundTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'applications.notFoundLink' }),
    ).toHaveAttribute('href', '/home');
  });

  it('waits while the applications are read', () => {
    setUp({ uid: 'uid-1', status: 'loading' });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('says the applications could not be read, and reads them again', async () => {
    const gateway = createMockProfileGateway();
    gateway.getApplications.mockResolvedValue([applicationFixture()]);
    setUp({ uid: 'uid-1', status: 'error' }, gateway);

    await userEvent.click(
      screen.getByRole('button', { name: 'applications.retryButton' }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'Senior Backend Engineer',
        }),
      ).toBeInTheDocument(),
    );
  });
});
