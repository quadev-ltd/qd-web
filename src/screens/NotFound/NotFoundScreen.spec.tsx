import { screen } from '@testing-library/react';

import { NotFoundScreen } from './NotFoundScreen';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('NotFoundScreen', () => {
  it('says the page was not found', () => {
    renderWithProviders(<NotFoundScreen />, { route: '/nowhere' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'notFound.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('notFound.description')).toBeInTheDocument();
  });

  it('links back to the home page', () => {
    renderWithProviders(<NotFoundScreen />, { route: '/nowhere' });

    expect(
      screen.getByRole('link', { name: 'notFound.homeLink' }),
    ).toHaveAttribute('href', '/');
  });
});
