import { screen } from '@testing-library/react';

import { Layout } from './Layout';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

const card = () => screen.getByRole('heading', { level: 1 }).parentElement!;

describe('Layout', () => {
  it('shows the title, a text under it and the content, and names the tab', () => {
    renderWithProviders(
      <Layout documentTitle="Tab" title="Title" subtitle="Subtitle">
        <p>Content</p>
      </Layout>,
    );

    expect(document.title).toBe('Tab');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Subtitle').tagName).toBe('P');
    expect(screen.getByText('Content')).toBeInTheDocument();
    expect(card()).not.toHaveClass('text-center');
  });

  it('has no logo above the card by default', () => {
    renderWithProviders(
      <Layout documentTitle="Tab" title="Title">
        <p>Content</p>
      </Layout>,
    );

    expect(
      screen.queryByRole('img', { name: 'brand.logoAlt' }),
    ).not.toBeInTheDocument();
  });

  it('shows the logo above the card when asked', () => {
    renderWithProviders(
      <Layout documentTitle="Tab" title="Title" showLogo>
        <p>Content</p>
      </Layout>,
    );

    expect(
      screen.getByRole('img', { name: 'brand.logoAlt' }),
    ).toBeInTheDocument();
  });

  it.each([
    [undefined, 'max-w-[440px]'],
    ['narrow', 'max-w-[440px]'],
    ['medium', 'max-w-[480px]'],
    ['wide', 'max-w-[520px]'],
  ] as const)('is %s wide: %s', (width, className) => {
    renderWithProviders(
      <Layout documentTitle="Tab" title="Title" width={width}>
        <p>Content</p>
      </Layout>,
    );

    expect(card().parentElement).toHaveClass(className);
  });

  it('can put a picture above the title and centre the heading', () => {
    renderWithProviders(
      <Layout
        documentTitle="Tab"
        title="Title"
        centered
        icon={<span data-testid="picture" />}
        subtitle={
          <>
            <p>First paragraph</p>
            <p>Second paragraph</p>
          </>
        }>
        <p>Content</p>
      </Layout>,
    );

    const heading = card();
    expect(heading).toHaveClass('items-center', 'text-center');
    expect(heading.firstElementChild).toBe(screen.getByTestId('picture'));
    expect(screen.getByText('First paragraph')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph')).toBeInTheDocument();
  });

  it('shows what it is given on the right of the header', () => {
    renderWithProviders(
      <Layout
        documentTitle="Tab"
        title="Title"
        headerActions={<button type="button">Action</button>}>
        <p>Content</p>
      </Layout>,
    );

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('button', { name: 'Action' }),
    );
  });
});
