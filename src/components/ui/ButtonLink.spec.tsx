import { screen } from '@testing-library/react';

import { ButtonLink } from './ButtonLink';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('ButtonLink', () => {
  it('is a link to the given page', () => {
    renderWithProviders(<ButtonLink to="/delete-account">Go</ButtonLink>);

    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute(
      'href',
      '/delete-account',
    );
  });

  it('applies the variant and the size', () => {
    renderWithProviders(
      <ButtonLink to="/" variant="outline" size="large">
        Go
      </ButtonLink>,
    );

    expect(screen.getByRole('link', { name: 'Go' })).toHaveClass(
      'border-white',
      'h-[52px]',
      'rounded-cta',
    );
  });
});
