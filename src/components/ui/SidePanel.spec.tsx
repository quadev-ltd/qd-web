import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SidePanel } from './SidePanel';

describe('SidePanel', () => {
  it('opens as a modal dialog named by its heading', () => {
    render(
      <SidePanel title="Upload a file" onClose={vi.fn()}>
        <p>The form</p>
      </SidePanel>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Upload a file' });
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveTextContent('The form');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Upload a file' }),
    ).toBeInTheDocument();
  });

  it('shows a sentence under the heading when it has one', () => {
    render(
      <SidePanel
        title="Add to your profile"
        description="Each resource is read once."
        onClose={vi.fn()}>
        Content
      </SidePanel>,
    );

    expect(screen.getByText('Each resource is read once.')).toBeInTheDocument();
  });

  it('asks to be closed by its close button', async () => {
    const onClose = vi.fn();
    render(
      <SidePanel title="Upload a file" onClose={onClose}>
        Content
      </SidePanel>,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'sidePanel.closeAccessibilityLabel' }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks to be closed on Escape, and leaves the closing to its parent', () => {
    const onClose = vi.fn();
    render(
      <SidePanel title="Upload a file" onClose={onClose}>
        Content
      </SidePanel>,
    );
    const dialog = screen.getByRole('dialog');

    // What the browser sends to a modal dialog when Escape is pressed.
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(dialog, cancel);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(cancel.defaultPrevented).toBe(true);
    expect(dialog).toHaveAttribute('open');
  });

  it('does not close on a press outside: a form in it would lose what was typed', async () => {
    const onClose = vi.fn();
    render(
      <SidePanel title="Upload a file" onClose={onClose}>
        Content
      </SidePanel>,
    );

    await userEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the dialog when it is removed, so the browser gives the focus back', () => {
    const { unmount } = render(
      <SidePanel title="Upload a file" onClose={vi.fn()}>
        Content
      </SidePanel>,
    );
    const dialog = screen.getByRole('dialog');
    const closed = vi.fn();
    dialog.addEventListener('close', closed);

    unmount();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('moves the focus to the heading when it goes on to another step', () => {
    const { rerender } = render(
      <SidePanel title="Add to your profile" onClose={vi.fn()}>
        <button type="button">Upload a file</button>
      </SidePanel>,
    );
    expect(
      screen.getByRole('heading', { name: 'Add to your profile' }),
    ).not.toHaveFocus();

    rerender(
      <SidePanel title="Upload a file" onClose={vi.fn()}>
        <p>The form</p>
      </SidePanel>,
    );

    expect(
      screen.getByRole('heading', { name: 'Upload a file' }),
    ).toHaveFocus();
  });
});
