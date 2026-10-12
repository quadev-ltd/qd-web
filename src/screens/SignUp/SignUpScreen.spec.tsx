// Mirrors qd-mobile src/screens/SignUp/SignUpScreen.spec.tsx.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { SignUpScreen } from './SignUpScreen';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const renderScreen = () =>
  renderWithProviders(
    <Routes>
      <Route path="/sign-up" element={<SignUpScreen />} />
      <Route path="/sign-in" element={<p>sign in screen</p>} />
    </Routes>,
    { route: '/sign-up' },
  );

describe('SignUpScreen', () => {
  it('renders correctly', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'signUp.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('signUp.subtitle')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signUp.withGoogle' }),
    ).toBeInTheDocument();
    // Apple sign-in is not set up for the web yet (src/core/sso/providers.ts).
    expect(
      screen.queryByRole('button', { name: 'signUp.withApple' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('signUp.firstNameLabel')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signUp.submitButton' }),
    ).toBeInTheDocument();
  });

  it('sets the browser tab title', () => {
    renderScreen();

    expect(document.title).toBe('signUp.documentTitle');
  });

  it('links to the sign-in screen from the header and from the prompt', () => {
    renderScreen();

    const links = screen.getAllByRole('link', {
      name: 'signUp.changePathButton',
    });
    expect(links).toHaveLength(2);
    links.forEach(link => expect(link).toHaveAttribute('href', '/sign-in'));
  });

  it('navigates to the sign-in screen on change path action', async () => {
    renderScreen();

    await userEvent.click(
      screen.getAllByRole('link', { name: 'signUp.changePathButton' })[1],
    );

    expect(screen.getByText('sign in screen')).toBeInTheDocument();
  });
});
