import { screen } from '@testing-library/react';

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
});
