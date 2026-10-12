import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SSOForm } from './SSOForm';
import { ScreenType } from './types';

import { AppAuthError, ACCOUNT_UNAVAILABLE } from '@/core/auth/errors';
import { type SSOSignInResult } from '@/core/auth/types';
import { createMockGateway } from '@/testUtil/mockGateway';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

// Apple sign-in is off on the web for now; these specs cover both settings.
const providers = vi.hoisted(() => ({ appleEnabled: true }));
vi.mock('@/core/sso/providers', () => ({
  get APPLE_SIGN_IN_ENABLED() {
    return providers.appleEnabled;
  },
}));

const result: SSOSignInResult = {
  user: {
    uid: 'uid-1',
    email: 'ada@example.com',
    emailVerified: true,
    displayName: null,
    providerIds: ['google.com'],
  },
  names: { firstName: 'Ada', lastName: 'L' },
};

const renderForm = (
  screenType: ScreenType.SignIn | ScreenType.SignUp = ScreenType.SignIn,
) => {
  const gateway = createMockGateway();
  const utils = renderWithProviders(
    <SSOForm
      screen={screenType}
      changePath="/other"
      documentTitle="Page"
      title="Title"
      subtitle="Subtitle">
      <p>the form</p>
    </SSOForm>,
    { gateway },
  );
  return { gateway, ...utils };
};

describe('SSOForm', () => {
  beforeEach(() => {
    providers.appleEnabled = true;
  });

  it('hides the Apple button while Apple sign-in is not set up for the web', () => {
    providers.appleEnabled = false;

    renderForm();

    expect(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'signIn.withApple' }),
    ).not.toBeInTheDocument();
  });

  it('shows the title, the two providers, the divider, the form and the prompt', () => {
    renderForm();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Title' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    ).toBeInTheDocument();
    expect(screen.getByText('signIn.withSSO')).toBeInTheDocument();
    expect(screen.getByText('the form')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'signIn.changePathButton' }),
    ).toHaveAttribute('href', '/other');
  });

  it('uses the sign-up wording on the sign-up screen', () => {
    renderForm(ScreenType.SignUp);

    expect(
      screen.getByRole('button', { name: 'signUp.withGoogle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'signUp.withApple' }),
    ).toBeInTheDocument();
  });

  it('signs in with Google through the gateway', async () => {
    const { gateway } = renderForm();
    gateway.signInWithGoogle.mockResolvedValue(result);

    await userEvent.click(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    );

    expect(gateway.signInWithGoogle).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(gateway.createProfileIfMissing).toHaveBeenCalledWith(
        'uid-1',
        result.names,
      ),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('signs in with Apple through the gateway', async () => {
    const { gateway } = renderForm();
    gateway.signInWithApple.mockResolvedValue(result);

    await userEvent.click(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    );

    expect(gateway.signInWithApple).toHaveBeenCalledTimes(1);
    expect(gateway.signInWithGoogle).not.toHaveBeenCalled();
  });

  it('disables both providers while one is signing in', async () => {
    const { gateway } = renderForm();
    gateway.signInWithGoogle.mockReturnValue(new Promise(() => undefined));

    await userEvent.click(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    );

    expect(
      screen.getByRole('button', { name: 'signIn.withGoogle' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    ).toBeDisabled();
  });

  it('says in the page that sign-in is not available yet', async () => {
    const { gateway } = renderForm();
    gateway.signInWithApple.mockRejectedValue(
      new AppAuthError(ACCOUNT_UNAVAILABLE),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.accountUnavailable',
    );
    expect(
      screen.getByRole('button', { name: 'signIn.withApple' }),
    ).toBeEnabled();
  });

  it('clears the message when the user tries again', async () => {
    const { gateway } = renderForm();
    gateway.signInWithGoogle.mockRejectedValueOnce({
      code: 'auth/network-request-failed',
    });
    gateway.signInWithGoogle.mockReturnValueOnce(new Promise(() => undefined));
    const google = screen.getByRole('button', { name: 'signIn.withGoogle' });

    await userEvent.click(google);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'error.networkError',
    );

    await userEvent.click(google);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
