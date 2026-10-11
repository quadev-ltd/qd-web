import { render, screen } from '@testing-library/react';

import { Chip } from './Chip';

describe('Chip', () => {
  it('shows its label', () => {
    render(<Chip>Coming soon</Chip>);

    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });
});
