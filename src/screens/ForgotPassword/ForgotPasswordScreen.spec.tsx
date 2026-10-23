import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ForgotPasswordScreen } from './ForgotPasswordScreen';

import { SessionStatus } from '@/core/state/slices/sessionSlice';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

describe('ForgotPasswordScreen', () => {
  it('shows the title, the explanation, the email field and the submit button', () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'forgotPassword.title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('forgotPassword.subtitle')).toBeInTheDocument();
    expect(screen.getByLabelText('forgotPassword.emailLabel')).toHaveValue('');
    expect(
      screen.getByRole('button', { name: 'forgotPassword.submitButton' }),
    ).toHaveAttribute('type', 'submit');
    expect(document.title).toBe('forgotPassword.documentTitle');
  });

  it('links back to sign in from the header, and to sign up', () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
    });

    expect(
      screen.getByText('forgotPassword.rememberedPrompt'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'landing.changePathButton' }),
    ).toHaveAttribute('href', '/sign-in');
    expect(
      screen.getByRole('link', { name: 'forgotPassword.changePathButton' }),
    ).toHaveAttribute('href', '/sign-up');
  });

  it('offers the way back to sign in under the success message', async () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
      routeState: { email: 'ada@example.com' },
      gateway: createMockGateway(),
    });

    await userEvent.click(
      screen.getByRole('button', { name: 'forgotPassword.submitButton' }),
    );

    expect(
      await screen.findByRole('link', {
        name: 'forgotPassword.backToSignInLink',
      }),
    ).toHaveAttribute('href', '/sign-in');
  });

  it('starts with the email carried over from the sign-in screen', () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
      routeState: { email: 'ada@example.com' },
    });

    expect(screen.getByLabelText('forgotPassword.emailLabel')).toHaveValue(
      'ada@example.com',
    );
  });

  it('ignores a carried-over value that is not an email text', () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
      routeState: { email: 42 },
    });

    expect(screen.getByLabelText('forgotPassword.emailLabel')).toHaveValue('');
  });

  it('leads a signed-in user back to their account page, without the sign-up prompt', () => {
    renderWithProviders(<ForgotPasswordScreen />, {
      route: '/forgot-password',
      routeState: { email: 'ada@example.com' },
      session: { status: SessionStatus.Ready },
    });

    expect(
      screen.getByRole('link', { name: 'forgotPassword.backToHomeLink' }),
    ).toHaveAttribute('href', '/account');
    expect(
      screen.queryByText('forgotPassword.rememberedPrompt'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'landing.changePathButton' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'forgotPassword.changePathButton' }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('forgotPassword.emailLabel')).toHaveValue(
      'ada@example.com',
    );
  });
});
