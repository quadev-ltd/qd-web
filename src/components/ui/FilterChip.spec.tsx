import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FilterChip } from './FilterChip';

describe('FilterChip', () => {
  it('is a button that says whether its filter is on', () => {
    const { rerender } = render(
      <FilterChip pressed={false} onClick={vi.fn()}>
        Starred
      </FilterChip>,
    );
    expect(screen.getByRole('button', { name: 'Starred' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(
      <FilterChip pressed onClick={vi.fn()}>
        Starred
      </FilterChip>,
    );
    const chip = screen.getByRole('button', { name: 'Starred' });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip).toHaveClass('bg-primary', 'text-white');
  });

  it('reports a press', async () => {
    const onClick = vi.fn();
    render(
      <FilterChip pressed={false} onClick={onClick}>
        Edited
      </FilterChip>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Edited' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fills its star when it is on, and keeps the icon out of its name', () => {
    const { container, rerender } = render(
      <FilterChip pressed={false} icon="star" onClick={vi.fn()}>
        Starred
      </FilterChip>,
    );
    expect(container.querySelector('svg')).toHaveAttribute('fill', 'none');

    rerender(
      <FilterChip pressed icon="star" onClick={vi.fn()}>
        Starred
      </FilterChip>,
    );
    expect(container.querySelector('svg')).toHaveAttribute(
      'fill',
      'currentColor',
    );
    expect(container.querySelector('svg')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
