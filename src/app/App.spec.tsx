import { render, screen } from '@testing-library/react';

import { App } from './App';

// The configuration comes from .env.test (account flag off).

describe('App', () => {
  it('renders the screen for the current URL', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'publicHome.title' }),
    ).toBeInTheDocument();
  });
});
