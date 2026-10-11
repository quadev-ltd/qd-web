// Mirrors qd-mobile src/components/SignIn/types.ts (the screens the web has). The values are
// the translation areas: t(`${screen}.changePathButton`).
export enum ScreenType {
  SignIn = 'signIn',
  SignUp = 'signUp',
  ForgotPassword = 'forgotPassword',
}

/** The screens with the Google and Apple buttons. */
export type SSOScreenType = ScreenType.SignIn | ScreenType.SignUp;
