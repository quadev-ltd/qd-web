import { render, screen } from '@testing-library/react';

import StatusIcon, { type StatusIconName } from './StatusIcon';

describe('StatusIcon', () => {
  it.each(['mail', 'check', 'error', 'trash'] satisfies StatusIconName[])(
    'draws the %s icon, hidden from assistive technology',
    icon => {
      render(<StatusIcon icon={icon} />);

      const tile = screen.getByTestId(`status-icon-${icon}`);
      expect(tile).toHaveAttribute('aria-hidden', 'true');
      expect(tile.querySelector('svg')).toBeInTheDocument();
      expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
    },
  );

  it('turns while something is in progress, without announcing it twice', () => {
    render(<StatusIcon icon="busy" />);

    expect(screen.getByTestId('spinner')).toBeInTheDocument();
    // The text next to it and the busy button say what is happening.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('uses the brand tile by default and the red one for a failure', () => {
    const { rerender } = render(<StatusIcon icon="mail" />);
    expect(screen.getByTestId('status-icon-mail')).toHaveClass(
      'bg-tint',
      'text-primary',
    );

    rerender(<StatusIcon icon="error" tone="danger" />);
    expect(screen.getByTestId('status-icon-error')).toHaveClass(
      'bg-danger-tint',
      'text-danger',
    );
  });
});
