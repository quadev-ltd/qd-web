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
});
