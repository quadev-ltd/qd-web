import { render, screen } from '@testing-library/react';

import { NotAvailable } from './NotAvailable';

describe('NotAvailable', () => {
  it('names the tool, says it is not on for this account yet and that nothing needs doing', () => {
    render(
      <NotAvailable icon="user" title="Profile" description="What it does." />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'Profile' }),
    ).toBeInTheDocument();
    expect(screen.getByText('access.notAvailableChip')).toBeInTheDocument();
    expect(screen.getByText('What it does.')).toBeInTheDocument();
    expect(screen.getByText('access.stagesDescription')).toBeInTheDocument();
  });

  it('offers nothing to press: there is nothing the user can do about it', () => {
    render(
      <NotAvailable icon="user" title="Profile" description="What it does." />,
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps its icon out of the way of assistive technology', () => {
    const { container } = render(
      <NotAvailable icon="user" title="Profile" description="What it does." />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
