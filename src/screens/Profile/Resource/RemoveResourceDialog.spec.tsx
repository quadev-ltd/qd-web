import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  RemoveResourceDialog,
  type RemoveResourceDialogProps,
} from './RemoveResourceDialog';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const setUp = (props: Partial<RemoveResourceDialogProps> = {}) => {
  const gateway = createMockProfileGateway();
  const onCancel = vi.fn();
  const onRemoved = vi.fn();
  const utils = renderProfilePage(
    <RemoveResourceDialog
      resourceId="r1"
      itemCount={31}
      editedCount={4}
      onCancel={onCancel}
      onRemoved={onRemoved}
      {...props}
    />,
    {
      gateway,
      interviewProfile: {
        uid: 'uid-1',
        status: 'loaded',
        resources: [
          resourceFixture({ id: 'r1' }),
          resourceFixture({ id: 'r2' }),
        ],
        items: [
          itemFixture({ id: 'i1', resourceId: 'r1' }),
          itemFixture({ id: 'i2', resourceId: 'r2' }),
        ],
      },
    },
  );
  return { onCancel, onRemoved, ...utils };
};

const confirm = () =>
  screen.getByRole('button', { name: /resource\.removeConfirm/ });
const cancel = () =>
  screen.getByRole('button', { name: 'resource.cancelButton' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RemoveResourceDialog', () => {
  it('asks first, and says what goes with the resource', () => {
    const { gateway } = setUp();

    const dialog = screen.getByRole('dialog', {
      name: 'resource.removeDialogTitle',
    });
    expect(dialog).toHaveTextContent('resource.removeDialogItemsEdited');
    expect(dialog).toHaveTextContent('resource.removeDialogBriefs');
    expect(confirm()).toHaveTextContent('resource.removeConfirmItemsButton');
    expect(gateway.removeResource).not.toHaveBeenCalled();
  });

  it('does not mention edits when none of the items was edited', () => {
    setUp({ editedCount: 0 });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('resource.removeDialogItems');
    expect(dialog).not.toHaveTextContent('resource.removeDialogItemsEdited');
  });

  it('says so when the resource has no items, and names only the resource on the button', () => {
    setUp({ itemCount: 0, editedCount: 0 });

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('resource.removeDialogNoItems');
    expect(dialog).not.toHaveTextContent('resource.removeDialogBriefs');
    expect(confirm()).toHaveTextContent('resource.removeConfirmButton');
    expect(confirm()).not.toHaveTextContent(
      'resource.removeConfirmItemsButton',
    );
  });

  it('removes nothing on Cancel or Escape', async () => {
    const { gateway, onCancel } = setUp();

    await userEvent.click(cancel());
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(gateway.removeResource).not.toHaveBeenCalled();
  });

  it('removes the resource, takes it and its items out of the profile, and says it is done', async () => {
    const { gateway, onRemoved, store } = setUp();
    gateway.removeResource.mockResolvedValue({ itemsRemoved: 1 });

    await userEvent.click(confirm());

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(gateway.removeResource).toHaveBeenCalledExactlyOnceWith('r1');
    const { resources, items } = store.getState().interviewProfile;
    expect(resources.map(({ id }) => id)).toEqual(['r2']);
    expect(items.map(({ id }) => id)).toEqual(['i2']);
  });

  it('cannot be left or sent twice while the backend is removing', async () => {
    const { gateway, onCancel, onRemoved } = setUp();
    gateway.removeResource.mockReturnValue(new Promise(() => {}));

    await userEvent.click(confirm());

    const busy = screen.getByRole('button', {
      name: 'resource.removingButton',
    });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute('aria-busy', 'true');
    expect(cancel()).toBeDisabled();
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(onCancel).not.toHaveBeenCalled();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(gateway.removeResource).toHaveBeenCalledTimes(1);
  });

  it('takes "already gone" as done', async () => {
    const { gateway, onRemoved, store } = setUp();
    gateway.removeResource.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );

    await userEvent.click(confirm());

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(
      store.getState().interviewProfile.resources.map(({ id }) => id),
    ).toEqual(['r2']);
    expect(mockLogger.logError).not.toHaveBeenCalled();
  });

  it('says when it could not be removed, keeps the resource and can be tried again', async () => {
    const { gateway, onRemoved, store } = setUp();
    gateway.removeResource.mockRejectedValueOnce(
      new ProfileError(ProfileErrorCode.Network),
    );

    await userEvent.click(confirm());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('resource.removeFailedMessage');
    expect(alert).toHaveFocus();
    expect(onRemoved).not.toHaveBeenCalled();
    expect(store.getState().interviewProfile.resources).toHaveLength(2);
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'removeResource failed: code=profile/network uid=uid-1',
    );

    await userEvent.click(confirm());

    await waitFor(() => expect(onRemoved).toHaveBeenCalledTimes(1));
    expect(gateway.removeResource).toHaveBeenCalledTimes(2);
  });
});
