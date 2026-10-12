// The web version of qd-mobile .maestro/auth-email-lifecycle.yaml, against the preview auth
// gateway: sign up -> verify the email -> complete the profile (when it is missing) ->
// signed-in home with the own name -> reload keeps the session -> sign out -> public home ->
// sign in again -> delete the account -> back on the public home, account gone.
import { expect, test } from '@playwright/test';

import {
  loseProfile,
  newEmail,
  openVerificationLink,
  PASSWORD,
  SAMPLE_USER,
  signIn,
  signUp,
} from './support';

const NOT_VERIFIED_YET =
  "Your email isn't verified yet. Open the link in the email, then try again.";

test('email account: sign up, verify, complete the profile, home, sign out, sign in again, delete', async ({
  page,
}) => {
  const email = newEmail();

  await page.goto('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Building robust software solutions',
    }),
  ).toBeVisible();

  // Sign up (no date of birth: it is optional)
  await page.getByRole('link', { name: 'Create your account' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Create your account' }),
  ).toBeVisible();
  await page.getByLabel('First name').fill('Grace');
  await page.getByLabel('Last name').fill('Hopper');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();

  // Verify email: the session moved here by itself
  await expect(page).toHaveURL('/verify-email');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome to QuaDev Grace!' }),
  ).toBeVisible();
  const main = page.getByRole('main');
  await expect(main).toContainText(
    `We've sent a verification email to ${email}.`,
  );
  await expect(main).toContainText(
    'Open the link in the email, then come back and press "I\'ve verified my email".',
  );

  // The signed-in pages are closed until the email is verified, and a reload stays here
  await page.goto('/home');
  await expect(page).toHaveURL('/verify-email');
  await page.reload();
  await expect(page).toHaveURL('/verify-email');

  // Too early: the link was not opened yet
  const verified = page.getByRole('button', { name: "I've verified my email" });
  await verified.click();
  await expect(page.getByRole('alert')).toHaveText(NOT_VERIFIED_YET);
  await expect(page.getByRole('alert')).toBeFocused();

  // Resend: a minute to wait before the next one
  await page.getByRole('button', { name: 'Resend verification link' }).click();
  const resend = page.getByRole('button', { name: /^Resend link in \d+s$/ });
  await expect(resend).toBeDisabled();
  await expect(page.getByRole('alert')).toHaveCount(0);

  // The profile is missing (as after a failed write): the name is asked for after verifying
  await loseProfile(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome to QuaDev!' }),
  ).toBeVisible();

  // The link is opened, elsewhere; back here the user says so
  await openVerificationLink(page);
  await verified.click();

  // Complete profile
  await expect(page).toHaveURL('/complete-profile');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Complete your profile' }),
  ).toBeVisible();
  const firstName = page.getByLabel('First name');
  const lastName = page.getByLabel('Last name');
  const continueButton = page.getByRole('button', { name: 'Continue' });
  await continueButton.click();
  await expect(firstName).toHaveAccessibleDescription('Required');
  await expect(lastName).toHaveAccessibleDescription('Required');
  await expect(firstName).toBeFocused();
  await firstName.fill('Grace');
  await lastName.fill('Hopper');
  await page.getByLabel(/Date of birth/).fill('09121906');
  await expect(page.getByLabel(/Date of birth/)).toHaveValue('09/12/1906');
  await continueButton.click();

  // Signed-in home: the session moved here by itself
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();
  const account = page.getByRole('region', { name: 'Your account' });
  await expect(account).toContainText('Grace Hopper');
  await expect(account).toContainText(email);
  await expect(account).toContainText('09/12/1906');
  await expect(account).toContainText('Email and password');
  // The feature flags are off by default: every tool is "Coming soon"
  await expect(page.getByRole('article')).toHaveCount(3);
  await expect(page.getByText('Coming soon')).toHaveCount(3);

  // The two steps are behind: their pages lead back home
  await page.goto('/verify-email');
  await expect(page).toHaveURL('/home');
  await page.goto('/complete-profile');
  await expect(page).toHaveURL('/home');

  // A reload keeps the session
  await page.reload();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();

  // The account menu shows the name; sign out from it
  const menuButton = page.getByRole('button', {
    name: 'Account menu for Grace Hopper',
  });
  await expect(menuButton).toContainText('Grace');
  await menuButton.click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  // Back on the public home, signed out
  await expect(page).toHaveURL('/');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Building robust software solutions',
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Create your account' }),
  ).toBeVisible();
  await expect(page.getByText('Account successfully deleted')).toHaveCount(0);

  // The signed-in pages are closed again
  await page.goto('/account/delete');
  await expect(page).toHaveURL('/sign-in');

  // Sign in again with the new account
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();

  // Delete account: the question first, and Cancel leads back
  await page.getByRole('link', { name: 'Delete account' }).click();
  await expect(page).toHaveURL('/account/delete');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Are you sure?' }),
  ).toBeVisible();
  await expect(page.getByRole('main')).toContainText(
    'Deleting your account will permanently erase all your data',
  );
  await page.getByRole('link', { name: 'Cancel' }).click();
  await expect(page).toHaveURL('/home');
  await page.getByRole('link', { name: 'Delete account' }).click();

  // The password is asked for, and a wrong one is refused
  const deleteButton = page.getByRole('button', { name: 'Delete account' });
  await deleteButton.click();
  await expect(page.getByRole('main')).toContainText(
    'For your security, enter your password to confirm that you want to delete your account.',
  );
  const password = page.getByLabel('Password', { exact: true });
  await expect(password).toBeFocused();
  await expect(deleteButton).toBeDisabled();
  await password.fill('Wr0ngPassword!');
  await deleteButton.click();
  await expect(page.getByRole('alert')).toHaveText('Invalid email or password');
  await expect(page).toHaveURL('/account/delete');

  // The right one deletes the account
  await password.fill(PASSWORD);
  await deleteButton.click();

  // Back on the public home, with the confirmation
  await expect(page).toHaveURL('/');
  const notice = page.getByRole('status').filter({
    hasText: 'Account successfully deleted',
  });
  await expect(notice).toContainText(
    'Your account has been successfully deleted.',
  );
  await expect(notice).toBeFocused();
  await expect(
    page.getByRole('link', { name: 'Create your account' }),
  ).toBeVisible();

  // The account is gone, and so is the confirmation once the user moves on
  await signIn(page, email, PASSWORD);
  await expect(page.getByLabel('Email')).toHaveAccessibleDescription(
    'Invalid email or password',
  );
  await page.goto('/');
  await expect(page.getByText('Account successfully deleted')).toHaveCount(0);
});

