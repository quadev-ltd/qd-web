import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ProfileScreen } from './ProfileScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
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

const addButton = () =>
  screen.queryByRole('button', { name: 'profile.addResourceButton' });

describe('ProfileScreen', () => {
  it('has the page heading, says what the profile is for and sits in the signed-in frame', async () => {
    renderProfilePage(<ProfileScreen />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'profile.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('profile.description')).toBeInTheDocument();
    expect(document.title).toBe('profile.documentTitle');
    expect(screen.getByRole('link', { name: 'profile.title' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await screen.findByText('profile.emptyTitle');
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
      expect(
        screen.queryByText('profile.skillMapTitle'),
      ).not.toBeInTheDocument();
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
    it('reads the profile through the gateway and lists it with the skill map', async () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockResolvedValue([
        resourceFixture({ id: 'a', title: 'Maya Okafor CV 2026' }),
      ]);
      gateway.getItems.mockResolvedValue([
        itemFixture({ id: '1', kind: 'skill' }),
        itemFixture({ id: '2', kind: 'skill' }),
      ]);
      renderProfilePage(<ProfileScreen />, { gateway });

      expect(
        await screen.findByText('Maya Okafor CV 2026'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('profile.kindSkills').parentElement,
      ).toHaveTextContent('2');
      expect(gateway.getResources).toHaveBeenCalledExactlyOnceWith('uid-1');
      expect(gateway.getItems).toHaveBeenCalledExactlyOnceWith('uid-1');
    });

    it('shows the list, the skill map and "Add a resource"', () => {
      renderProfilePage(<ProfileScreen />, {
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
          items: [
            itemFixture({ id: '1', kind: 'skill' }),
            itemFixture({ id: '2', kind: 'story' }),
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
        screen.getByRole('heading', { name: 'profile.skillMapTitle' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'profile.openSkillMapButton' }),
      ).toHaveAttribute('href', '/profile/skill-map');
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
