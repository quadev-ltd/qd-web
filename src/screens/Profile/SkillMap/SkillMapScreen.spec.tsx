import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { SkillMapScreen } from './SkillMapScreen';

import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const Location = () => {
  const { pathname, state } = useLocation();
  return <p>{`at ${pathname} ${JSON.stringify(state)}`}</p>;
};

const cv = resourceFixture({ id: 'r1', title: 'Maya Okafor CV 2026' });
const review = resourceFixture({
  id: 'r2',
  title: 'Performance review 2025',
  type: 'document',
});
const items = [
  itemFixture({
    id: 'go',
    kind: 'skill',
    text: 'Go and PostgreSQL',
    createdAt: 1,
  }),
  itemFixture({
    id: 'queue',
    kind: 'skill',
    text: 'Event-driven design',
    createdAt: 2,
  }),
  itemFixture({
    id: 'sql',
    kind: 'skill',
    text: 'SQL for analytics',
    createdAt: 3,
  }),
  itemFixture({
    id: 'k8s',
    kind: 'skill',
    text: 'Runs services in containers',
    createdAt: 4,
  }),
  itemFixture({
    id: 'incidents',
    kind: 'achievement',
    text: 'Cut payment incidents by 40%',
    starred: true,
    edited: true,
    createdAt: 5,
  }),
  itemFixture({
    id: 'mentor',
    kind: 'story',
    text: 'Mentored two engineers',
    resourceId: 'r2',
    createdAt: 6,
  }),
  itemFixture({
    id: 'left',
    kind: 'experience',
    text: 'Left Fenwick Pay after the reorganisation',
    hidden: true,
    createdAt: 7,
  }),
];

const setUp = (
  overrides: Partial<InterviewProfileState> = {},
  route = '/profile/skill-map',
  gateway = createMockProfileGateway(),
) =>
  renderProfilePage(
    <Routes>
      <Route path="/profile/skill-map/:itemId?" element={<SkillMapScreen />} />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [cv, review],
        items,
        ...overrides,
      },
    },
  );

const group = (name: string) =>
  screen
    .getByRole('heading', { level: 2, name })
    .closest('section') as HTMLElement;
const rowTexts = (container: HTMLElement = document.body) =>
  within(container)
    .getAllByRole('listitem')
    .map(row => row.textContent);
const kindButton = (name: RegExp) =>
  within(
    screen.getByRole('group', { name: 'skillMap.kindGroupLabel' }),
  ).getByRole('button', { name });

