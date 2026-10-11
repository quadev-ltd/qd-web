import { screen } from '@testing-library/react';

import { BrandLink } from './BrandLink';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('BrandLink', () => {
  it('links to the home page with the wordmark as its name', () => {
    renderWithProviders(<BrandLink />, { route: '/privacy-policy' });

    expect(screen.getByRole('link', { name: 'brand.name' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('hides the mark from assistive technology', () => {
    renderWithProviders(<BrandLink />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
