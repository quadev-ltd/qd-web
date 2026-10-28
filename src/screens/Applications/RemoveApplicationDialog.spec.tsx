import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RemoveApplicationDialog } from './RemoveApplicationDialog';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const setUp = (gateway = createMockProfileGateway()) => {
  const onRemoved = vi.fn();
  renderProfilePage(
    <RemoveApplicationDialog
      applicationId="a1"
      onCancel={vi.fn()}
      onRemoved={onRemoved}
    />,
    {
      gateway,
      applications: {
        uid: 'uid-1',
        status: 'loaded',
        applications: [applicationFixture()],
        profileRevision: 3,
      },
    },
  );
  return { gateway, onRemoved };
};

const removeButton = () =>
  screen.getByRole('button', { name: 'applications.removeConfirmButton' });

describe('RemoveApplicationDialog, its practice (D99)', () => {
  it('without practice, asks nothing more and keeps the call as it was', async () => {
    const user = userEvent.setup();
    const { gateway, onRemoved } = setUp();

    await waitFor(() => expect(removeButton()).toBeEnabled());
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(gateway.countApplicationPractice).toHaveBeenCalledWith(
      'uid-1',
      'a1',
    );
    await user.click(removeButton());

    expect(gateway.removeApplication).toHaveBeenCalledWith('a1');
    expect(onRemoved).toHaveBeenCalled();
  });

  it('with practice, offers to remove it too, unticked, and keeps it unless ticked', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.countApplicationPractice.mockResolvedValue(3);
    setUp(gateway);

    const box = await screen.findByRole('checkbox', {
      name: 'applications.removePracticeLabel',
    });
    expect(box).not.toBeChecked();
    expect(box).toHaveAccessibleDescription('applications.removePracticeHint');
    await user.click(removeButton());

    expect(gateway.removeApplication).toHaveBeenCalledWith('a1');
  });

  it('removes the practice with the application when ticked', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.countApplicationPractice.mockResolvedValue(1);
    setUp(gateway);

    await user.click(
      await screen.findByRole('checkbox', {
        name: 'applications.removePracticeLabel',
      }),
    );
    await user.click(removeButton());

    expect(gateway.removeApplication).toHaveBeenCalledWith('a1', {
      removePractice: true,
    });
  });

  it('waits for the count before it can remove, and leaves the box out when it can’t be read', async () => {
    const gateway = createMockProfileGateway();
    let fail: () => void = () => undefined;
    gateway.countApplicationPractice.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = () => reject(new ProfileError(ProfileErrorCode.Network));
        }),
    );
    setUp(gateway);

    expect(removeButton()).toBeDisabled();
    fail();

    await waitFor(() => expect(removeButton()).toBeEnabled());
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
