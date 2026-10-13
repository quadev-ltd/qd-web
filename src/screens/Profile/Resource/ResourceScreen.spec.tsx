import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { ResourceScreen } from './ResourceScreen';

import { type ProfileResource } from '@/core/profile/contract';
import { RESOURCE_WATCH_MS } from '@/core/profile/InterviewProfileProvider';
import { type InterviewProfileState } from '@/core/state/slices/interviewProfileSlice';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const NOW = Date.parse('2026-10-13T12:00:00Z');
const DAYS_AGO = Date.parse('2026-10-10T09:30:00Z');

const Location = () => <p>{`at ${useLocation().pathname}`}</p>;

const setUp = (
  resource: ProfileResource | null,
  overrides: Partial<InterviewProfileState> = {},
  gateway = createMockProfileGateway(),
) => {
  // What the profile's own polling reads again is what the page already has.
  gateway.getResource.mockImplementation(async (_uid, id) =>
    resource && resource.id === id ? resource : null,
  );
  return renderProfilePage(
    <Routes>
      <Route
        path="/profile/resources/:resourceId"
        element={<ResourceScreen />}
      />
      <Route path="*" element={<Location />} />
    </Routes>,
    {
      gateway,
      route: '/profile/resources/r1',
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: resource ? [resource] : [],
        ...overrides,
      },
    },
  );
};

