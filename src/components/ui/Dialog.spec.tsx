import { fireEvent, render, screen } from '@testing-library/react';

import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('opens as a modal dialog named by its question', () => {
    render(
      <Dialog title="Remove this resource?" icon="trash" onClose={vi.fn()}>
        <button type="button">Remove</button>
      </Dialog>,
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Remove this resource?',
    });
    expect(dialog).toHaveAttribute('open');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Remove this resource?' }),
    ).toBeInTheDocument();
    expect(dialog).toContainElement(
      screen.getByRole('button', { name: 'Remove' }),
    );
  });

  it('asks to be closed on Escape, and leaves the closing to its parent', () => {
    const onClose = vi.fn();
    render(
      <Dialog title="Remove?" icon="trash" onClose={onClose}>
        Content
      </Dialog>,
    );

    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
  });

  it('closes the dialog when it is removed, so the browser gives the focus back', () => {
    const { unmount } = render(
      <Dialog title="Remove?" icon="trash" onClose={vi.fn()}>
        Content
      </Dialog>,
    );
    const closed = vi.fn();
    screen.getByRole('dialog').addEventListener('close', closed);

    unmount();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('has a red icon for something that cannot be undone, hidden from assistive technology', () => {
    const { container } = render(
      <Dialog title="Remove?" icon="trash" tone="danger" onClose={vi.fn()}>
        Content
      </Dialog>,
    );

    const tile = container.querySelector('[aria-hidden="true"]');
    expect(tile).toHaveClass('bg-danger-tint', 'text-danger');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('is in the brand colours otherwise', () => {
    const { container } = render(
      <Dialog title="Sure?" icon="check" onClose={vi.fn()}>
        Content
      </Dialog>,
    );

    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass(
      'bg-tint',
    );
  });
});
