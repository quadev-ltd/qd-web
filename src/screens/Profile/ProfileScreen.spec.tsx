import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { ProfileScreen } from './ProfileScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type ApplicationsState } from '@/core/state/slices/applicationsSlice';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const loaded = (
  overrides: Partial<InterviewProfileState> = {},
): Partial<InterviewProfileState> => ({
  uid: 'uid-1',
  status: 'loaded',
  resources: [resourceFixture()],
  ...overrides,
});

/** The applications as read: none, or one. */
const applicationsRead = (count: 0 | 1): Partial<ApplicationsState> => ({
  uid: 'uid-1',
  status: 'loaded',
  applications: count ? [applicationFixture()] : [],
});

const Location = () => {
  const { pathname, state } = useLocation();
  return <p>{`at ${pathname} ${JSON.stringify(state)}`}</p>;
};

const addButton = () =>
  screen.queryByRole('button', { name: 'profile.addResourceButton' });

describe('ProfileScreen', () => {
  it('has the page heading, says what the profile is for and sits in the signed-in frame', () => {
    renderProfilePage(<ProfileScreen />, {
      interviewProfile: loaded(),
      applications: applicationsRead(1),
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'profile.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('profile.description')).toBeInTheDocument();
    expect(document.title).toBe('profile.documentTitle');
    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  describe("a new account's start (D58, D91)", () => {
    const renderStart = ({
      resources = [],
      applications,
      flags,
    }: {
      resources?: ReturnType<typeof resourceFixture>[];
      applications?: Partial<ApplicationsState>;
      flags?: { cvTool?: boolean };
    }) =>
      renderProfilePage(
        <Routes>
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="*" element={<Location />} />
        </Routes>,
        { interviewProfile: loaded({ resources }), applications, flags },
      );

    const paths = () =>
      screen.queryByRole('region', { name: 'home.pathsTitle' });

    it('welcomes an account with neither resources nor applications, then the empty profile and the three paths', () => {
      renderStart({ applications: applicationsRead(0) });

      expect(
        screen.getByRole('heading', { level: 1, name: 'profile.welcomeTitle' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('profile.welcomeDescription'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 2, name: 'profile.emptyTitle' }),
      ).toBeInTheDocument();
      expect(
        within(paths() as HTMLElement)
          .getAllByRole('article')
          .map(card => card.textContent),
      ).toEqual([
        'home.prepareTitlehome.prepareDescription',
        'home.practiseTitlehome.practiseDescriptionhome.comingSoonChip',
        'home.improveCvTitlehome.improveCvDescriptionhome.comingSoonChip',
      ]);
    });

    it('keeps the paths under the list once there are resources, until the first application', () => {
      renderStart({
        resources: [resourceFixture({ title: 'Maya Okafor CV 2026' })],
        applications: applicationsRead(0),
      });

      expect(
        screen.getByRole('heading', { level: 1, name: 'profile.title' }),
      ).toBeInTheDocument();
      const list = screen.getByRole('list');
      expect(
        list.compareDocumentPosition(paths() as HTMLElement) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('has no paths once there is an application', () => {
      renderStart({
        resources: [resourceFixture()],
        applications: applicationsRead(1),
      });

      expect(paths()).not.toBeInTheDocument();
    });

    it('gives an account with applications but no resources the profile’s own heading, its empty state and no paths', () => {
      renderStart({ applications: applicationsRead(1) });

      expect(
        screen.getByRole('heading', { level: 1, name: 'profile.title' }),
      ).toBeInTheDocument();
      expect(screen.getByText('profile.emptyTitle')).toBeInTheDocument();
      expect(paths()).not.toBeInTheDocument();
    });

    it('waits for the applications before it welcomes, and uses the profile’s heading when they cannot be read', async () => {
      const gateway = createMockProfileGateway();
      let fail: (error: unknown) => void = () => {};
      gateway.getApplications.mockReturnValue(
        new Promise((_, reject) => {
          fail = reject;
        }),
      );
      renderProfilePage(<ProfileScreen />, {
        gateway,
        interviewProfile: loaded({ resources: [] }),
      });

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1 })).toBeNull();

      fail(new ProfileError(ProfileErrorCode.Unknown));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'profile.title' }),
      ).toBeInTheDocument();
      expect(screen.getByText('profile.emptyTitle')).toBeInTheDocument();
      expect(paths()).not.toBeInTheDocument();
    });

    it('opens Applications with "New application" from "Prepare for a job"', async () => {
      renderStart({ applications: applicationsRead(0) });

      await userEvent.click(
        screen.getByRole('button', { name: /home\.prepareTitle/ }),
      );

      expect(
        screen.getByText('at /applications {"add":"application"}'),
      ).toBeInTheDocument();
    });

    it('opens the CV section from "Improve your CV" with the CV tool', async () => {
      renderStart({
        applications: applicationsRead(0),
        flags: { cvTool: true },
      });

      await userEvent.click(
        screen.getByRole('button', { name: /home\.improveCvTitle/ }),
      );

      expect(screen.getByText('at /cv null')).toBeInTheDocument();
    });
  });

  describe('while the profile is being read', () => {
    it('shows a spinner and nothing to add yet', () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockReturnValue(new Promise(() => {}));
      renderProfilePage(<ProfileScreen />, { gateway });

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(addButton()).not.toBeInTheDocument();
      expect(screen.queryByText('profile.emptyTitle')).not.toBeInTheDocument();
    });
  });

  describe('when the profile cannot be read', () => {
    it('says so, and reads it again on "Try again"', async () => {
      const { gateway } = renderProfilePage(<ProfileScreen />, {
        interviewProfile: { uid: 'uid-1', status: 'error' },
      });
      gateway.getResources.mockResolvedValue([resourceFixture()]);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('profile.loadErrorMessage');
      expect(addButton()).not.toBeInTheDocument();

      await userEvent.click(
        within(alert).getByRole('button', { name: 'profile.retryButton' }),
      );

      expect(
        await screen.findByText('Maya Okafor CV 2026'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('says so after a read that fails', async () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );
      renderProfilePage(<ProfileScreen />, { gateway });

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'profile.loadErrorMessage',
      );
      expect(screen.queryByText('profile.emptyTitle')).not.toBeInTheDocument();
    });
  });

  describe('an empty profile', () => {
    it('invites to start with the CV, with two ways in and no button in the heading', async () => {
      renderProfilePage(<ProfileScreen />);

      expect(
        await screen.findByRole('heading', {
          level: 2,
          name: 'profile.emptyTitle',
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('profile.emptyDescription')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'profile.addCvButton' }),
      ).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'profile.addSomethingElseButton' }),
      ).toBeEnabled();
      expect(addButton()).not.toBeInTheDocument();
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('opens "Add your CV": a file or pasted text, no link', async () => {
      renderProfilePage(<ProfileScreen />);

      await userEvent.click(
        await screen.findByRole('button', { name: 'profile.addCvButton' }),
      );

      const panel = screen.getByRole('dialog', {
        name: 'addResource.cvChoiceTitle',
      });
      expect(panel).toHaveTextContent('addResource.cvChoiceDescription');
      expect(
        within(panel).getByRole('button', {
          name: /addResource\.fileOptionTitle/,
        }),
      ).toBeInTheDocument();
      expect(
        within(panel).getByRole('button', {
          name: /addResource\.textOptionTitle/,
        }),
      ).toHaveTextContent('addResource.cvTextOptionDescription');
      expect(
        within(panel).queryByRole('button', {
          name: /addResource\.linkOptionTitle/,
        }),
      ).not.toBeInTheDocument();
    });

    it('opens "Add to your profile" for something else: a file, text or a link', async () => {
      renderProfilePage(<ProfileScreen />);

      await userEvent.click(
        await screen.findByRole('button', {
          name: 'profile.addSomethingElseButton',
        }),
      );

      const panel = screen.getByRole('dialog', {
        name: 'addResource.choiceTitle',
      });
      expect(panel).toHaveTextContent('addResource.choiceDescription');
      expect(within(panel).getAllByRole('button')).toHaveLength(4);
      expect(
        within(panel).getByRole('button', {
          name: /addResource\.linkOptionTitle/,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('opened by "Add your CV" from another page', () => {
    it('opens the CV panel at once, and only once', async () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ resources: [] }),
        routeState: { add: 'cv' },
      });

      expect(
        screen.getByRole('dialog', { name: 'addResource.cvChoiceTitle' }),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'sidePanel.closeAccessibilityLabel',
        }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('opens nothing for a link that asks for something else', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded(),
        routeState: { add: 'everything' },
      });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('a profile with resources', () => {
    it('reads the resources through the gateway, and not the items read from them', async () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockResolvedValue([
        resourceFixture({ id: 'a', title: 'Maya Okafor CV 2026' }),
      ]);
      renderProfilePage(<ProfileScreen />, { gateway });

      expect(
        await screen.findByText('Maya Okafor CV 2026'),
      ).toBeInTheDocument();
      expect(gateway.getResources).toHaveBeenCalledExactlyOnceWith('uid-1');
      expect(gateway.getItems).not.toHaveBeenCalled();
    });

    it('shows the list and "Add a resource", and nothing else', () => {
      renderProfilePage(<ProfileScreen />, {
        applications: applicationsRead(1),
        interviewProfile: loaded({
          resources: [
            resourceFixture({ id: 'a', title: 'Maya Okafor CV 2026' }),
            resourceFixture({
              id: 'b',
              title: 'Stories for interviews',
              type: 'note',
              status: 'failed',
              failure: 'empty',
            }),
          ],
        }),
      });

      expect(
        screen.getAllByRole('listitem').map(row => row.textContent),
      ).toEqual([
        'profile.typeCvMaya Okafor CV 2026profile.statusReady',
        'profile.typeNoteStories for interviewsprofile.failedEmpty',
      ]);
      expect(
        screen.getAllByRole('heading').map(heading => heading.textContent),
      ).toEqual(['profile.title', 'profile.resourcesTitle']);
      expect(addButton()).toBeEnabled();
      expect(screen.queryByText('profile.emptyTitle')).not.toBeInTheDocument();
      expect(screen.queryByRole('status', { name: /spinner/ })).toBeNull();
    });

    it('opens the panel from "Add a resource" and closes it again', async () => {
      renderProfilePage(<ProfileScreen />, { interviewProfile: loaded() });

      await userEvent.click(addButton() as HTMLElement);
      expect(
        screen.getByRole('dialog', { name: 'addResource.choiceTitle' }),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', {
          name: 'sidePanel.closeAccessibilityLabel',
        }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('the limits', () => {
    const twenty = Array.from({ length: 20 }, (_, index) =>
      resourceFixture({ id: `r${index}`, createdAt: index }),
    );

    it('says the profile is full at twenty resources, and adds no more', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ resources: twenty }),
      });

      expect(screen.getByText('profile.fullMessage')).toBeInTheDocument();
      expect(addButton()).toBeDisabled();
      expect(screen.queryByText('profile.dailyLimitMessage')).toBeNull();
    });

    it('says nothing at nineteen', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ resources: twenty.slice(1) }),
      });

      expect(screen.queryByText('profile.fullMessage')).not.toBeInTheDocument();
      expect(addButton()).toBeEnabled();
    });

    it('says today’s limit is reached once twenty resources were read today', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ extractionsToday: 20 }),
      });

      expect(screen.getByText('profile.dailyLimitMessage')).toBeInTheDocument();
      expect(addButton()).toBeDisabled();
    });

    it('says the same once the backend has refused for today’s limit', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({
          extractionsToday: 3,
          dailyLimitRefused: true,
        }),
      });

      expect(screen.getByText('profile.dailyLimitMessage')).toBeInTheDocument();
      expect(addButton()).toBeDisabled();
    });

    it('says only that the profile is full when both limits are reached', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ resources: twenty, extractionsToday: 20 }),
      });

      expect(screen.getByText('profile.fullMessage')).toBeInTheDocument();
      expect(screen.queryByText('profile.dailyLimitMessage')).toBeNull();
    });

    it('keeps an empty profile from adding once today’s limit is reached', () => {
      renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded({ resources: [], extractionsToday: 20 }),
        applications: applicationsRead(0),
      });

      expect(screen.getByText('profile.dailyLimitMessage')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'profile.addCvButton' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'profile.addSomethingElseButton' }),
      ).toBeDisabled();
    });
  });

  describe('adding a resource', () => {
    it('adds pasted text: the panel closes and the list shows it being read', async () => {
      const { gateway, store } = renderProfilePage(<ProfileScreen />, {
        interviewProfile: loaded(),
      });
      gateway.createResource.mockResolvedValue({ resourceId: 'new' });
      gateway.getResource.mockResolvedValue(
        resourceFixture({
          id: 'new',
          type: 'note',
          title: 'Stories for interviews',
          source: 'text',
          status: 'processing',
          itemCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      );

      await userEvent.click(addButton() as HTMLElement);
      await userEvent.click(
        screen.getByRole('button', { name: /addResource\.textOptionTitle/ }),
      );
      await userEvent.type(
        screen.getByLabelText('addResource.titleLabel'),
        ' Stories for interviews ',
      );
      await userEvent.type(
        screen.getByLabelText('addResource.textLabel'),
        'A launch delay.',
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'addResource.submitButton' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      expect(gateway.createResource).toHaveBeenCalledExactlyOnceWith({
        source: 'text',
        type: 'note',
        title: 'Stories for interviews',
        text: 'A launch delay.',
      });
      expect(
        screen.getAllByRole('listitem').map(row => row.textContent),
      ).toEqual([
        'profile.typeNoteStories for interviewsprofile.statusProcessing',
        'profile.typeCvMaya Okafor CV 2026profile.statusReady',
      ]);
      expect(store.getState().interviewProfile.extractionsToday).toBe(1);
    });
  });
});