const ready = (overrides: Partial<ProfileResource> = {}) =>
  resourceFixture({
    id: 'r1',
    createdAt: DAYS_AGO,
    updatedAt: DAYS_AGO,
    ...overrides,
  });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ResourceScreen', () => {
  describe('a resource that was read', () => {
    const items = [
      itemFixture({ id: 'i1', text: 'Go in production', createdAt: 1 }),
      itemFixture({
        id: 'i2',
        text: 'Cut incidents by 40%',
        createdAt: 2,
        starred: true,
        edited: true,
      }),
      itemFixture({
        id: 'other',
        text: 'From another resource',
        resourceId: 'r9',
      }),
    ];

    it('shows what it is, that it is ready and when it was added', () => {
      setUp(ready({ itemCount: 2 }), { items });

      expect(
        screen.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
      ).toBeInTheDocument();
      expect(screen.getAllByText('profile.typeCv').length).toBeGreaterThan(0);
      expect(screen.getByText('profile.statusReady')).toBeInTheDocument();
      expect(
        screen.getByText('resource.addedOn · resource.contentPdf'),
      ).toBeInTheDocument();
      expect(document.title).toBe('resource.documentTitle');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('lists the items that came from it: starred first, with their kind', () => {
      setUp(ready({ itemCount: 2 }), { items });

      const list = screen.getByRole('heading', { name: 'resource.itemsTitle' })
        .parentElement as HTMLElement;
      const rows = within(list).getAllByRole('listitem');
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent('Cut incidents by 40%');
      expect(rows[0]).toHaveTextContent('resource.editedChip');
      expect(rows[0]).toHaveTextContent('resource.kindAchievement');
      expect(rows[1]).toHaveTextContent('Go in production');
      expect(
        screen.queryByText('From another resource'),
      ).not.toBeInTheDocument();
    });

    it('shows five items, and the rest on "Show all"', async () => {
      const many = Array.from({ length: 7 }, (_, index) =>
        itemFixture({
          id: `i${index}`,
          text: `Fact ${index}`,
          createdAt: index,
        }),
      );
      setUp(ready({ itemCount: 7 }), { items: many });

      expect(screen.getAllByText(/^Fact \d$/)).toHaveLength(5);

      await userEvent.click(
        screen.getByRole('button', { name: 'resource.showAllButton' }),
      );

      expect(screen.getAllByText(/^Fact \d$/)).toHaveLength(7);
      expect(
        screen.queryByRole('button', { name: 'resource.showAllButton' }),
      ).not.toBeInTheDocument();
    });

    it('does not offer "Show all" for five items or fewer', () => {
      const five = Array.from({ length: 5 }, (_, index) =>
        itemFixture({ id: `i${index}`, text: `Fact ${index}` }),
      );
      setUp(ready({ itemCount: 5 }), { items: five });

      expect(
        screen.queryByRole('button', { name: 'resource.showAllButton' }),
      ).not.toBeInTheDocument();
    });

    it('explains a resource that added nothing new, and lists nothing', () => {
      setUp(ready({ itemCount: 0 }));

      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.nothingNewTitle',
      );
      expect(screen.queryByText('resource.itemsTitle')).not.toBeInTheDocument();
    });
  });

  describe('the details beside it', () => {
    const details = () => screen.getByRole('complementary');

    it('names the type, the day it was added and what the file is', () => {
      setUp(ready());

      expect(details()).toHaveTextContent('resource.detailsTitle');
      expect(details()).toHaveTextContent('resource.typeLabelprofile.typeCv');
      expect(details()).toHaveTextContent('resource.addedLabel10 Oct 2026');
      expect(details()).toHaveTextContent(
        'resource.fileLabelresource.contentPdf',
      );
    });

    it('gives the address of a link, to open in another tab', () => {
      setUp(
        ready({
          type: 'link',
          source: 'link',
          contentType: 'text/uri-list',
          url: 'https://talks.example/ledgers',
        }),
      );

      const link = within(details()).getByRole('link', {
        name: 'https://talks.example/ledgers',
      });
      expect(link).toHaveAttribute('href', 'https://talks.example/ledgers');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      expect(details()).toHaveTextContent('resource.addressLabel');
      expect(
        screen.getByText('resource.addedOn · talks.example'),
      ).toBeInTheDocument();
    });

    it('says pasted text is text', () => {
      setUp(ready({ type: 'note', source: 'text', contentType: 'text/plain' }));

      expect(details()).toHaveTextContent(
        'resource.contentLabelresource.contentText',
      );
    });
  });

  describe('a resource the backend has not finished', () => {
    it('says it is being read, as of a moment ago', () => {
      setUp(
        ready({
          status: 'processing',
          itemCount: 0,
          createdAt: NOW - 20_000,
          updatedAt: NOW - 20_000,
        }),
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.readingTitle',
      );
      expect(screen.getByText('profile.statusProcessing')).toBeInTheDocument();
      expect(
        screen.getByText('resource.addedJustNow · resource.contentPdf'),
      ).toBeInTheDocument();
    });

    it('says a file is on its way', () => {
      setUp(
        ready({
          status: 'awaitingUpload',
          itemCount: 0,
          createdAt: NOW - 120_000,
          updatedAt: NOW - 120_000,
        }),
      );

      expect(
        screen.getByText('profile.statusAwaitingUpload'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('resource.addedMinutesAgo · resource.contentPdf'),
      ).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.readingTitle',
      );
    });

    it('says it is taking too long once 3 minutes have passed, and offers to remove it', () => {
      setUp(
        ready({
          status: 'awaitingUpload',
          itemCount: 0,
          createdAt: NOW - RESOURCE_WATCH_MS - 1,
          updatedAt: NOW - RESOURCE_WATCH_MS - 1,
        }),
      );

      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent('resource.stuckTitle');
      expect(panel).toHaveTextContent('resource.stuckUploadDescription');
      expect(
        within(panel).getByRole('button', { name: 'resource.removeButton' }),
      ).toBeInTheDocument();
    });

    it('notices by itself when the 3 minutes pass while the page is open', async () => {
      vi.useRealTimers();
      vi.useFakeTimers({ now: NOW });
      setUp(
        ready({
          status: 'processing',
          itemCount: 0,
          createdAt: NOW - RESOURCE_WATCH_MS + 20_000,
          updatedAt: NOW - RESOURCE_WATCH_MS + 20_000,
        }),
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.readingTitle',
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(45_000);
      });

      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.stuckTitle',
      );
      expect(screen.getByRole('status')).toHaveTextContent(
        'resource.stuckReadingDescription',
      );
    });
  });

  describe('a resource that failed', () => {
    const failed = ready({
      type: 'link',
      source: 'link',
      title: 'Conference talk',
      url: 'https://talks.example/ledgers',
      status: 'failed',
      failure: 'link-unreadable',
      itemCount: 0,
    });

    it('says "Failed" and why', () => {
      setUp(failed);

      expect(screen.getByText('resource.statusFailedChip')).toBeInTheDocument();
      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent('resource.failedLinkUnreadableTitle');
      expect(panel).toHaveTextContent(
        'resource.failedLinkUnreadableDescription',
      );
    });

    it('is removed from its panel: asked first, then back to the profile without it', async () => {
      const gateway = createMockProfileGateway();
      gateway.removeResource.mockResolvedValue({ itemsRemoved: 0 });
      const { store } = setUp(failed, {}, gateway);

      await userEvent.click(
        within(screen.getByRole('status')).getByRole('button', {
          name: 'resource.removeButton',
        }),
      );
      const dialog = screen.getByRole('dialog', {
        name: 'resource.removeDialogTitle',
      });
      expect(dialog).toHaveTextContent('resource.removeDialogNoItems');
      expect(gateway.removeResource).not.toHaveBeenCalled();

      await userEvent.click(
        within(dialog).getByRole('button', {
          name: 'resource.removeConfirmButton',
        }),
      );

      expect(await screen.findByText('at /profile')).toBeInTheDocument();
      expect(gateway.removeResource).toHaveBeenCalledExactlyOnceWith('r1');
      expect(store.getState().interviewProfile.resources).toEqual([]);
    });
  });

  describe('removing from the details', () => {
    it('says how many items go with it, and how many of them were edited', async () => {
      setUp(ready({ itemCount: 3 }), {
        items: [
          itemFixture({ id: 'i1', edited: true }),
          itemFixture({ id: 'i2' }),
          itemFixture({ id: 'i3', edited: true }),
        ],
      });

      await userEvent.click(
        screen.getByRole('button', { name: 'resource.removeLink' }),
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveTextContent('resource.removeDialogItemsEdited');
      expect(
        within(dialog).getByRole('button', {
          name: 'resource.removeConfirmItemsButton',
        }),
      ).toBeInTheDocument();
    });

    it('stays on the page when the dialog is cancelled', async () => {
      setUp(ready());

      await userEvent.click(
        screen.getByRole('button', { name: 'resource.removeLink' }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: 'resource.cancelButton' }),
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 1, name: 'Maya Okafor CV 2026' }),
      ).toBeInTheDocument();
    });
  });

  describe('when there is nothing to show', () => {
    it('says the resource is not in the profile, with the way back', () => {
      setUp(null);

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'resource.notFoundTitle',
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: 'resource.notFoundLink' }),
      ).toHaveAttribute('href', '/profile');
    });

    it('waits while the profile is being read, when the page is opened by its address', async () => {
      const gateway = createMockProfileGateway();
      let answer: (resources: ProfileResource[]) => void = () => undefined;
      gateway.getResources.mockReturnValue(
        new Promise(resolve => {
          answer = resolve;
        }),
      );
      setUp(ready(), { uid: null, status: 'idle', resources: [] }, gateway);

      expect(
        screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByText('resource.notFoundTitle'),
      ).not.toBeInTheDocument();

      await act(async () => {
        answer([ready()]);
      });

      await waitFor(() =>
        expect(
          screen.getByRole('heading', {
            level: 1,
            name: 'Maya Okafor CV 2026',
          }),
        ).toBeInTheDocument(),
      );
    });

    it('says when the profile could not be read, and reads it again on "Try again"', async () => {
      const gateway = createMockProfileGateway();
      gateway.getResources.mockResolvedValue([ready()]);
      setUp(ready(), { status: 'error', resources: [] }, gateway);

      expect(screen.getByRole('alert')).toHaveTextContent(
        'profile.loadErrorMessage',
      );

      await userEvent.click(
        screen.getByRole('button', { name: 'profile.retryButton' }),
      );

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: 'Maya Okafor CV 2026',
        }),
      ).toBeInTheDocument();
    });
  });

  it('always has the way back to the profile', () => {
    setUp(ready());

    expect(
      screen.getByRole('link', { name: 'resource.backLink' }),
    ).toHaveAttribute('href', '/profile');
  });
});
