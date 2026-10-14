import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ResourceStatusPanel,
  type ResourceStatusPanelProps,
} from './ResourceStatusPanel';

import { type ProfileResourceFailure } from '@/core/profile/contract';

const renderPanel = (
  resource: ResourceStatusPanelProps['resource'],
  stuck = false,
) => {
  const onRemove = vi.fn();
  const utils = render(
    <ResourceStatusPanel
      resource={resource}
      stuck={stuck}
      onRemove={onRemove}
    />,
  );
  return { onRemove, ...utils };
};

const removeButton = () =>
  screen.queryByRole('button', { name: 'resource.removeButton' });

describe('ResourceStatusPanel', () => {
  it('says a resource is being read, and that the page can be left', () => {
    renderPanel({ status: 'processing' });

    const panel = screen.getByRole('status');
    expect(panel).toHaveTextContent('resource.readingTitle');
    expect(panel).toHaveTextContent('resource.readingDescription');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    expect(removeButton()).not.toBeInTheDocument();
  });

  it('says the same while a file is on its way', () => {
    renderPanel({ status: 'awaitingUpload' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'resource.readingTitle',
    );
  });

  it.each([
    ['awaitingUpload', 'resource.stuckUploadDescription'],
    ['processing', 'resource.stuckReadingDescription'],
  ] as const)(
    'says a resource stuck in %s is taking too long, and offers to remove it',
    async (status, description) => {
      const { onRemove } = renderPanel({ status }, true);

      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent('resource.stuckTitle');
      expect(panel).toHaveTextContent(description);
      expect(panel).toHaveClass('bg-warning-tint');

      await userEvent.click(removeButton() as HTMLElement);
      expect(onRemove).toHaveBeenCalledTimes(1);
    },
  );

  it('has nothing to add for a resource that was read: its chip says it', () => {
    const { container } = renderPanel({ status: 'ready' });

    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing is stuck about a resource that was read, whatever the clock says', () => {
    const { container } = renderPanel({ status: 'ready' }, true);

    expect(container).toBeEmptyDOMElement();
  });

  it.each([
    ['unsupported-file', 'resource.failedUnsupportedFile'],
    ['empty', 'resource.failedEmpty'],
    ['too-long', 'resource.failedTooLong'],
    ['too-large', 'resource.failedTooLarge'],
    ['link-unreadable', 'resource.failedLinkUnreadable'],
    ['flag-off', 'resource.failedFlagOff'],
    ['quota', 'resource.failedQuota'],
    ['blocked', 'resource.failedBlocked'],
    ['model', 'resource.failedModel'],
    ['internal', 'resource.failedInternal'],
  ] as [ProfileResourceFailure, string][])(
    'says why a resource failed (%s), and offers to remove it',
    async (failure, key) => {
      const { onRemove } = renderPanel({
        status: 'failed',
        failure,
      });

      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent(`${key}Title`);
      expect(panel).toHaveTextContent(`${key}Description`);
      expect(panel).toHaveClass('bg-danger-tint');

      await userEvent.click(removeButton() as HTMLElement);
      expect(onRemove).toHaveBeenCalledTimes(1);
    },
  );

  it('takes a failure with no reason as a fault on our side', () => {
    renderPanel({ status: 'failed' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'resource.failedInternalTitle',
    );
  });
});
