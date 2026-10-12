import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FooterPrompt } from './FooterPrompt';
import { ScreenType } from './types';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('FooterPrompt', () => {
  it.each([
    [ScreenType.SignIn, '/sign-up'],
    [ScreenType.SignUp, '/sign-in'],
    [ScreenType.ForgotPassword, '/sign-up'],
  ])('asks the %s question and links to the other path', (screenType, path) => {
    renderWithProviders(<FooterPrompt screen={screenType} changePath={path} />);

    expect(
      screen.getByText(`${screenType}.changePathDescription`, { exact: false }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: `${screenType}.changePathButton` }),
    ).toHaveAttribute('href', path);
  });

  // As in the app, on the two screens whose other path is to sign out.
  it.each([ScreenType.EmailVerification, ScreenType.CompleteProfile])(
    'asks the %s question and runs the action instead of going somewhere',
    async screenType => {
      const action = vi.fn();
      renderWithProviders(
        <FooterPrompt screen={screenType} changePath={action} />,
      );

      expect(
        screen.getByText(`${screenType}.changePathDescription`, {
          exact: false,
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      const button = screen.getByRole('button', {
        name: `${screenType}.changePathButton`,
      });
      expect(button).toHaveAttribute('type', 'button');

      await userEvent.click(button);

      expect(action).toHaveBeenCalledTimes(1);
    },
  );
});
