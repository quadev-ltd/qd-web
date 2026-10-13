import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ItemPanel } from './ItemPanel';

import { type SkillMapItem } from '@/core/profile/contract';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { useInterviewProfile } from '@/core/profile/InterviewProfileProvider';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const TEXT = 'Cut payment incidents by 40% in two quarters.';

/** The panel as the skill map shows it: for the item as the store has it now. */
const setUp = (overrides: Partial<SkillMapItem> = {}, withResource = true) => {
  const gateway = createMockProfileGateway();
  const onRemoved = vi.fn();
  const resource = resourceFixture({ id: 'r1', itemCount: 1 });
  const Panel = () => {
    const current = useInterviewProfile().items.find(({ id }) => id === 'i1');
    return current ? (
      <ItemPanel
        item={current}
        resource={withResource ? resource : undefined}
        onRemoved={onRemoved}
      />
    ) : (
      <p>gone</p>
    );
  };
  const utils = renderProfilePage(<Panel />, {
    gateway,
    interviewProfile: {
      uid: 'uid-1',
      status: 'loaded',
      resources: [resource],
      items: [itemFixture({ id: 'i1', text: TEXT, ...overrides })],
    },
  });
  const itemInStore = () =>
    utils.store.getState().interviewProfile.items.find(({ id }) => id === 'i1');
  return { onRemoved, itemInStore, ...utils };
};

const editButton = () =>
  screen.getByRole('button', { name: 'item.editButton' });
const textField = () => screen.getByLabelText('item.textLabel');
const saveButton = () =>
  screen.getByRole('button', { name: 'item.saveButton' });
