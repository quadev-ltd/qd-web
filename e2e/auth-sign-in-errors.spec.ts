// The web version of qd-mobile .maestro/auth-sign-in-errors.yaml, against the preview auth
// gateway: empty and invalid fields, a wrong password ("Invalid email or password"), forgot
// password (the neutral message), then a successful sign-in.
import { expect, test } from '@playwright/test';

import { SAMPLE_USER } from './support';

test('sign-in errors: empty and invalid fields, wrong password, forgot password, then success', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Account' })
    .getByRole('link', { name: 'Sign in' })
    .click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Sign in' }),
  ).toBeVisible();

  const email = page.getByLabel('Email');
  const password = page.getByLabel('Password', { exact: true });
  const submit = page.getByRole('button', { name: 'Sign in', exact: true });

  // Nothing typed: both fields are required, and the first one takes the focus
  await submit.click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toHaveAccessibleDescription('Required');
  await expect(password).toHaveAccessibleDescription('Required');
  await expect(email).toBeFocused();

  // Invalid email and a password that breaks the rules
  await email.fill('not-an-email');
  await password.fill('password');
  await expect(
    page.getByText('Must contain at least one uppercase letter'),
  ).toBeVisible();
  await submit.click();
  await expect(email).toHaveAccessibleDescription(
    'Please enter a valid email address',
  );
  await expect(page.getByText('Password format is invalid')).toBeVisible();
  await expect(page).toHaveURL('/sign-in');

  // Show and hide the password
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password' }).click();
  await expect(password).toHaveAttribute('type', 'password');

  // Wrong password
  await email.fill(SAMPLE_USER.email);
  await password.fill('Wr0ngPassword!');
  await submit.click();
  await expect(email).toHaveAccessibleDescription('Invalid email or password');
  await expect(page).toHaveURL('/sign-in');

  // Forgot password: the email is carried over, and the message is neutral
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Reset password' }),
  ).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue(SAMPLE_USER.email);
  await page.getByRole('button', { name: 'Reset Password' }).click();
  await expect(
    page.getByText(/If an account exists for that email/),
  ).toBeVisible();

  // Back to sign in, with the right password this time
  await page.getByRole('link', { name: 'Back to sign in' }).click();
  await page.getByLabel('Email').fill(SAMPLE_USER.email);
  await page.getByLabel('Password', { exact: true }).fill(SAMPLE_USER.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL('/home');
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: `Welcome back, ${SAMPLE_USER.firstName}`,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Your account' }),
  ).toContainText(`${SAMPLE_USER.firstName} ${SAMPLE_USER.lastName}`);
});

test('sign up with an email that already has an account shows the error on the email field', async ({
  page,
}) => {
  await page.goto('/sign-up');
  await page.getByLabel('First name').fill('Ada');
  await page.getByLabel('Last name').fill('Lovelace');
  await page.getByLabel('Email').fill(SAMPLE_USER.email);
  await page.getByLabel(/Date of birth/).fill('10121815');
  await expect(page.getByLabel(/Date of birth/)).toHaveValue('10/12/1815');
  await page.getByLabel('Password', { exact: true }).fill(SAMPLE_USER.password);
  await page.getByLabel('Confirm password').fill(SAMPLE_USER.password);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.getByRole('button', { name: 'Sign up', exact: true }).click();

  await expect(page.getByLabel('Email')).toHaveAccessibleDescription(
    'Email is already in use',
  );
  await expect(page).toHaveURL('/sign-up');
});