test('verify email: coming back to the tab checks by itself', async ({
  page,
}) => {
  await signUp(page);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome to QuaDev Grace!' }),
  ).toBeVisible();

  // Coming back before the link was opened changes nothing, and says nothing
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(page).toHaveURL('/verify-email');
  await expect(page.getByRole('alert')).toHaveCount(0);

  // The link is opened in another tab; this one becomes visible again
  await openVerificationLink(page);
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );

  // The profile of the sign-up form is there: straight to the signed-in home
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Welcome back, Grace' }),
  ).toBeVisible();
});

test('verify email and complete profile: the ways out', async ({ page }) => {
  const email = await signUp(page);

  // "Use another account" signs out and leads to the sign-in screen
  await page.getByRole('button', { name: 'Use another account' }).click();
  await expect(page).toHaveURL('/sign-in');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' }),
  ).toBeVisible();

  // The account is still unverified: signing in leads back to the verify-email screen
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/verify-email');

  // "Sign out" in the header leads to the public home
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/');

  // The same from the complete-profile screen, with "Not you? Sign out"
  await signIn(page, email, PASSWORD);
  await expect(page).toHaveURL('/verify-email');
  await loseProfile(page);
  await openVerificationLink(page);
  await page.getByRole('button', { name: "I've verified my email" }).click();
  await expect(page).toHaveURL('/complete-profile');
  await page
    .getByRole('main')
    .getByRole('button', { name: 'Sign out' })
    .click();
  await expect(page).toHaveURL('/');
});

test('delete account with Google: no password, the confirmation on the public home', async ({
  page,
}) => {
  // The sample account has Google among its sign-in methods: it confirms with Google (the
  // preview has no Google window) and, being built in, is only signed out.
  await signIn(page);
  await expect(page).toHaveURL('/home');
  await page.goto('/account/delete');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Are you sure?' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Delete account' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByText('Account successfully deleted')).toBeVisible();
  await page.goto('/home');
  await expect(page).toHaveURL('/sign-in');
  // (the sample account can still sign in: the other tests need it)
  await signIn(page, SAMPLE_USER.email, SAMPLE_USER.password);
  await expect(page).toHaveURL('/home');
});