describe('SkillMapScreen', () => {
  it('has its heading, the way back to the profile and the size of the map', () => {
    setUp();

    expect(
      screen.getByRole('heading', { level: 1, name: 'skillMap.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('skillMap.summary')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'resource.backLink' }),
    ).toHaveAttribute('href', '/profile');
    expect(document.title).toBe('skillMap.documentTitle');
  });

  describe('everything, by kind', () => {
    it('groups the items by kind in the order of the skill map, without the hidden ones', () => {
      setUp();

      expect(
        screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent),
      ).toEqual([
        'profile.kindSkills',
        'profile.kindAchievements',
        'profile.kindStories',
      ]);
      expect(screen.queryByText(/Left Fenwick Pay/)).not.toBeInTheDocument();
    });

    it('shows three of a kind, newest first, and the rest on "Show all"', async () => {
      setUp();
      const skills = group('profile.kindSkills');

      expect(rowTexts(skills)).toEqual([
        'Runs services in containersresource.itemSource',
        'SQL for analyticsresource.itemSource',
        'Event-driven designresource.itemSource',
      ]);

      await userEvent.click(
        within(skills).getByRole('button', { name: 'skillMap.showAllButton' }),
      );

      expect(kindButton(/profile\.kindSkills/)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(rowTexts()).toHaveLength(4);
      expect(screen.getByText('skillMap.resultCount')).toBeInTheDocument();
    });

    it('marks a starred and edited item, and leads to each item', () => {
      setUp();

      const row = within(group('profile.kindAchievements')).getByRole('link');
      expect(row).toHaveAttribute('href', '/profile/skill-map/incidents');
      expect(row).toHaveTextContent('resource.editedChip');
      expect(
        within(row).getByRole('img', {
          name: 'resource.starredAccessibilityLabel',
        }),
      ).toBeInTheDocument();
    });

    it('counts each kind next to its filter', () => {
      setUp();

      expect(kindButton(/skillMap\.kindAll/)).toHaveTextContent('6');
      expect(kindButton(/profile\.kindSkills/)).toHaveTextContent('4');
      expect(kindButton(/profile\.kindExperience/)).toHaveTextContent('0');
      expect(kindButton(/profile\.kindStories/)).toHaveTextContent('1');
    });
  });

  describe('filtered', () => {
    it('lists what the filters leave in one list, with its kind on each item', async () => {
      setUp();

      await userEvent.click(
        screen.getByRole('button', { name: 'skillMap.starredFilter' }),
      );

      expect(rowTexts()).toEqual([
        'Cut payment incidents by 40%resource.itemSourceresource.kindAchievementresource.editedChip',
      ]);
      expect(screen.getByText('skillMap.resultCount')).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { level: 2 }),
      ).not.toBeInTheDocument();
    });

    it('searches what the items say', async () => {
      setUp();

      await userEvent.type(
        screen.getByRole('searchbox', { name: 'skillMap.searchLabel' }),
        'postgres',
      );

      expect(rowTexts()).toEqual([
        'Go and PostgreSQLresource.itemSourceresource.kindSkill',
      ]);
      expect(kindButton(/skillMap\.kindAll/)).toHaveTextContent('1');
    });

    it('narrows to the items of one resource', async () => {
      setUp();

      await userEvent.selectOptions(
        screen.getByLabelText('skillMap.sourceLabel'),
        'Performance review 2025',
      );

      expect(rowTexts()).toHaveLength(1);
      expect(screen.getByText('Mentored two engineers')).toBeInTheDocument();
    });

    it('shows the hidden items, and says they are never used', async () => {
      setUp();

      await userEvent.click(
        screen.getByRole('button', { name: 'skillMap.hiddenFilter' }),
      );

      expect(screen.getByText('skillMap.hiddenCount')).toBeInTheDocument();
      expect(rowTexts()).toEqual([
        'Left Fenwick Pay after the reorganisationresource.itemSourceresource.kindExperienceresource.hiddenChip',
      ]);
    });

    it('says when nothing matches a search, and clears everything on request', async () => {
      setUp();
      await userEvent.click(
        screen.getByRole('button', { name: 'skillMap.editedFilter' }),
      );
      await userEvent.type(screen.getByRole('searchbox'), 'kubernetes');

      expect(
        screen.getByRole('heading', { name: 'skillMap.noResultTitle' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText('skillMap.noResultSearchDescription'),
      ).toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('button', { name: 'skillMap.clearButton' }),
      );

      expect(screen.getByRole('searchbox')).toHaveValue('');
      expect(
        screen.getByRole('button', { name: 'skillMap.editedFilter' }),
      ).toHaveAttribute('aria-pressed', 'false');
      expect(group('profile.kindSkills')).toBeInTheDocument();
    });

    it('says when nothing matches the filters alone', async () => {
      setUp({ items: items.filter(item => !item.hidden) });

      await userEvent.click(
        screen.getByRole('button', { name: 'skillMap.hiddenFilter' }),
      );

      expect(
        screen.getByText('skillMap.noResultDescription'),
      ).toBeInTheDocument();
    });
  });

  describe('one item', () => {
    it('stands beside the list, marked in it, with the way back to the map for a narrow screen', () => {
      setUp({}, '/profile/skill-map/incidents');

      const panel = screen.getByRole('complementary', {
        name: 'skillMap.selectedItemAccessibilityLabel',
      });
      expect(panel).toHaveTextContent('Cut payment incidents by 40%');
      expect(
        within(panel).getByRole('button', { name: 'item.editButton' }),
      ).toBeInTheDocument();
      expect(
        within(group('profile.kindAchievements')).getByRole('link'),
      ).toHaveAttribute('aria-current', 'true');
      expect(
        screen.getByRole('link', { name: 'skillMap.backLink' }),
      ).toHaveAttribute('href', '/profile/skill-map');
      expect(document.title).toBe('item.documentTitle');
    });

    it('keeps the filters while items are opened', async () => {
      setUp();
      await userEvent.click(kindButton(/profile\.kindSkills/));

      await userEvent.click(
        screen.getByRole('link', { name: /SQL for analytics/ }),
      );

      expect(screen.getByRole('complementary')).toHaveTextContent(
        'SQL for analytics',
      );
      expect(kindButton(/profile\.kindSkills/)).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(rowTexts()).toHaveLength(4);
    });

    it('changes in the list as soon as the backend has accepted a change', async () => {
      setUp({}, '/profile/skill-map/go');

      await userEvent.click(
        screen.getByRole('switch', { name: 'item.starLabel' }),
      );

      await waitFor(() =>
        expect(
          within(
            within(group('profile.kindSkills')).getByRole('link', {
              name: /Go and PostgreSQL/,
            }),
          ).getByRole('img', { name: 'resource.starredAccessibilityLabel' }),
        ).toBeInTheDocument(),
      );
      // Starred items come first in their list.
      expect(rowTexts(group('profile.kindSkills'))[0]).toContain(
        'Go and PostgreSQL',
      );
    });

    it('goes back to the map when the item is removed', async () => {
      const gateway = createMockProfileGateway();
      const { store } = setUp({}, '/profile/skill-map/go', gateway);

      await userEvent.click(
        screen.getByRole('button', { name: 'item.removeLink' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'item.removeConfirmButton' }),
      );

      await waitFor(() =>
        expect(screen.queryByRole('complementary')).not.toBeInTheDocument(),
      );
      expect(gateway.removeItem).toHaveBeenCalledExactlyOnceWith('go');
      expect(
        store.getState().interviewProfile.items.map(({ id }) => id),
      ).not.toContain('go');
      expect(
        screen.getByRole('heading', { level: 1, name: 'skillMap.title' }),
      ).toBeInTheDocument();
    });

    it('says when the item is not in the skill map, with the way back', () => {
      setUp({}, '/profile/skill-map/nope');

      expect(
        screen.getByRole('heading', { level: 1, name: 'item.notFoundTitle' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'item.notFoundLink' }),
      ).toHaveAttribute('href', '/profile/skill-map');
    });
  });

  describe('when there is nothing to list', () => {
    it('invites to add a CV, and opens "Add your CV" on the profile', async () => {
      setUp({ resources: [], items: [] });

      expect(
        screen.getByRole('heading', { name: 'skillMap.emptyTitle' }),
      ).toBeInTheDocument();
      expect(screen.getByText('skillMap.emptyDescription')).toBeInTheDocument();
      expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

      await userEvent.click(
        screen.getByRole('link', { name: 'profile.addCvButton' }),
      );

      expect(screen.getByText('at /profile {"add":"cv"}')).toBeInTheDocument();
    });

    it('says the first resource is being read', () => {
      const reading = resourceFixture({
        id: 'r1',
        status: 'processing',
        itemCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const gateway = createMockProfileGateway();
      gateway.getResource.mockResolvedValue(reading);
      setUp({ resources: [reading], items: [] }, '/profile/skill-map', gateway);

      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('skillMap.readingTitle');
      expect(status).toHaveTextContent('skillMap.readingDescription');
      expect(screen.queryByText('skillMap.emptyTitle')).not.toBeInTheDocument();
    });

    it('says the map is empty when the resources added nothing', () => {
      setUp({
        resources: [
          resourceFixture({ status: 'failed', failure: 'empty', itemCount: 0 }),
        ],
        items: [],
      });

      expect(
        screen.getByRole('heading', { name: 'skillMap.emptyTitle' }),
      ).toBeInTheDocument();
    });

    it('waits while the profile is being read', () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockReturnValue(new Promise(() => {}));
      setUp(
        { uid: null, status: 'idle', resources: [], items: [] },
        '/profile/skill-map',
        gateway,
      );

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('skillMap.emptyTitle')).not.toBeInTheDocument();
    });

    it('says when the profile could not be read, and reads it again on "Try again"', async () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockResolvedValue([cv]);
      gateway.getItems.mockResolvedValue([items[0]]);
      setUp(
        { status: 'error', resources: [], items: [] },
        '/profile/skill-map',
        gateway,
      );

      expect(screen.getByRole('alert')).toHaveTextContent(
        'profile.loadErrorMessage',
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'profile.retryButton' }),
      );

      expect(await screen.findByText('Go and PostgreSQL')).toBeInTheDocument();
    });
  });
});
