import { render, screen } from '@testing-library/react';
import { createRef } from 'react';

import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('shows the text as an alert, so screen readers announce it', () => {
    render(<ErrorMessage text="Network error. Check your connection." />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Network error. Check your connection.',
    );
  });

  it('can receive the focus, without being a stop for the Tab key', () => {
    const ref = createRef<HTMLParagraphElement>();
    render(<ErrorMessage ref={ref} text="Network error." />);

    ref.current?.focus();

    expect(screen.getByRole('alert')).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveAttribute('tabindex', '-1');
  });
});
