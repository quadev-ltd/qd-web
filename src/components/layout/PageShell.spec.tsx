import { screen, waitFor } from '@testing-library/react';

import { PageShell } from './PageShell';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('PageShell', () => {
  it('frames the content with a header, a main area and a footer', () => {
    renderWithProviders(<PageShell title="Page">Content</PageShell>);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Content');
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('sets the browser tab title', async () => {
    renderWithProviders(<PageShell title="Page | QuaDev">Content</PageShell>);

    await waitFor(() => expect(document.title).toBe('Page | QuaDev'));
  });

  it('shows the header actions', () => {
    renderWithProviders(
      <PageShell title="Page" headerActions={<a href="/somewhere">Action</a>}>
        Content
      </PageShell>,
    );

    expect(screen.getByRole('link', { name: 'Action' })).toBeInTheDocument();
  });

  it('shows the decorative arcs only with the brand tone, hidden from assistive technology', () => {
    const { unmount } = renderWithProviders(
      <PageShell title="Page" tone="brand">
        Content
      </PageShell>,
    );

    expect(screen.getByTestId('arcs')).toHaveAttribute('aria-hidden', 'true');
    unmount();

    renderWithProviders(<PageShell title="Page">Content</PageShell>);

    expect(screen.queryByTestId('arcs')).not.toBeInTheDocument();
  });
});
