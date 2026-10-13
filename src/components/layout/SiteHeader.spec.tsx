import { screen } from '@testing-library/react';

import { SiteHeader } from './SiteHeader';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('SiteHeader', () => {
  it('shows the brand and the actions', () => {
    renderWithProviders(
      <SiteHeader>
        <a href="/sign-in">Sign in</a>
      </SiteHeader>,
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-surface', 'dark');
    expect(header).toContainElement(
      screen.getByRole('link', { name: 'brand.name' }),
    );
    expect(header).toContainElement(
      screen.getByRole('link', { name: 'Sign in' }),
    );
  });

  it('puts the navigation between the brand and the actions', () => {
    renderWithProviders(
      <SiteHeader tone="solid" nav={<nav aria-label="Main">Links</nav>}>
        <button type="button">Account</button>
      </SiteHeader>,
    );

    const [brand, navigation, actions] = Array.from(
      screen.getByRole('banner').children,
    );
    expect(brand).toHaveTextContent('brand.name');
    expect(navigation).toContainElement(
      screen.getByRole('navigation', { name: 'Main' }),
    );
    expect(actions).toContainElement(
      screen.getByRole('button', { name: 'Account' }),
    );
  });

  it('gives the navigation a row of its own on a narrow screen, under the brand and the actions', () => {
    renderWithProviders(
      <SiteHeader nav={<nav aria-label="Main">Links</nav>}>
        <button type="button">Account</button>
      </SiteHeader>,
    );

    const row = screen.getByRole('navigation', { name: 'Main' }).parentElement;
    expect(row).toHaveClass('order-3', 'basis-full');
    expect(row).toHaveClass('min-[721px]:order-none', 'min-[721px]:basis-auto');
    expect(
      screen.getByRole('button', { name: 'Account' }).parentElement,
    ).toHaveClass('ml-auto');
  });
});
