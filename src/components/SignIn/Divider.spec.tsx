import { render, screen } from '@testing-library/react';

import { Divider } from './Divider';

describe('Divider', () => {
  it('shows its label between two decorative lines', () => {
    const { container } = render(<Divider label="or" />);

    expect(screen.getByText('or')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
