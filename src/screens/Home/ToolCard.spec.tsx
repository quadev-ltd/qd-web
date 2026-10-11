import { render, screen } from '@testing-library/react';

import { ToolCard } from './ToolCard';

const renderCard = (available: boolean) =>
  render(
    <ToolCard
      icon={<svg data-testid="icon" />}
      title="Mock interview"
      description="Practise with an AI interviewer."
      available={available}
    />,
  );

describe('ToolCard', () => {
  it('shows the tool as an article with its title and description', () => {
    renderCard(false);

    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('Practise with an AI interviewer.');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Mock interview' }),
    ).toBeInTheDocument();
  });

  it('says "Coming soon" while the tool is not available', () => {
    renderCard(false);

    expect(screen.getByText('home.comingSoonChip')).toBeInTheDocument();
    expect(screen.queryByText('home.availableChip')).not.toBeInTheDocument();
  });

  it('says "Available" when the tool is available', () => {
    renderCard(true);

    expect(screen.getByText('home.availableChip')).toBeInTheDocument();
    expect(screen.queryByText('home.comingSoonChip')).not.toBeInTheDocument();
  });

  it('hides the icon from assistive technology', () => {
    renderCard(false);

    expect(screen.getByTestId('icon').parentElement).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
