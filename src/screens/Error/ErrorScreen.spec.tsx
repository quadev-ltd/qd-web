import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { ErrorScreen } from './ErrorScreen';

const mockLogError = vi.hoisted(() => vi.fn());

vi.mock('@/core/logger', () => ({
  default: () => ({ logError: mockLogError, logMessage: vi.fn() }),
}));

const failure = new Error('render failed');

const Broken: React.FC = () => {
  throw failure;
};

const renderBrokenRoute = () =>
  render(
    <RouterProvider
      router={createMemoryRouter([
        { path: '/', element: <Broken />, errorElement: <ErrorScreen /> },
      ])}
    />,
  );

describe('ErrorScreen', () => {
  beforeEach(() => {
    mockLogError.mockClear();
    // React and the router report the thrown error on the console.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a message and a link home when a screen fails to render', () => {
    renderBrokenRoute();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'error.unexpectedErrorTitle',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('error.unexpectedErrorMessage'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'notFound.homeLink' }),
    ).toHaveAttribute('href', '/');
  });

  it('logs the error', () => {
    renderBrokenRoute();

    expect(mockLogError).toHaveBeenCalledWith(failure);
  });
});
