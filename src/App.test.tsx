import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';

// Mock the MUI ThemeProvider and CssBaseline
jest.mock('@mui/material', () => {
  const originalModule = jest.requireActual('@mui/material');
  return {
    __esModule: true,
    ...originalModule,
    ThemeProvider: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="mock-theme-provider">{children}</div>
    ),
    CssBaseline: () => <div data-testid="mock-css-baseline" />,
  };
});

// Mock the custom theme
jest.mock('./theme/theme', () => ({
  theme: {}, // or define a partial theme object here if needed
}));

// Mock AppRoutes
jest.mock('./routes/AppRoutes', () => {
  return function MockAppRoutes() {
    return <div data-testid="mock-app-routes">Mock App Routes</div>;
  };
});

describe('App Component', () => {
  it('renders without crashing and includes all the mocked components', () => {
    render(<App />);

    // Verify that the mocked ThemeProvider is in the document
    expect(screen.getByTestId('mock-theme-provider')).toBeInTheDocument();

    // Verify that the mocked CssBaseline is in the document
    expect(screen.getByTestId('mock-css-baseline')).toBeInTheDocument();

    // Verify that the mocked AppRoutes is in the document
    expect(screen.getByTestId('mock-app-routes')).toBeInTheDocument();
  });
});
