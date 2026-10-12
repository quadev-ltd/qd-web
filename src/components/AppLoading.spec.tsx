import { render, screen } from '@testing-library/react';

import AppLoading from './AppLoading';

describe('AppLoading', () => {
  it('shows the logo and a ring that is announced as loading', () => {
    render(<AppLoading />);

    expect(screen.getByRole('img', { name: 'brand.logoAlt' })).toBeVisible();
    expect(
      screen.getByRole('status', { name: 'spinner.accessibilityLabel' }),
    ).toBeInTheDocument();
    expect(document.title).toBe('publicHome.documentTitle');
  });

  it('is the whole page: no header, no footer, nothing to press', () => {
    render(<AppLoading />);

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
