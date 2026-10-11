import { render, screen } from '@testing-library/react';

import ErrorMessage from './ErrorMessage';

describe('ErrorMessage', () => {
  it('shows the text as an alert, so screen readers announce it', () => {
    render(<ErrorMessage text="Network error. Check your connection." />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Network error. Check your connection.',
    );
  });
});
