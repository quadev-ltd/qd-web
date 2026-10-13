import { render, screen } from '@testing-library/react';

import { Chip } from './Chip';

describe('Chip', () => {
  it('shows its label', () => {
    render(<Chip>Coming soon</Chip>);

    expect(screen.getByText('Coming soon')).toBeInTheDocument();
  });

  it('is the blue "worth knowing" chip by default', () => {
    render(<Chip>Coming soon</Chip>);

    expect(screen.getByText('Coming soon')).toHaveClass(
      'bg-chip',
      'text-chip-text',
    );
  });

  it.each([
    ['brand', 'bg-tint', 'text-primary-dark'],
    ['success', 'bg-success-tint', 'text-success'],
    ['warning', 'bg-warning-tint', 'text-warning'],
    ['danger', 'bg-danger-tint', 'text-danger'],
    ['neutral', 'bg-border-faint', 'text-muted'],
  ] as const)('has a %s tone', (tone, surface, text) => {
    render(<Chip tone={tone}>Label</Chip>);

    expect(screen.getByText('Label')).toHaveClass(surface, text);
  });

  it('can carry a small icon, which says nothing by itself', () => {
    const { container } = render(
      <Chip tone="brand" icon="link">
        Link
      </Chip>,
    );

    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '14');
    expect(screen.getByText('Link')).toContainElement(icon as never);
  });
});
