// Mirrors qd-mobile src/screens/SignIn/SignInScreen.spec.tsx.
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';

import { SignInScreen } from './SignInScreen';

import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const ForgotPasswordProbe = () => {
  const { state } = useLocation();
  return <p>{`forgot password, state=${JSON.stringify(state)}`}</p>;
};

const renderScreen = () => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(
    <Routes>
      <Route path="/sign-in" element={<SignInScreen />} />
      <Route path="/sign-up" element={<p>sign up screen</p>} />
      <Route path="/forgot-password" element={<ForgotPasswordProbe />} />
    </Routes>,
    { route: '/sign-in', gateway },
  );
  return { gateway, ...utils };
};

describe('SignInScreen', () => {
  it('renders correctly', () => {
    renderScreen();

    expect(
      screen.getByRole('heading', { level: 1, name: 'signIn.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('signIn.subtitle')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'brand.logoAlt' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('signIn.emailLabel')).toBeInTheDocument();
    expect(screen.getByLabelText('signIn.passwordLabel')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('signUp.firstNameLabel'),
    ).not.toBeInTheDocument();
  });

  it('sets the browser tab title', () => {
    renderScreen();

    expect(document.title).toBe('signIn.documentTitle');
  });

  it('links to the legal pages from the header', () => {
    renderScreen();

    const nav = screen.getByRole('navigation', {
      name: 'header.legalNavAccessibilityLabel',
    });
    expect(nav).toContainElement(
      screen.getAllByRole('link', { name: 'footer.privacyPolicy' })[0],
    );
    expect(
      screen.getAllByRole('link', { name: 'footer.termsAndConditions' })[0],
    ).toHaveAttribute('href', '/terms-and-conditions');
  });

  it('navigates to the sign-up screen on change path action', async () => {
    renderScreen();

    await userEvent.click(
      screen.getByRole('link', { name: 'signIn.changePathButton' }),
    );

    expect(screen.getByText('sign up screen')).toBeInTheDocument();
  });

  it('opens the forgot-password screen without an email by default', async () => {
    renderScreen();

    await userEvent.click(
      screen.getByRole('link', { name: 'signIn.forgotButton' }),
    );

    expect(screen.getByText('forgot password, state=null')).toBeInTheDocument();
  });

  it('carries the email to the forgot-password screen after a failed sign-in', async () => {
    const { gateway } = renderScreen();
    gateway.signInWithEmail.mockRejectedValue({
      code: 'auth/invalid-credential',
    });
    await userEvent.type(
      screen.getByLabelText('signIn.emailLabel'),
      'ada@example.com',
    );
    await userEvent.type(
      screen.getByLabelText('signIn.passwordLabel'),
      'Wr0ngPassword!',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'signIn.submitButton' }),
    );
    await screen.findByText('fieldError.invalidEmailOrPasswordError');

    await userEvent.click(
      screen.getByRole('link', { name: 'signIn.forgotButton' }),
    );

    expect(
      screen.getByText('forgot password, state={"email":"ada@example.com"}'),
    ).toBeInTheDocument();
  });
});
