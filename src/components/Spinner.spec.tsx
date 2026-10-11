import { render, screen } from '@testing-library/react';

import Spinner from './Spinner';

describe('Spinner', () => {
  it('is announced as loading', () => {
    render(<Spinner />);

    expect(
      screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
    ).toBeInTheDocument();
  });

  it('is large by default and can be small', () => {
    const { rerender } = render(<Spinner />);
    expect(screen.getByRole('status')).toHaveClass('size-10');

    rerender(<Spinner size="small" />);
    expect(screen.getByRole('status')).toHaveClass('size-5');
  });

  it('can be decorative: hidden from assistive technology', () => {
    render(<Spinner decorative />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByTestId('spinner')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('does not turn for people who asked for less motion', () => {
    render(<Spinner />);

    expect(screen.getByRole('status')).toHaveClass('motion-safe:animate-spin');
  });
});
