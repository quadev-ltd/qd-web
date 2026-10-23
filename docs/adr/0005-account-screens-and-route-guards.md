# ADR 0005: The account screens after sign-in, and the route guards

- **Status:** accepted (October 2026). The screens are merged behind the account flag; no deployed
  site shows them yet.
- **Scope:** `src/screens/{VerifyEmail,CompleteProfile,DeleteAccount,ForgotPassword}/`,
  `src/components/AppLoading.tsx`, `src/app/guards.tsx`, `src/app/routes.tsx`,
  `src/core/state/slices/exitSlice.ts`, the preview controls in `src/core/auth/previewGateway.ts`

## Context

The mobile app has four screens the website lacked: verify email, complete profile, delete account
and the loading screen. The designs were approved on 12 October 2026 (option A, "Account flows";
research decision D38). Their text is the app's English text, with the differences the owner
accepted:

- the verify-email instruction says "press", not "tap";
- deleting with Google shows "Continue in the Google window that opened.";
- delete account has a Cancel button, and ends on the public home with a confirmation;
- while a form is being sent, it stays in place, disabled, and its button shows a spinner;
- static icons replace the app's animated GIFs.

The app decides what to show from the session status in one switch (its Router). On the web every
screen has an address, so a user can open any of them directly, whatever their session is.

## Decision

### One page per session status

| Session status           | Page                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| `signedOut`              | `/sign-in`, `/sign-up`                                                 |
| `needsEmailVerification` | `/verify-email`                                                        |
| `needsProfile`           | `/complete-profile`                                                    |
| `ready`                  | `/home`, `/account`, `/account/delete`, and the interview tools' pages |

The guards (`src/app/guards.tsx`) show a page only to a session in its status. Anyone else is sent to
the page of their own status, and a visitor who is not signed in to `/sign-in`. While the session is
`initializing` they show the loading screen. `/forgot-password` and the public pages are for everyone.

The screens never navigate after an action succeeds: they change the session (sign up, verify, save
the profile, delete) and the guard leads to the next page. That is the app's behaviour, and it is
also how the sign-up form ends: the new account is signed in and unverified, so the guard leaves
`/sign-up` for `/verify-email`.

### Leaving: the `exit` slice (web only)

When the session ends on one of these pages, the guard sends the user to the public home, as the app
goes back to its landing screen. Two things need more than that, and the guard reacts to the end of
the session before the code that caused it continues, so neither can be a `navigate()` after the
call (the two navigations would race):

- **"Use another account"** (verify email) must land on `/sign-in`. The screen stores that path
  (`signedOutPath`) before it signs out; the guard reads it.
- **A deleted account** must be confirmed on the public home. The delete hook sets `accountDeleted`
  when the deletion succeeded; the public home shows the notice whichever of the two (the redirect,
  the flag) comes first. The root layout clears the flag when the user opens any other page.

Both are forgotten when a user signs in. The app has no equivalent (a toast, one landing screen), so
this slice is the one piece of state the website has and the app has not.

### Deleting the account

The steps are the app's, chosen by `getReauthMethod`:

- **password:** tried at once; the password is asked for only when the backend answers
  `auth/requires-recent-login`;
- **google:** `deleteAccount()` is called straight from the click, because a browser opens a window
  only from a user action. Closing the window is not an error;
- **no method** (an account with Apple alone, until Apple sign-in is set up on the web): the page says
  so and points to the app and to the support address, instead of showing a button that cannot work.

`/delete-account` stays the public page that explains how to delete an account (the stores link to
it); `/account/delete` is where a signed-in user does it.

### Verify email

"I've verified my email" calls `refreshUser()` and puts the result in the session. The same check
runs, silently, when the tab becomes visible again (the app does it when it returns to the
foreground). After a resend the user waits 60 seconds; the wait is measured against the clock,
because browsers slow the timers of a tab in the background.

### The preview gateway plays the parts that happen outside the site

An account created in the preview starts unverified, like a real one, and deleting it asks for the
password. No email exists there, so the gateway exposes two functions on `window.qdPreview`:
`verifyEmail()` ("the user opened the link") and `removeProfile()` ("the profile was not written").
The end-to-end tests and a person in the browser console use the same two. They are part of the
preview gateway, which a production build cannot contain (ADR 0002).

### The sections, and the account on its own page (D85, 23 Oct 2026)

The signed-in pages are named after what is in them (D85, research doc 13 §22, doc 15 §19):

- **The bar** is Applications · CVs · Profile for an account with `interviewAssistant` (CVs only
  with `cvTool`), and Home · Profile without it. "Account" is no longer in the bar. A section stays
  marked on the pages under it (an application, a CV version, a resource). The sections depend on
  the flags, so the bar keeps their place empty until the flags are read, rather than show the wrong
  ones for a moment.
- **Where signing in lands** is still `/home` for the guards: `pathFor` does not know the flags.
  `/home` sends an account with `interviewAssistant` to `/applications`, waiting for the flags
  first, and shows the welcome and the three tools "Coming soon" to everyone else. `/applications`
  sends an account without the flag back to `/home`. The logo on the signed-in pages leads to the
  same place.
- **The account** is behind the name: the menu shows the name and email, then "Account" and "Sign
  out". `/account` ("Your account") has the cards that were at the bottom of Home: "Personal
  details" (the account's name, email and date of birth) and "Sign-in and security". With the CV
  tool, "Personal details" says the CV's details are separate and links to `/cv/details`: the CV
  section with "Your CV details" open, which leaves that address when closed. The panel fills its
  form once from data the CV section reads, so it opens there rather than over the account page.
  An old link to `/home#account` leads to `/account`. "Change password", "Delete account" and its
  Cancel lead back to `/account`.

## Consequences

- The account flows can be walked end to end without a backend, in the preview and in the
  end-to-end tests, including the states that need an email or a failed write.
- A new session status needs a page and a line in `pathFor`; nothing else decides where a user goes.
- An Apple-only account cannot be deleted on the website until Apple sign-in exists there.
- The error message keeps the look it has on the sign-in screens (outlined, no icon); the designs
  draw it filled, with an icon. Changing it is a change to every form, left for a separate step.

## Alternatives considered

- **`navigate()` after the action.** Races with the guard, as described above.
- **Router state for the confirmation** (`navigate('/', { state })`). The browser keeps that state,
  so the confirmation would come back on a reload.
- **A separate "sending" and "deleting" screen**, as the app has. Rejected with the designs: the
  user keeps seeing what was typed.
