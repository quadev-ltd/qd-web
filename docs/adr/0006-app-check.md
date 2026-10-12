# ADR 0006: App Check for calls to the backend's functions

- **Status:** accepted (October 2026). The code is merged and not used yet: no page calls a function.
  Set up for the dev site (`quadevapp-dev`, 12 Oct 2026); not for production.
- **Scope:** `src/core/firebase/appCheck.ts`, `src/core/firebase/functions.ts`,
  `VITE_RECAPTCHA_SITE_KEY` and `VITE_APPCHECK_DEBUG_TOKEN` (`src/core/env.ts`, `vite.config.ts`),
  the Content-Security-Policy in `firebase.json`

## Context

The interview tools of `quadev-backend` (the profile, job applications and what follows) are
callable functions, and every one of them enforces App Check: a call without a valid token is
refused with "unauthenticated" before anything else is looked at. Sign-in and the profile document
(ADR 0004) do not need it, because Firebase Authentication and Firestore are not enforced.

On the web, App Check proves the origin of a call with reCAPTCHA. reCAPTCHA only answers on the
domains listed for its key, so a developer's machine needs something else: a debug token, which the
Firebase console registers per app and which the SDK exchanges in place of the reCAPTCHA result.
That token is a secret, and Vite copies every `VITE_*` variable into the JavaScript it builds.

## Decision

1. **reCAPTCHA Enterprise, score based.** The visitor never sees a puzzle. One key per project,
   limited to that site's domain; its site key is a public identifier and is committed in the
   environment file (`.env.dev`).
2. **Started with the first call, not with the page.** `functions()` in
   `src/core/firebase/functions.ts` starts App Check and then returns the Functions service, so
   every `httpsCallable` made through it carries the token. The two files are separate from
   `app.ts`: the Functions and App Check parts of the SDK, and Google's reCAPTCHA script, are only
   loaded by a page that calls the backend. Signing in loads none of it.
3. **The debug token exists only in the development server.** It is read from
   `VITE_APPCHECK_DEBUG_TOKEN` in `.env.dev.local`. `vite.config.ts` replaces it with an empty value
   in every build (`define`), `src/core/env.ts` refuses it in production, and the file is ignored by
   git. Checked on 12 Oct 2026 with a fake token: a dev build contained it without the `define`
   and did not with it.
4. **No site key, no App Check.** Without `VITE_RECAPTCHA_SITE_KEY` nothing is started and the
   functions answer "unauthenticated". Production stays that way until its key exists.
5. **The Content-Security-Policy lists the new origins** (it is still report-only): App Check's
   endpoint, the functions of both projects, and reCAPTCHA's script and frame.

## Alternatives considered

- **reCAPTCHA v3:** the older provider. An Enterprise key lives in the same Google Cloud project as
  everything else, and its settings (domains, no puzzle) can be read back and checked from there.
- **Starting App Check when the Firebase app starts:** every visitor of a page with the account
  screens on would load Google's reCAPTCHA script, also on the landing page. That is a cost in page
  weight, and reCAPTCHA has to be named in the privacy notice for the pages it runs on.
- **A debug token in the dev site's build:** it would let dev.quadev.net skip reCAPTCHA, and it
  would publish the token to every visitor.
- **Failing a build that finds the token:** safe, but `yarn build` and `yarn build:e2e` would stop
  working on every developer's machine that has `.env.dev.local`. Leaving it out is as safe and
  gets in nobody's way.

## Consequences

- The first screen that calls a function imports `functions()` from this folder, through a gateway
  of its own (the lint rules keep Firebase behind `src/core/firebase`).
- **Pull request previews cannot call functions.** Their addresses are not in the key's domains.
  Sign-in is refused there for the same kind of reason (README).
- **Not verified against the real services.** The unit tests mock the SDK. Nothing has yet
  exchanged a reCAPTCHA result or a debug token from this code, and the new origins of the
  Content-Security-Policy were taken from the SDK's source and Google's guidance, not from a
  browser session. The first screen that calls a function is where both get checked, on
  dev.quadev.net and locally.
- **Before a public release:** reCAPTCHA must be named in the privacy notice, production needs its
  own key (`quadev.net`), and App Check's minimum score (0.5 by default) decides who gets refused.
- A leaked debug token is revoked by deleting it in the Firebase console (App Check → Apps →
  Manage debug tokens).
