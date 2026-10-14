import { render, screen } from '@testing-library/react';

import { ResourceStatus } from './ResourceStatus';

import { type ProfileResourceFailure } from '@/core/profile/contract';

const status = (resource: Parameters<typeof ResourceStatus>[0]['resource']) => {
  const { container } = render(<ResourceStatus resource={resource} />);
  return container.firstElementChild as HTMLElement;
};

describe('ResourceStatus', () => {
  it('says a resource is ready, with no count of what was read from it', () => {
    const line = status({ status: 'ready' });

    expect(line).toHaveTextContent(/^profile\.statusReady$/);
    expect(line).toHaveClass('text-success');
  });

  it('says a resource is being read, with a turning ring', () => {
    const line = status({ status: 'processing' });

    expect(line).toHaveTextContent('profile.statusProcessing');
    expect(screen.getByTestId('spinner')).toBeInTheDocument();
  });

  it('says a resource is waiting for its file', () => {
    expect(status({ status: 'awaitingUpload' })).toHaveTextContent(
      'profile.statusAwaitingUpload',
    );
  });

  it.each([
    ['unsupported-file', 'profile.failedUnsupportedFile'],
    ['empty', 'profile.failedEmpty'],
    ['too-long', 'profile.failedTooLong'],
    ['too-large', 'profile.failedTooLarge'],
    ['link-unreadable', 'profile.failedLinkUnreadable'],
    ['flag-off', 'profile.failedFlagOff'],
    ['quota', 'profile.failedQuota'],
    ['blocked', 'profile.failedBlocked'],
    ['model', 'profile.failedModel'],
    ['internal', 'profile.failedInternal'],
  ] as [ProfileResourceFailure, string][])(
    'says why a resource failed: %s',
    (failure, key) => {
      const line = status({ status: 'failed', failure });

      expect(line).toHaveTextContent(key);
      expect(line).toHaveClass('text-danger');
    },
  );

  it('takes a failure with no reason as a fault on our side', () => {
    expect(status({ status: 'failed' })).toHaveTextContent(
      'profile.failedInternal',
    );
  });

  it('is a live region, so a change of state is read out', () => {
    for (const resource of [
      { status: 'ready' },
      { status: 'processing' },
      { status: 'failed' },
    ] as const) {
      expect(status(resource)).toHaveAttribute('aria-live', 'polite');
    }
  });
});
