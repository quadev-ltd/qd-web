import { render, screen } from '@testing-library/react';

import { LinkPageCard } from './LinkPageCard';

const ADDED = Date.parse('2026-10-12T09:30:00Z');

describe('LinkPageCard', () => {
  it('shows where the page is, when it was read, and opens it in another tab', () => {
    render(
      <LinkPageCard
        address={
          new URL('https://engineering.example/blog/ledger-event-sourcing')
        }
        createdAt={ADDED}
      />,
    );

    const card = screen.getByRole('region', { name: 'resource.pageTitle' });
    expect(card).toHaveTextContent('engineering.example');
    expect(card).toHaveTextContent('/blog/ledger-event-sourcing');
    expect(card).toHaveTextContent('resource.pageReadOn');
    const open = screen.getByRole('link', { name: 'resource.openPageLink' });
    expect(open).toHaveAttribute(
      'href',
      'https://engineering.example/blog/ledger-event-sourcing',
    );
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noreferrer');
  });

  it('names only the site for its home page, and says it was read without a day when there is none', () => {
    render(
      <LinkPageCard
        address={new URL('https://maya.example/')}
        createdAt={null}
      />,
    );

    const card = screen.getByRole('region', { name: 'resource.pageTitle' });
    expect(card).toHaveTextContent('maya.example');
    expect(card).not.toHaveTextContent('maya.example/');
    expect(card).toHaveTextContent('resource.pageRead');
    expect(card).not.toHaveTextContent('resource.pageReadOn');
  });
});