const star = () => screen.getByRole('switch', { name: 'item.starLabel' });
const hide = () => screen.getByRole('switch', { name: 'item.hideLabel' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ItemPanel', () => {
  it('shows what the item says, its kind and where it came from', () => {
    setUp({ evidence: 'Reduced Sev-1 and Sev-2 payment incidents 40%.' });

    expect(screen.getByText(TEXT)).toBeInTheDocument();
    expect(screen.getByText('resource.kindAchievement')).toBeInTheDocument();
    expect(screen.queryByText('resource.editedChip')).not.toBeInTheDocument();
    expect(
      screen.getByText('Reduced Sev-1 and Sev-2 payment incidents 40%.'),
    ).toBeInTheDocument();
    expect(screen.getByText('item.evidenceNote')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Maya Okafor CV 2026/ }),
    ).toHaveAttribute('href', '/profile/resources/r1');
  });

  it('marks an item that was edited or hidden', () => {
    setUp({ edited: true, hidden: true });

    expect(screen.getByText('resource.editedChip')).toBeInTheDocument();
    expect(screen.getByText('resource.hiddenChip')).toBeInTheDocument();
  });

  it('shows no way to a resource the profile no longer has', () => {
    setUp({}, false);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  describe('editing the text', () => {
    it('opens the text to edit, with its length against the limit', async () => {
      setUp();

      await userEvent.click(editButton());

      expect(textField()).toHaveValue(TEXT);
      expect(screen.getByText(`${TEXT.length} / 600`)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: 'item.editButton' }),
      ).not.toBeInTheDocument();
    });

    it('saves a new text, trimmed, and shows it as edited once the backend has answered', async () => {
      const { gateway, itemInStore } = setUp();
      let answer: () => void = () => undefined;
      gateway.updateItem.mockReturnValue(
        new Promise<void>(resolve => {
          answer = resolve;
        }),
      );
      await userEvent.click(editButton());
      await userEvent.clear(textField());
      await userEvent.type(textField(), '  Led the ledger migration.  ');

      await userEvent.click(saveButton());

      const busy = await screen.findByRole('button', {
        name: 'item.savingButton',
      });
      expect(busy).toBeDisabled();
      expect(busy).toHaveAttribute('aria-busy', 'true');
      expect(textField()).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'item.cancelButton' }),
      ).toBeDisabled();
      expect(itemInStore()?.text).toBe(TEXT);

      answer();

      await waitFor(() =>
        expect(itemInStore()).toMatchObject({
          text: 'Led the ledger migration.',
          edited: true,
        }),
      );
      expect(gateway.updateItem).toHaveBeenCalledExactlyOnceWith('i1', {
        text: 'Led the ledger migration.',
      });
      await waitFor(() =>
        expect(
          screen.queryByLabelText('item.textLabel'),
        ).not.toBeInTheDocument(),
      );
    });

    it('sends nothing when the text was not changed', async () => {
      const { gateway } = setUp();
      await userEvent.click(editButton());

      await userEvent.click(saveButton());

      await waitFor(() =>
        expect(
          screen.queryByLabelText('item.textLabel'),
        ).not.toBeInTheDocument(),
      );
      expect(gateway.updateItem).not.toHaveBeenCalled();
    });

    it('gives up the change on Cancel', async () => {
      const { gateway } = setUp();
      await userEvent.click(editButton());
      await userEvent.type(textField(), ' More.');

      await userEvent.click(
        screen.getByRole('button', { name: 'item.cancelButton' }),
      );

      expect(screen.getByText(TEXT)).toBeInTheDocument();
      expect(gateway.updateItem).not.toHaveBeenCalled();
      // Edit starts again from what the item says.
      await userEvent.click(editButton());
      expect(textField()).toHaveValue(TEXT);
    });

    it('says when the text is longer than 600 characters, and waits for it to be shortened', async () => {
      const { gateway } = setUp();
      await userEvent.click(editButton());

      fireEvent.change(textField(), { target: { value: 'a'.repeat(601) } });

      expect(
        await screen.findByText('item.textLengthError'),
      ).toBeInTheDocument();
      expect(screen.getByText('601 / 600')).toHaveClass('text-danger');
      expect(saveButton()).toBeDisabled();
      expect(gateway.updateItem).not.toHaveBeenCalled();
    });

    it('asks for a text when it is empty', async () => {
      const { gateway } = setUp();
      await userEvent.click(editButton());
      await userEvent.clear(textField());

      await userEvent.click(saveButton());

      expect(
        await screen.findByText('item.textRequiredError'),
      ).toBeInTheDocument();
      expect(gateway.updateItem).not.toHaveBeenCalled();
    });

    it('says when it could not be saved, keeps what was typed and can be tried again', async () => {
      const { gateway, itemInStore } = setUp();
      gateway.updateItem.mockRejectedValueOnce(
        new ProfileError(ProfileErrorCode.Network),
      );
      await userEvent.click(editButton());
      await userEvent.clear(textField());
      await userEvent.type(textField(), 'Led the ledger migration.');

      await userEvent.click(saveButton());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('item.saveFailedMessage');
      expect(alert).toHaveFocus();
      expect(textField()).toHaveValue('Led the ledger migration.');
      expect(itemInStore()?.text).toBe(TEXT);
      expect(mockLogger.logMessage).toHaveBeenCalledWith(
        'updateItem failed: code=profile/network uid=uid-1',
      );
      expect(JSON.stringify(mockLogger.logMessage.mock.calls)).not.toContain(
        'ledger',
      );

      await userEvent.click(saveButton());

      await waitFor(() =>
        expect(itemInStore()?.text).toBe('Led the ledger migration.'),
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('the star and "never use this"', () => {
    it('stars the item once the backend has accepted it, and waits meanwhile', async () => {
      const { gateway, itemInStore } = setUp();
      let answer: () => void = () => undefined;
      gateway.updateItem.mockReturnValue(
        new Promise<void>(resolve => {
          answer = resolve;
        }),
      );

      await userEvent.click(star());

      expect(star()).toHaveAttribute('aria-busy', 'true');
      expect(star()).toHaveAttribute('aria-checked', 'false');
      // One change at a time.
      expect(hide()).toBeDisabled();
      expect(itemInStore()?.starred).toBe(false);

      answer();

      await waitFor(() =>
        expect(star()).toHaveAttribute('aria-checked', 'true'),
      );
      expect(star()).toHaveAttribute('aria-busy', 'false');
      expect(gateway.updateItem).toHaveBeenCalledExactlyOnceWith('i1', {
        starred: true,
      });
      expect(itemInStore()).toMatchObject({ starred: true, edited: false });
    });

    it('takes the star off again', async () => {
      const { gateway } = setUp({ starred: true });

      await userEvent.click(star());

      await waitFor(() =>
        expect(star()).toHaveAttribute('aria-checked', 'false'),
      );
      expect(gateway.updateItem).toHaveBeenCalledWith('i1', { starred: false });
    });

    it('hides the item, and shows it again', async () => {
      const { gateway } = setUp();

      await userEvent.click(hide());
      await waitFor(() =>
        expect(hide()).toHaveAttribute('aria-checked', 'true'),
      );
      expect(screen.getByText('resource.hiddenChip')).toBeInTheDocument();

      await userEvent.click(hide());
      await waitFor(() =>
        expect(hide()).toHaveAttribute('aria-checked', 'false'),
      );

      expect(gateway.updateItem.mock.calls).toEqual([
        ['i1', { hidden: true }],
        ['i1', { hidden: false }],
      ]);
    });

    it('leaves the switch as it was when the backend does not accept the change, and says so', async () => {
      const { gateway } = setUp();
      gateway.updateItem.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Unknown),
      );

      await userEvent.click(star());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'item.saveFailedMessage',
      );
      expect(star()).toHaveAttribute('aria-checked', 'false');
      expect(star()).toBeEnabled();
    });
  });

  describe('removing the item', () => {
    const openDialog = async () => {
      await userEvent.click(
        screen.getByRole('button', { name: 'item.removeLink' }),
      );
      return screen.getByRole('dialog', { name: 'item.removeDialogTitle' });
    };

    it('asks first, and says the resource stays', async () => {
      const { gateway } = setUp();

      const dialog = await openDialog();

      expect(dialog).toHaveTextContent('item.removeDialogDescription');
      expect(gateway.removeItem).not.toHaveBeenCalled();

      await userEvent.click(
        within(dialog).getByRole('button', { name: 'item.cancelButton' }),
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(gateway.removeItem).not.toHaveBeenCalled();
    });

    it('removes the item, counts one less on its resource and says it is done', async () => {
      const { gateway, onRemoved, store } = setUp();
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole('button', {
          name: 'item.removeConfirmButton',
        }),
      );

      await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
      expect(gateway.removeItem).toHaveBeenCalledExactlyOnceWith('i1');
      expect(store.getState().interviewProfile.items).toEqual([]);
      expect(store.getState().interviewProfile.resources[0].itemCount).toBe(0);
    });

    it('cannot be left while the backend is removing', async () => {
      const { gateway, onRemoved } = setUp();
      gateway.removeItem.mockReturnValue(new Promise(() => {}));
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole('button', {
          name: 'item.removeConfirmButton',
        }),
      );

      expect(
        within(dialog).getByRole('button', { name: 'item.removingButton' }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole('button', { name: 'item.cancelButton' }),
      ).toBeDisabled();
      fireEvent(dialog, new Event('cancel', { cancelable: true }));
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(onRemoved).not.toHaveBeenCalled();
    });

    it('says when it could not be removed, in the dialog, and keeps the item', async () => {
      const { gateway, onRemoved, itemInStore } = setUp();
      gateway.removeItem.mockRejectedValue(
        new ProfileError(ProfileErrorCode.Network),
      );
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole('button', {
          name: 'item.removeConfirmButton',
        }),
      );

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'item.removeFailedMessage',
      );
      expect(onRemoved).not.toHaveBeenCalled();
      expect(itemInStore()).toBeDefined();
    });

    it('takes "already gone" as done', async () => {
      const { gateway, onRemoved, store } = setUp();
      gateway.removeItem.mockRejectedValue(
        new ProfileError(ProfileErrorCode.NotFound),
      );
      const dialog = await openDialog();

      await userEvent.click(
        within(dialog).getByRole('button', {
          name: 'item.removeConfirmButton',
        }),
      );

      await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
      expect(store.getState().interviewProfile.items).toEqual([]);
    });
  });

  it('takes an item out of the skill map when a change finds it gone', async () => {
    const { gateway, store } = setUp();
    gateway.updateItem.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );

    await userEvent.click(star());

    await waitFor(() =>
      expect(store.getState().interviewProfile.items).toEqual([]),
    );
    expect(mockLogger.logError).not.toHaveBeenCalled();
  });
});
