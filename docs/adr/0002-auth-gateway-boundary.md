# ADR 0002: The auth gateway, the boundary between the screens and the account backend

- **Status:** accepted (October 2026). The Firebase gateway it announces is
  [ADR 0004](0004-firebase-gateway.md), which also extends the interface
- **Scope:** `src/core/auth/` and everything that signs users in or reads the session

## Context

The account screens (sign in, sign up, forgot password, signed-in home) were built before the
website is connected to the account backend (Firebase Authentication and the profile store). Two
things had to be true at the same time:

1. The screens are complete and tested now: validation, error mapping, session, route guards.
2. Nothing unfinished reaches production. Merging to `main` deploys, there is no real sign-in to
   offer yet, and a fake one must never be deployed.

In the mobile app the screens call service functions (`qd-mobile/src/core/firebase/auth.ts`,
`profile.ts`, `claims.ts`) and mock those modules in tests.

## Decision

The website puts one interface, **`AuthGateway`** (`src/core/auth/gateway.ts`), between the screens
and the backend. It has the same function names and signatures as the app's service layer:

- session: `subscribeToAuthState`, `getCurrentSessionUser`
- profile and claims: `watchProfile`, `createProfileIfMissing`, `getClaims`
- actions: `signInWithEmail`, `signUpWithEmail(email, password, profile)`, `sendPasswordReset`,
  `signInWithGoogle`, `signInWithApple`, `signOut`

with the app's types (`SessionUser`, `UserProfile`, `ProviderNames`, `Claims`) and the app's error
codes (`auth/invalid-credential`, `auth/email-already-in-use`, ...), mapped to the same translation
keys by `getErrorMessageKey`.

Screens get the gateway from `useAuthGateway()` (`AuthGatewayProvider`, mounted above
`SessionProvider`). `SessionProvider` subscribes through it and dispatches the app's session
actions. Nothing else knows how users are signed in.

There are two implementations today:

| Gateway              | When                                  | Behaviour                                                                                                                    |
| -------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `unavailableGateway` | default; production; unit tests       | Nobody is signed in. Every action rejects with the typed error `app/account-unavailable`. It makes no network request.       |
| `previewGateway`     | `VITE_AUTH_GATEWAY=preview`: dev, e2e | In-memory fake: one sample user, sign-up creates more, state in memory and `sessionStorage`. Nothing leaves the browser tab. |

`src/core/auth/selectAuthGateway.ts` is the only place that chooses, from `VITE_AUTH_GATEWAY`.

### Keeping the fake out of production

Three independent guards, so one mistake is not enough:

1. **It is not in the bundle.** The preview gateway is loaded with a dynamic import behind
   `import.meta.env.VITE_AUTH_GATEWAY === 'preview'`. Vite replaces that expression at build time;
   in every other build it is `false` and the bundler drops the import. This is why the selection
   file reads the variable directly, the one exception to "only `core/env.ts` reads the
   environment": a constant imported from `env.ts` was tried and the bundler kept the file.
2. **The build refuses it.** `vite.config.ts` fails a production build (mode `prod`, or
   `VITE_APPLICATION_ENVIRONMENT=prod`) when `VITE_AUTH_GATEWAY=preview`.
3. **The output is checked.** `yarn check:bundle` (in `pr.yml` and `main.yml`, after the build)
   fails if any file in `dist/` contains the gateway's marker string.

Separately, the account routes are registered only when `VITE_ACCOUNT_ENABLED` is on (off in
production) and are loaded on demand, so with the flag off the screens are unreachable and their
code is never requested.

## Consequences

- **Connecting the backend is one new file set.** A `firebaseGateway` implementing `AuthGateway`
  replaces both gateways; screens, schemas, session and guards do not change. A lint rule will then
  limit `firebase/*` imports to that folder, as the app's README requires for `core/firebase`.
  (Done in ADR 0004: `src/core/firebase/`.)
- **Screens are tested like the app's**, with `createMockGateway()` in place of mocking the Firebase
  modules; the preview gateway has its own spec and drives the end-to-end tests.
- **The preview gateway is not Firebase.** It has no email verification (every account counts as
  verified), no network latency, no rate limiting, and Google/Apple sign in as the sample user. The
  two onboarding statuses of the session (`needsEmailVerification`, `needsProfile`) therefore never
  occur yet; the guards treat them as "not signed in" until their screens are built with the
  backend. The end-to-end tests prove the screens and the session, not the backend.
- **The interface is wider than "auth".** It also carries the profile and the claims, because the
  session needs them and they come from the same backend. If the profile grows its own screens
  (edit profile), it can move to its own gateway behind the same pattern.
- **One exception to the configuration rule** (guard 1), documented in the file and in the README.
