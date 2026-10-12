# ADR 0004: The Firebase gateway

- **Status:** accepted (October 2026). The code is merged; no environment uses it yet.
- **Scope:** `src/core/firebase/`, `src/core/auth/selectAuthGateway.ts`, the `VITE_FIREBASE_*`
  settings, the import restrictions in `eslint.config.js`, the Content-Security-Policy in
  `firebase.json`

## Context

ADR 0002 put one interface, `AuthGateway`, between the account screens and the backend, with two
implementations: nothing (`unavailable`) and an in-memory fake (`preview`). The backend exists: the
mobile app signs users in with Firebase Authentication and keeps the profile in Firestore
(`quadev-backend`: `firestore.rules`, the `accounts` functions). The website has to use the same
accounts, so a user of the app can sign in on the site and the other way round.

Two constraints came with the plan (research decisions D35 and D36):

1. On the dev site the screens talk to the real dev project; production must stay as it is until one
   value is changed.
2. While the account screens are off, a production build contains no Firebase code.

## Decision

`src/core/firebase/` implements `AuthGateway` with the Firebase web SDK (modular API). It is the web
version of `qd-mobile/src/core/firebase`:

| File         | Functions                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.ts`     | `auth()`, `db()`: one Firebase app from the `VITE_FIREBASE_*` settings, connected to the emulators when asked                                                                                      |
| `auth.ts`    | `subscribeToAuthState`, `getCurrentSessionUser`, `signUpWithEmail`, `signInWithEmail`, `sendVerificationEmail`, `refreshUser`, `sendPasswordReset`, `signInWithGoogle`, `signOut`, `deleteAccount` |
| `profile.ts` | `getProfile`, `watchProfile`, `createProfile`, `updateProfile`, `saveProfile`, `createProfileIfMissing`                                                                                            |
| `claims.ts`  | `getClaims`                                                                                                                                                                                        |
| `gateway.ts` | `createFirebaseGateway()`: the functions above as one `AuthGateway`                                                                                                                                |

The names, the signatures and the order of operations are the app's. Sign-up creates the account,
then the profile document `users/{uid}` (`firstName`, `lastName`, optional `dateOfBirth`,
`createdAt` set by the server), then sends the verification email; only the account must succeed.
The document is the one the backend's rules already accept, so nothing changes in `quadev-backend`.

The gateway interface gained what the screens still to come need, with the app's names:
`sendVerificationEmail`, `refreshUser`, `saveProfile`, `getReauthMethod` and
`deleteAccount({ password })`. The other gateways and the test double implement them too.

### One switch

`selectAuthGateway.ts` loads the Firebase gateway with a dynamic import when **both** are true:
`VITE_AUTH_GATEWAY=firebase` and `VITE_ACCOUNT_ENABLED=true`. With the account screens off there is
nothing to sign in to, the unavailable gateway answers, and the bundler leaves the Firebase code out
(the same build-time technique as ADR 0002, guard 1).

So production can be configured for Firebase in advance, with `VITE_ACCOUNT_ENABLED=false`, and
turning accounts on later is that one line. Three guards, as for the preview gateway:

1. **It is not in the bundle** while the switch is off.
2. **The build refuses a broken configuration:** the `firebase` gateway without its four settings,
   or the emulators in a production build (`vite.config.ts`; `src/core/env.ts` refuses the same at
   start).
3. **The output is checked.** `yarn check:bundle` fails when a production build with the switch off
   contains the addresses the Firebase SDK calls. It first makes sure those addresses are still in
   the installed SDK, so the check cannot start passing by accident after an SDK update.

### Only one folder knows Firebase

Lint rules, for `import` and for `import()`:

- only `src/core/firebase/` imports the Firebase SDK (`firebase/*`, `@firebase/*`);
- only `src/core/auth/selectAuthGateway.ts` loads `src/core/firebase/`.

Everything else uses `useAuthGateway()`. The specs of the folder mock the SDK modules; every other
spec uses `createMockGateway()`.

### What differs from the app, and why

| Difference                                                                                    | Reason                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google signs in through a browser window (`signInWithPopup`), always with the account chooser | The app uses the native Google SDK. A window keeps the user on the page; a redirect would leave it and needs the sign-in helper on the site's own domain in current browsers.                                                                 |
| The names come from Google's `given_name` / `family_name`, else from the display name         | The native SDK gives the names separately; the web gives them in the sign-in result. What is missing is asked on the complete-profile page, as in the app.                                                                                    |
| No Apple sign-in; the button is hidden (`src/core/sso/providers.ts`)                          | It needs a Services ID and a verified domain in the Apple Developer account. `signInWithApple` stays in the interface and rejects with "not available".                                                                                       |
| `getReauthMethod` never answers `apple`                                                       | Same. An account with Apple alone has no way to confirm a deletion on the site.                                                                                                                                                               |
| Deleting a Google account asks for confirmation in a Google window **first**                  | The app deletes first and asks only when Firebase wants a recent sign-in. A browser blocks a window that opens after a network answer instead of straight after the click, so asking afterwards would fail for exactly the users who need it. |
| The verification email carries the address `/verify-email` of the site (`VERIFY_EMAIL_PATH`)  | After confirming, the hosted page offers "Continue" back to the site. The app has no address to return to.                                                                                                                                    |
| **Firestore Lite**; `watchProfile` reads once and then reports the writes made from the page  | See below.                                                                                                                                                                                                                                    |
| Web-only error codes: sign-in window blocked or closed, domain not authorised                 | They do not exist in the app. Closed is "the user changed their mind", not an error; blocked has its own message; a domain that is not authorised is logged as an error and shown as the general server message.                              |

### Firestore Lite instead of the full SDK

The app listens to the profile document live. On the web that needs the full Firestore SDK:

| Build with the account screens on (gzip) | Firebase file |
| ---------------------------------------- | ------------- |
| Auth + full Firestore                    | 169 kB        |
| Auth + Firestore Lite                    | 63 kB         |

The main file is 73.9 kB either way. The Firebase file is requested on every page of a build with
accounts on, before the page is drawn (the session is needed everywhere), so 106 kB matters.

The site reads and writes one small document, which is what Lite is for. The cost is that Lite has
no live listener. `watchProfile` keeps its contract by:

- reading the document once when the user is known, with two more attempts after a failure (1 s,
  then 3 s), so a short network interruption does not send an existing user to the complete-profile
  page;
- reporting every write made from the page (`createProfile`, `updateProfile`, `saveProfile`) to the
  watchers, which covers sign-up, Google sign-in and completing the profile;
- dropping a read that a write from the page has overtaken (the read may be older than the write).

What is lost: a change made elsewhere (the app on a phone) shows the next time the site is opened.

To go back to a live listener, import from `firebase/firestore` in `app.ts` and `profile.ts` and
replace the body of `watchProfile` with `onSnapshot`; nothing outside the folder changes.

### Content-Security-Policy

The report-only policy in `firebase.json` now lists what Firebase sign-in uses: three addresses in
`connect-src` (`identitytoolkit`, `securetoken` and `firestore.googleapis.com`), `apis.google.com`
in `script-src` (Google's loader, added by the SDK for the sign-in window) and the two projects'
`firebaseapp.com` domains in `frame-src` (the hidden helper frame). The README has the table.

## Consequences

- **Nothing changes for visitors yet.** `.env.dev` and `.env.prod` are untouched; the dev site still
  uses the preview gateway with the account screens off.
- **Before the gateway is used on a site,** the project needs a web app (its settings go in the
  environment file), and the site's domain in the authorised domains of Firebase Authentication:
  without it Google sign-in fails with `auth/unauthorized-domain` and the verification email with
  `auth/unauthorized-continue-uri`.
- **The screens for the two onboarding statuses are still missing.** The session already has
  `needsEmailVerification` and `needsProfile`, and the guards still treat them as "not signed in".
  With this gateway a new email account is in the first status until the verify-email page exists.
- **The whole site waits for the gateway.** `AuthGatewayProvider` draws nothing until the chosen
  gateway is loaded (ADR 0002). With accounts on, that is a 63 kB request before the first page is
  drawn, public pages included. Drawing the public pages first and letting the session arrive later
  is possible without changing a screen (a gateway that passes calls on once the real one is
  loaded) and belongs with the performance work planned after the cutover.
- **Not proven against a real project.** The unit tests mock the SDK, and the policy was checked in
  a browser with a placeholder key (the Google window, its loader and its helper frame load without
  a report). Sign-in, the token renewal and the profile read need the dev project's web app; the
  end-to-end tests on the emulators come with the screens.
- **The Firebase SDK is one more thing to keep current.** It is pinned to an exact version like every
  other dependency.

## Alternatives considered

- **The full Firestore SDK, as in the app.** Identical behaviour, 106 kB more before the first
  paint. Rejected for now; the way back is described above.
- **`signInWithRedirect`.** No window to block, but the page is left and comes back, and current
  browsers need the sign-in helper served from the site's own domain. A window is simpler and keeps
  the form state.
- **Calling the backend through functions only (no Firestore in the browser).** One less SDK, but the
  app already writes the profile under the Firestore rules, and a second path to the same document
  would have to be kept in step with them.
- **A marker string in the Firebase gateway for the bundle check** (as the preview gateway has). The
  marker would be there only for the check. The SDK's own addresses are what must not ship, so the
  check looks for those.
