import { render, screen } from '@testing-library/react';

import { Card } from './Card';

describe('Card', () => {
  it('shows its content', () => {
    render(<Card>Content</Card>);

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders the requested element', () => {
    render(<Card as="article">Content</Card>);

    expect(screen.getByRole('article')).toHaveTextContent('Content');
  });

  it('is a white surface by default and translucent with the glass tone', () => {
    render(
      <>
        <Card>Surface</Card>
        <Card tone="glass">Glass</Card>
      </>,
    );

    expect(screen.getByText('Surface')).toHaveClass('bg-surface');
    expect(screen.getByText('Glass')).toHaveClass('bg-white/10');
  });

  it('declares the white card as a light surface, for the focus ring colour', () => {
    render(
      <>
        <Card>Surface</Card>
        <Card tone="glass">Glass</Card>
      </>,
    );

    expect(screen.getByText('Surface')).toHaveAttribute(
      'data-surface',
      'light',
    );
    expect(screen.getByText('Glass')).not.toHaveAttribute('data-surface');
  });

  it('has more padding when asked', () => {
    render(
      <>
        <Card>Standard</Card>
        <Card padding="roomy">Roomy</Card>
      </>,
    );

    expect(screen.getByText('Standard')).toHaveClass('p-6');
    expect(screen.getByText('Roomy')).toHaveClass('p-[clamp(22px,6vw,36px)]');
    expect(screen.getByText('Roomy')).not.toHaveClass('p-6');
  });
});
