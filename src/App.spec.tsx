import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import App from './App';

// Mock the MUI ThemeProvider and CssBaseline
vi.mock('@mui/material', async importOriginal => {
  const originalModule = await importOriginal<object>();
  return {
    ...originalModule,
    ThemeProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="mock-theme-provider">{children}</div>
    ),
    CssBaseline: () => <div data-testid="mock-css-baseline" />,
  };
});

// Mock the custom theme
vi.mock('./theme/theme', () => ({
  theme: {},
}));

// Mock AppRoutes
vi.mock('./routes/AppRoutes', () => ({
  default: () => <div data-testid="mock-app-routes">Mock App Routes</div>,
}));

describe('App', () => {
  it('renders without crashing and includes all the mocked components', () => {
    render(<App />);

    expect(screen.getByTestId('mock-theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('mock-css-baseline')).toBeInTheDocument();
    expect(screen.getByTestId('mock-app-routes')).toBeInTheDocument();
  });
});
