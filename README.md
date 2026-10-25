QuaDev Website
=======

The public website at [quadev.net](https://quadev.net): a [Vite](https://vite.dev) single-page app
(React 19, TypeScript, React Router, Tailwind CSS). It follows the same conventions as `qd-mobile`
wherever they apply to the web: the same lint rules, Prettier options, TypeScript strictness, `@/`
alias, folder layout, script names, translations and test style.

**Merging to `main` deploys to the dev site. Production is released by pushing a version tag**
(`vX.Y.Z`) and approving the release (see [Deploy](#deploy)).

# Requirements

- Node 24 (`nvm use` reads `.nvmrc`) and Yarn 4 (`corepack enable`).
- Optional: [gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`). `yarn install`
  points git at `.githooks/`, whose pre-commit hook scans staged changes for secrets when gitleaks
  is installed.

## Configuration

Environment files, one per environment, with the keys from `.env.example`:

- `.env.dev` (`yarn start:dev`, `yarn build:dev`), `.env.prod` (`yarn build`, `yarn start:prod`)
  and `.env.test` (Vitest). The names match `qd-mobile`; Vite loads the file named after its mode (`--mode dev`,
  `--mode prod`, and Vitest's `test`).
- Unlike the mobile app, these files **are committed**: the production build runs in CI and needs
  them, and they hold no secrets. For a local override use `.env.dev.local` (ignored by git).

All variables use the `VITE_` prefix: Vite inlines them into the JavaScript bundle at build time, so
they must not hold secrets. The one exception is `VITE_APPCHECK_DEBUG_TOKEN`, which is a secret,
lives only in `.env.dev.local` and is left out of every build (see "App Check" below). They are validated in `src/core/env.ts`, the only file allowed to read
`import.meta.env` (a lint rule enforces it). A production build with a required variable missing
fails instead of deploying a blank page.

| Variable                       | Values                                         | Meaning                                                                                 |
| ------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `VITE_APPLICATION_NAME`        | `web`                                          | Name of this application                                                                |
| `VITE_APPLICATION_ENVIRONMENT` | `test`, `dev`, `prod`                          | Same values as the mobile app                                                           |
| `VITE_ACCOUNT_ENABLED`         | `true`, `false` (default)                      | Shows the account screens (see below)                                                   |
| `VITE_AUTH_GATEWAY`            | `unavailable` (default), `preview`, `firebase` | What answers the account screens (see below)                                            |
| `VITE_FIREBASE_API_KEY`        | from the Firebase console                      | Required with the `firebase` gateway: the web app's settings (public, not secrets)      |
| `VITE_FIREBASE_AUTH_DOMAIN`    | `<project>.firebaseapp.com`                    | Required with the `firebase` gateway: where the Google sign-in window is served         |
| `VITE_FIREBASE_PROJECT_ID`     | `quadevapp-dev`, `quadevapp`                   | Required with the `firebase` gateway                                                    |
| `VITE_FIREBASE_APP_ID`         | from the Firebase console                      | Required with the `firebase` gateway                                                    |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<project>.firebasestorage.app`                | The project's default bucket: where the files of the interview profile are uploaded     |
| `VITE_USE_FIREBASE_EMULATORS`  | `true`, `false` (default)                      | Sends the `firebase` gateway to the local emulators. A production build refuses it      |
| `VITE_RECAPTCHA_SITE_KEY`      | from the Google Cloud console                  | App Check: the site key of the reCAPTCHA Enterprise key (public). Not set: no App Check |
| `VITE_APPCHECK_DEBUG_TOKEN`    | a debug token (**secret**)                     | App Check on your own machine. Only in `.env.dev.local`; never in a build               |

A build with `VITE_AUTH_GATEWAY=firebase` and one of the four settings missing fails, and so does the
page if it is started that way (`src/core/env.ts`).

## The account flag

`VITE_ACCOUNT_ENABLED` is **on in development** (`.env.dev`: the dev site
[dev.quadev.net](https://dev.quadev.net) and `yarn start:dev`) and **off in production**
(`.env.prod`) until the checklist in [Enabling accounts in production](#enabling-accounts-in-production)
is done. It is the one production switch. While it is off:

- the public home shows no "Sign in", "Sign up" or "Create your account" buttons;
- `/sign-in`, `/sign-up`, `/forgot-password`, `/verify-email`, `/complete-profile`, `/home`,
  `/account`, `/account/delete` and the interview tools' pages are not registered and show the Not
  found page;
- the browser never downloads the account screens (they are separate files, loaded on demand).

Locally, `yarn start:dev` shows the account screens connected to the **dev Firebase project**
(`quadevapp-dev`): accounts created there are real dev accounts, and verification emails are really
sent. To click through the screens without any backend, use the preview gateway (below):

```bash
VITE_AUTH_GATEWAY=preview yarn start:dev     # or put the line in .env.dev.local
```

## Enabling accounts in production

Everything is in place for one change: in `.env.prod`, set `VITE_ACCOUNT_ENABLED=true`, merge, and
release a version tag (see [Production release](#production-release)). `.env.prod` already carries
`VITE_AUTH_GATEWAY=firebase` and the settings of the production web app; they are not used, and no
Firebase code is built, while the switch is off.

Before flipping it, all of this must be true (the backend items are tracked in `quadev-backend`'s
docs and infrastructure log):

- [ ] The full flow works on dev.quadev.net with a real mailbox: sign up, verification email,
      verify, sign in, complete profile, sign out, reset password, delete account.
- [ ] `quadev.net` is served by Firebase Hosting (hosting step H4) and is in the authorised domains
      of `quadevapp` (done on 12 Oct 2026).
- [ ] Production backend deployed: Firestore rules, indexes, functions (`onUserDeleted`) and the
      Remote Config templates on `quadevapp`. Without `onUserDeleted`, deleting an account leaves
      its profile behind.
- [ ] The backend refuses unverified accounts (not only the screens).
- [ ] The production browser API key is restricted to the site's addresses, and App Check is
      decided.
- [ ] The Content-Security-Policy has been checked with accounts on and is enforced (it is
      report-only today).
- [ ] The legal pages and the support address are right for accounts created on the web
      (`support@quadev.net` must reach a person).
- [ ] The public "Delete your account" page links to `/account/delete`.

To switch accounts off again: set the value back to `false` and release a tag, or roll back to the
previous release in the Firebase console.

## The auth gateway

Everything the account screens need (the session, sign in, sign up, email verification, the
profile, password reset, sign out, deleting the account) goes through one interface, `AuthGateway`
(`src/core/auth/gateway.ts`), with the same function names as the mobile app's Firebase service
layer. `VITE_AUTH_GATEWAY` chooses the implementation, in one place
(`src/core/auth/selectAuthGateway.ts`):

| Value         | Used by                      | Behaviour                                                                                                                  |
| ------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `unavailable` | unit tests, default          | Nobody is signed in. The forms validate, then show "Sign-in on the web is not available yet." No network call.             |
| `preview`     | end-to-end tests, on request | An in-memory fake: the forms work end to end. Accounts live in the tab (`sessionStorage`) and nothing is sent.             |
| `firebase`    | `.env.dev`, `.env.prod`      | Firebase Authentication and the profile in Firestore (`src/core/firebase`), the same account as the mobile app. See below. |

The preview gateway has one sample account, and sign-up creates more (they disappear when the tab
closes). "Sign in with Google" and "Sign in with Apple" sign in as the sample account.

An account created with the sign-up form starts with an **unverified email**, as on the real
backend, and lands on the verify-email screen. No email exists in the preview, so
`window.qdPreview` stands for what happens outside the site. Type these in the browser console (the
end-to-end tests call the same functions):

| Console                      | Stands for                                                                                                                          |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `qdPreview.verifyEmail()`    | The user opened the link in the email. Then press "I've verified my email", or come back to the tab.                                |
| `qdPreview.removeProfile()`  | The profile was not written at sign-up. The site then asks for the names (complete-profile screen).                                 |
| `qdPreview.setFlag(key, on)` | An admin set a feature flag for this account, for example `('interviewAssistant', true)`. Reload the page: the flags are read once. |

Deleting an account always asks a preview account for its password (the real backend asks only when
the sign-in is old), so that step can be seen. The sample account also has Google, so it confirms
"with Google" (no window opens) and, being built in, is only signed out.

| Sample account | Value                 |
| -------------- | --------------------- |
| Email          | `preview@example.com` |
| Password       | `Preview123!`         |

It is a fake for clicking through the screens: never type a real password into it.

The sample account has the interview tools on (the `interviewAssistant` flag), like an account an
admin opened them for. An account created with the sign-up form has no flag, as on the real
backend, and sees "Not available for your account yet" on the profile.

**The preview gateway cannot reach production.** Three guards:

1. It is loaded with a dynamic import that the bundler removes unless `VITE_AUTH_GATEWAY=preview`.
2. A production build with `VITE_AUTH_GATEWAY=preview` fails (`vite.config.ts`).
3. `yarn check:bundle` (run in CI after the production build) fails if the build output contains
   it.

The end-to-end build (`yarn build:e2e`, a dev-mode build that Playwright starts with
`VITE_AUTH_GATEWAY=preview`) contains the preview gateway on purpose, so `yarn check:bundle` is only
run on production builds. The dev build (`yarn build:dev`, what the dev site and the pull request
previews serve) uses the Firebase gateway and does not contain it.

The reasoning is in [ADR 0002](docs/adr/0002-auth-gateway-boundary.md).

### The Firebase gateway

`src/core/firebase/` (`app.ts`, `auth.ts`, `profile.ts`, `claims.ts`, put together in `gateway.ts`)
is the web version of the app's `src/core/firebase`: the same function names, the same order of
operations (account, then the profile document `users/{uid}`, then the verification email) and the
same document, so the backend's rules treat both clients alike. The dev site uses it with the
project `quadevapp-dev`; production has it configured for `quadevapp` behind the switch. The
decisions are in [ADR 0004](docs/adr/0004-firebase-gateway.md).

Pull request previews are served from addresses that are not in the project's authorised domains
(`quadevapp-dev--pr<n>-<hash>.web.app`), so Google sign-in and the verification email are refused
there. Test sign-in on dev.quadev.net or locally.

- **It is loaded only when it can be used.** `VITE_AUTH_GATEWAY=firebase` **and**
  `VITE_ACCOUNT_ENABLED=true`. With the account screens off, the unavailable gateway answers and
  the Firebase code is not in the build at all; `yarn check:bundle` proves it on every production
  build. That makes `VITE_ACCOUNT_ENABLED` the one switch: production can carry
  `VITE_AUTH_GATEWAY=firebase` and its settings, and turning accounts on is that one line.
- **Only this folder imports the Firebase SDK,** and only `selectAuthGateway.ts` loads the folder
  (lint rules, for `import` and `import()`). Screens use `useAuthGateway()`.
- **What differs from the app:**
  - Google signs in through a browser window. The address of that window is
    `VITE_FIREBASE_AUTH_DOMAIN`.
  - Apple sign-in is not offered: it needs a Services ID in the Apple Developer account. The button
    is hidden by one constant (`src/core/sso/providers.ts`).
  - The verification email sends the user back to `/verify-email` on the site they signed up on.
    Firebase refuses a site whose domain is not in the project's authorised domains.
  - Deleting a Google account always asks for confirmation in a Google window first (a browser
    blocks a window that does not open straight after a click).
  - The profile is read once when the user is known and again after each change made on the site
    (Firestore Lite: a third of the size of the full SDK). A change made in the app shows the next
    time the site is opened.
- **Sizes** (production build, gzip): the main file is unchanged (73.9 kB); the Firebase code is
  one separate file of 63 kB, which exists only in a build with the account screens on. In such a
  build every page requests it at start, because the session is needed everywhere.

### App Check, for calls to the backend's functions

Every callable function of `quadev-backend` refuses a call that does not carry an App Check token:
proof that the call comes from this site. `src/core/firebase/functions.ts` gives the Functions
service and starts App Check first (`appCheck.ts`), so the SDK adds the token to every call. Both
files are loaded with the profile gateway, by the first profile page; signing in loads neither. The
decisions are in [ADR 0006](docs/adr/0006-app-check.md).

| Where the site runs             | What vouches for it                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| dev.quadev.net                  | reCAPTCHA Enterprise, with no puzzle (`VITE_RECAPTCHA_SITE_KEY` in `.env.dev`)             |
| Your machine (`yarn start:dev`) | A debug token registered for you in the Firebase console                                   |
| Pull request previews           | Nothing: the key does not cover their addresses, so the functions refuse them              |
| quadev.net                      | Not set up: `quadevapp` needs its own key for `quadev.net` and its site key in `.env.prod` |

**The debug token, on your machine.** reCAPTCHA only answers on the domains listed for the key, so
locally the SDK exchanges a debug token instead:

1. Firebase console, project `quadevapp-dev` → App Check → Apps → "QuaDev website (dev)" → Manage
   debug tokens → add one, and keep it in the password manager.
2. Create `.env.dev.local` at the root of the repository (git ignores it) with one line:
   `VITE_APPCHECK_DEBUG_TOKEN=<the token>`.
3. Start again with `yarn start:dev`. The browser console says "App Check uses a debug token."
   the first time a function is called.

The token is a secret: with it anyone can pass as this site to the functions. It must never be in
a committed file or in a build. Three guards: `vite.config.ts` gives every build an empty value in
its place, so only the development server passes it on; `src/core/env.ts` refuses it in
production; and `.env.dev.local` is in `.gitignore`. If a token leaks, delete it in the same
console page.

**Running it against the emulators** (no real project, no real email, no model):

```bash
# 1. In quadev-backend (Node 24, JDK 21): Auth, Firestore, Functions and Storage emulators
npm run emulators            # project demo-quadev

# 2. Here
VITE_ACCOUNT_ENABLED=true VITE_AUTH_GATEWAY=firebase VITE_USE_FIREBASE_EMULATORS=true \
VITE_FIREBASE_PROJECT_ID=demo-quadev VITE_FIREBASE_API_KEY=demo \
VITE_FIREBASE_AUTH_DOMAIN=demo-quadev.firebaseapp.com VITE_FIREBASE_APP_ID=demo \
VITE_FIREBASE_STORAGE_BUCKET=demo-quadev.appspot.com yarn start:dev
```

`VITE_FIREBASE_PROJECT_ID` must be the project the emulators were started with, and
`VITE_FIREBASE_STORAGE_BUCKET` the bucket the Functions emulator gives it
(`demo-quadev.appspot.com`); the other three values only have to be present. Verification and reset
emails are not sent: the Auth emulator lists them at
`http://localhost:9099/emulator/v1/projects/demo-quadev/oobCodes`, and opening an `oobLink` applies
it. "Sign in with Google" opens the emulator's own account page. The emulator UI is at
`http://localhost:4000`.

Against the emulators App Check uses neither reCAPTCHA nor a debug token (both are exchanged with
Google for the real project): `appCheck.ts` gives the SDK a token with no signature, which the
Functions emulator accepts and a deployed function refuses. A new account has no feature flag; set
one in the emulator UI (Firestore → `featureFlags/<uid>` → `interviewAssistant: true`) to open the
profile.

## The interview profile

The first feature that calls the backend: a candidate adds a CV and other resources, and the
backend reads them into items (skills, experience, projects, achievements and stories) that briefs
and CV versions use. The website shows the resources only: the profile page (the resources in every
state, the limits), "Add a resource" (a file, pasted text or a link) and the page of one resource
(where it is, why it failed, the text kept of it, its file to download, "Remove"). The signed-in
home starts with "Add your CV". No items are shown: the owner took the skill map out on 14 Oct 2026, and it may come back
later with ways to change them. The decisions, and what was tried against the backend before any of
it was written, are in
[ADR 0007](docs/adr/0007-interview-profile.md).

**Who sees it.** `/profile` is open to every signed-in user and follows the feature flag
`interviewAssistant`: off, the page says "Not available for your account yet"; on, it shows the
profile. The flag is off for everyone unless it was set for an account, or released (below).

**Feature flags are read from the backend,** in the backend's own order: the user's override
(`featureFlags/{uid}`), then Remote Config (what is set for everyone), then the code default. After
sign-in the site reads the first two once, through the auth gateway; `useFlag('key')` then answers,
and `useFlagsReady()` says whether they have arrived, so a page can wait instead of showing "not
available" for a moment. A layer that cannot be read decides nothing. The Remote Config part of
the SDK is a file of its own, loaded after sign-in; a visitor who is not signed in loads none of
it. In `quadev-backend` (its `docs/operations/releases.md` has the whole path of a release):

```bash
# One account
npm run set-flag -- --project quadevapp-dev --email <account> --flag interviewAssistant --on --apply
# Everyone: the client template the website reads, and the server template the functions read
npm run set-global-flag -- --apply --project quadevapp-dev --flag interviewAssistant --on
```

If the first command stops with a message about `identitytoolkit.googleapis.com` and another
project, your gcloud login bills that other project, where the lookup by email is not allowed. Put
`GOOGLE_CLOUD_QUOTA_PROJECT=quadevapp-dev` in front of the command. It prints
`Updated featureFlags/<uid> ...` when it has worked.

An account sees its own flag the next time it opens the site. A release reaches an open browser
within the hour (the site trusts a fetched template that long); the functions follow within a
minute and have the last word: where the two disagree for a moment, the page shows the profile and
the backend answers "not available for your account yet", or the other way round.

A percentage rollout (a condition in the Firebase console) is decided per browser here and per
account in the functions, so the two can disagree for good. Do not use one for a feature of the
website without solving that first (ADR 0007).

**The profile gateway.** Like the account, the profile is reached through one interface,
`ProfileGateway` (`src/core/profile/gateway.ts`), chosen in one place
(`src/core/profile/selectProfileGateway.ts`) by the same `VITE_AUTH_GATEWAY`:

| Value         | Profile gateway                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `unavailable` | Every call fails with "unavailable". No network call.                                                                                       |
| `preview`     | An in-memory fake (`previewProfileGateway.ts`): resources are "read" after a moment and give a few fictional items. Nothing is sent.        |
| `firebase`    | `src/core/firebase/` (`interviewProfile.ts`, `profileGateway.ts`): the owner's documents in Firestore, the backend's callables, the upload. |

- It is loaded by the first profile page, not with the application: the Firebase one brings the
  Functions, App Check and Storage parts of the SDK (19 kB gzip), which no other page needs.
- Every function rejects with a `ProfileError` whose code is in the words of the screens
  (`profile/daily-limit`, `profile/max-resources`, `profile/upload-refused`, ...): no screen reads a
  Firebase error.
- **The contract is a copy.** `src/core/profile/contract.ts` mirrors the backend's
  `packages/shared/src/interviewProfile.ts` (names, limits, the link check, the documents), because
  `@quadev/shared` is private. Change it only after the backend's `docs/api.md` says the same; the
  tests against the emulators catch a difference.
- **Nothing about the candidate is logged:** an operation, an error code and the uid
  (`logProfileError`). Never a title, an address or the text of an item.

**The profile in the store.** The profile pages do not call the gateway to read: they read the
`interviewProfile` slice, which `InterviewProfileProvider` (`src/core/profile/`, mounted by
`ProfileRoutes`) keeps in step with the backend:

- the first profile page of a session reads the resources, the skill map and today's count;
- while the backend is reading a resource, that resource is read again every 2 seconds (Firestore
  Lite has no listener), for 3 minutes at most; the skill map is read again only when a resource
  turns out to have added something, because each item is a billed read;
- coming back to the profile later reads again only what was unfinished.

A page asks for the rest by name with `useInterviewProfileActions()` (`reload`, `refreshResource`,
`refreshItems`). "Add a resource" (`src/screens/Profile/AddResource/`) creates the resource, then
uploads the file to the place the backend answers; closing the panel does not stop an upload.

The preview gateway keeps a profile per account in the tab (`sessionStorage`) and behaves like the
backend with its fake model: a link to a host ending in `.invalid` cannot be read, what the profile
already has is not added twice, and the limits are the backend's. `window.qdPreviewProfile` stands
for what a test cannot wait for or cause (the end-to-end tests use it):

| Console                                    | Stands for                                                                |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `qdPreviewProfile.seed()`                  | The profile of the designs: six resources, one in each state.             |
| `qdPreviewProfile.failNext('too-long')`    | The next resource cannot be read, for that reason (any of the backend's). |
| `qdPreviewProfile.stallNext()`             | The next resource is never read: it stays "being read".                   |
| `qdPreviewProfile.setExtractionsToday(20)` | Today's limit is already used.                                            |

# Architecture

```
src/
  app/          App.tsx (provider tree), routes.tsx, guards.tsx (route guards)
  components/   ui/ (Button, ButtonLink, Card, Chip, Checkbox, Banner, SidePanel, Dialog,
                    SegmentedControl, FilePicker, ProgressBar)
                layout/ (PageShell, SiteHeader, SiteFooter, BrandLink, Arcs, LegalPage,
                         MainNav, AccountMenu, SignedInShell)
                FormTextInput, FormTextArea, FieldCounter, PasswordVisibilityToggle, Spinner,
                StatusIcon, AppLoading, Icon, NotAvailable
                HookFormInputs/ (HookFormTextInput, HookFormPasswordInput, HookFormDateInput)
                SignIn/ (Layout, SSOForm, Divider, ErrorMessage, FooterPrompt, SubmitButton,
                         SignedInActions)
  core/         env.ts, logger.ts, contact.ts, i18n/ (i18n.ts, translations/en.json)
                auth/ (types, gateway, errors, profile, reauth, paths, the unavailable and
                       preview gateways, selectAuthGateway, AuthGatewayProvider)
                profile/ (contract, gateway, errors, paths, files, limits, items, the unavailable
                          and preview gateways, selectProfileGateway, ProfileGatewayProvider,
                          InterviewProfileProvider)
                firebase/ (app, auth, profile, claims, flags, gateway: the Firebase gateway;
                           functions, appCheck, storage, interviewProfile, profileGateway: the
                           Firebase profile gateway. The only folder that imports the Firebase SDK)
                state/ (store, hooks, slices/sessionSlice, exitSlice and
                        interviewProfileSlice, selectors/)
                session/ (SessionProvider, hooks)
                flags/ (registry, evaluate, FlagsProvider)
                sso/ (GoogleSSOCTA, AppleSSOCTA, useSSOSignIn, providers)
  hooks/        usePasswordValidation.ts
  schemas/      signInSchema.ts, signUpSchema.ts, forgotPasswordSchema.ts,
                completeProfileSchema.ts, addResourceSchema.ts
  screens/      one folder per screen: PublicHome/, SignIn/, SignUp/, ForgotPassword/,
                VerifyEmail/, CompleteProfile/, Home/, DeleteAccount/, Profile/, PrivacyPolicy/,
                TermsAndConditions/, DeleteAccountInfo/, NotFound/, Error/
  styles/       theme.css (design tokens), global.css
  testUtil/     renderWithProviders.tsx, renderProfilePage.tsx, mockGateway.ts,
                mockProfileGateway.ts, profileFixtures.ts
  util/         index.ts (date helpers)
e2e/            Playwright tests (the two critical flows, accessibility, keyboard)
e2e-emulators/  Playwright tests against the emulators of quadev-backend, and the backend
                commit they are pinned to
scripts/        build output checks (check-*.mjs), e2e-emulators.sh, setup-wif.sh (keyless
                deploy, run once)
firebase.json   Firebase Hosting: rewrites, cache and security headers, the Hosting emulator
.firebaserc     project aliases: dev (quadevapp-dev, the default), prod (quadevapp)
docs/adr/       architecture decisions
```

The provider tree in `App.tsx` has the same order as the mobile app:
`I18nextProvider > Provider (store) > AuthGatewayProvider > SessionProvider > FlagsProvider > Router`.

Files that have a mobile original say so in their first comment (`// Mirrors qd-mobile src/...`).
Change the two together.

Why the stack is what it is, how each choice maps to the mobile app and where the website differs:
[ADR 0001](docs/adr/0001-web-stack.md). How the screens work without a backend:
[ADR 0002](docs/adr/0002-auth-gateway-boundary.md). Where the site is hosted and how it is released:
[ADR 0003](docs/adr/0003-firebase-hosting-and-release-pipeline.md). The Firebase gateway:
[ADR 0004](docs/adr/0004-firebase-gateway.md). The account screens after sign-in and the route
guards: [ADR 0005](docs/adr/0005-account-screens-and-route-guards.md). App Check for calls to the
backend's functions: [ADR 0006](docs/adr/0006-app-check.md). The interview profile, and what was
checked against the backend before building it: [ADR 0007](docs/adr/0007-interview-profile.md).

Rules (the same as in `qd-mobile` where they exist there):

- **Imports:** other folders through the `@/` alias (`@/components/...`); relative imports only
  inside a folder.
- **Components:** function components typed `React.FC<Props>`, with a named export and a default
  export. A screen lives in its own folder as `XScreen.tsx`, with its spec next to it.
- **Configuration:** only `src/core/env.ts` reads environment variables. The one exception is the
  build-time check in `src/core/auth/selectAuthGateway.ts`, which has to be written there for the
  bundler to drop the gateways a build does not use (the file explains why).
- **Logging:** `logger().logError(error)` / `logger().logMessage(text)` from `src/core/logger.ts`
  (set up once in `App.tsx`); `console.log` is a lint error.
- **Text:** every user-facing string is a key in `src/core/i18n/translations/en.json`, named
  `<area>.<camelCaseKey>` with the mobile suffixes (`xTitle`, `xDescription`, `xButton`,
  `xAccessibilityLabel`), and read with `t('area.key')`. Literal text in JSX is a lint error. A key
  that is not in `en.json` fails `yarn typecheck`. The same wording as the mobile app reuses the
  mobile key (`landing.signUpButton`).
  - Exception: the two legal documents (`PrivacyPolicyContent.tsx`, `TermsAndConditionsContent.tsx`)
    keep their text as literal JSX, word for word.
- **State:** Redux Toolkit. Components use `useAppDispatch` and `useAppSelector` from
  `src/core/state/hooks.ts`, never the raw `react-redux` hooks (lint rule). The `session` slice is the
  same as in the app; `SessionProvider` keeps it in sync with the auth gateway.
- **Account screens:** the app's pattern. `XScreen.tsx` owns the form (`useForm` + `zodResolver`) and
  provides it; `XForm.tsx` reads it with `useFormContext` and renders the fields; `useX.ts` calls the
  auth gateway and maps its errors to a field (`setError`) or to a message in the page. Validation
  lives in `src/schemas/` (zod), with the app's rules and error keys.
- **Auth:** screens call the auth gateway from `useAuthGateway()`; nothing else knows how users are
  signed in. `src/core/auth/selectAuthGateway.ts` is the only place that chooses the gateway.
- **Firebase:** only `src/core/firebase/` imports the Firebase SDK (`firebase/*`), and only
  `selectAuthGateway.ts` and `selectProfileGateway.ts` load that folder. Both are lint errors
  anywhere else.
- **The profile:** screens read the profile from the store (`useInterviewProfile()`), change it
  through the profile gateway (`useProfileGateway()`) and react to the code of a `ProfileError`.
  The routes of the profile are children of `ProfileRoutes`
  (`src/screens/Profile/ProfileRoutes.tsx`), which checks the flag and provides both.
- **Panels and dialogs** are the native `<dialog>`, opened as a modal (`SidePanel` for a task,
  `Dialog` for a confirmation): the browser keeps the focus inside, closes on Escape and returns
  the focus to what opened it.
- **While something is sent to the backend** its button shows a spinner and the fields stay in
  place, as on the account forms. Nothing is shown as done before the backend answers: its first
  answer after a pause can take ten seconds (ADR 0007).
- **Route guards** (`src/app/guards.tsx`) read the session status, like the app's Router. Each
  status has its page: `needsEmailVerification` → `/verify-email`, `needsProfile` →
  `/complete-profile`, `ready` → `/home` (which leads to `/profile` for an account with
  `interviewAssistant`), `/account`, `/account/delete` and the interview tools' pages. While the session is `initializing`
  they show the loading screen; a user who opens the page of another status (or `/sign-in`,
  `/sign-up`) is sent to the page of theirs; a visitor who is not signed in is sent to `/sign-in`; a
  user who signs out, or deletes the account, on one of these pages lands on the public home. That is
  also how the sign-up form ends: the new account is signed in and unverified, so the guard leads to
  `/verify-email`.
- **While a form is being sent** it stays in place, disabled, and its button shows a spinner (the app
  replaces the form with a spinner). When an error message appears, the focus moves to it.
- **Leaving** (`src/core/state/slices/exitSlice.ts`, web only): "Use another account" on the
  verify-email screen chooses `/sign-in` as the place to land after signing out, and a deleted
  account is confirmed on the public home until the user opens another page (the app shows a toast).
- **Feature flags:** `useFlag('key')` from `src/core/flags/FlagsProvider.tsx`. The registry mirrors
  the app's (and the backend's): never add a flag here that the backend does not have. The user's
  overrides are read from the backend after sign-in (see [The interview profile](#the-interview-profile));
  then Remote Config, then the code default (all off). An account with `interviewAssistant` lands
  on its profile, which welcomes a new account and starts with the CV; any other account lands on
  the home, whose three tools are not built on the website yet and say "Coming soon".
- **Navigation** (D85, D91, ADR 0005): the bar is Profile · Applications · CVs with the interview
  tools (CVs with `cvTool`), Home · Profile without them; the account is behind the name, on its
  own page (`/account`).
- **Focus ring:** one rule for every interactive element (`global.css`). Its colour follows the
  surface: `data-surface="dark"` (brand and indigo backgrounds) uses the sky blue, light surfaces a
  darker blue, so the ring always has enough contrast.
- **Styling:** Tailwind CSS v4. Colours, radii, fonts and shadows are tokens in
  `src/styles/theme.css` (`bg-primary`, `text-muted`, `rounded-card`, `h-control`, ...); components
  do not contain raw hex values. Fonts (Sora for headings, DM Sans for text) are self-hosted from
  `@fontsource-variable`; the site makes no third-party font requests.
- **Pages:** every screen is wrapped in `PageShell` (header, main area, footer, tab title).
- **Static files** that must keep their exact URL live in `public/` and are copied as they are into
  `dist/`. `public/.well-known/` holds the app-link files that tie `quadev.net` to the mobile apps
  (Android App Links, iOS Universal Links): they must never change by accident.
  `yarn check:well-known` compares them, and their copies in `dist/`, with pinned SHA-256 hashes
  (`scripts/check-well-known.mjs`); changing one on purpose means updating its hash in the same commit.
- **Files for the dev site only** live in `public-dev/`: every build except production copies them
  into the output (`vite.config.ts`), and `yarn check:bundle` fails if one is in a production build.
  Today they are two fictional pages that the backend's evaluations read
  (`/evals/profile/portfolio-page` and `/evals/profile/page-with-instructions`; quadev-backend,
  `packages/career-skills/evals/profile-extract/pages`). They are copies byte for byte: the second
  one tells AI assistants to misdescribe its candidate on purpose (a prompt-injection case), so
  don't edit or reformat them (they are in `.prettierignore`).
- **Content-Security-Policy:** the hosting sends one (`firebase.json`, see
  [Hosting configuration](#hosting-configuration)). Code must work under it: no inline `<script>` or
  `<style>`, no `style` attribute, no `eval`, and nothing loaded from another origin without adding
  that origin to the policy in the same pull request. `src/core/env.ts` turns off zod's code
  generation (`jitless`) for this reason.

## Job applications

The second part of the interview tools (delivery 2a): one application for each job the candidate
applies for, built on the profile. Applications (`/applications`) lists them one per row, each with
where its brief is, under "Your applications" and "New application". Until the first one, the
profile shows three paths under it (D58, D91): "Prepare for a job" opens Applications with "New
application" open; practice says "Coming soon"; "Improve your CV" opens the CV section with
`cvTool`. A new application is its job: pasted
text, a file (PDF, Word or text) or the address of the posting, which the backend reads and names
it from; its page (`/applications/:id`) follows the reading, then opens on its brief (prepared on request, up to a
minute: what the job asks for, what the profile shows and the gaps, the likely questions with
notes; out of date when the job or the profile changes). Its Interviews tab (D89) lists the
interviews coming up, the next first, and the past ones, with "Add an interview" (a name, the
date and start time in the browser's time zone, the length, the type and what the candidate knows
about it); each opens its own page, with "Edit", "Remove" and "Get ready for it · Coming soon", and
the list of applications shows each one's next interview. Details has the job, "Edit" and
"Remove". The decisions are in
[ADR 0008](docs/adr/0008-job-applications.md).

The in-memory gateway has `qdPreviewProfile.seedApplications()`: the three applications of the
designs (a brief with two gaps, one the job changed since, none yet), the first with the
interviews of the designs (two coming up, one past) and the second with one in 9 days; `failNextBrief('model')` or
`('quota')`, `setBriefsToday(n)`, and `failNextJob(reason)` for the next job's reading. It reads a
job in 1.5 seconds, taking the title and the company from its first two lines, a posting's from
its address, and a file's title from its name; a posting on a host under `.invalid` cannot be read.

## Pages

| Path                                        | Screen                                                                                                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/`                                         | Public home                                                                                                      |
| `/privacy-policy`                           | Privacy Policy                                                                                                   |
| `/terms-and-conditions`                     | Terms and Conditions                                                                                             |
| `/delete-account`                           | How to delete an account (public; the stores link to it)                                                         |
| `/sign-in`                                  | Sign in (only with the account flag on)                                                                          |
| `/sign-up`                                  | Sign up (only with the account flag on)                                                                          |
| `/forgot-password`                          | Reset password (only with the account flag on)                                                                   |
| `/verify-email`                             | Verify your email (flag on; signed in, email not verified yet)                                                   |
| `/complete-profile`                         | Complete your profile (flag on; signed in, no names in the profile yet)                                          |
| `/home`                                     | Signed-in home (only with the account flag on; needs a session); leads to `/profile` with `interviewAssistant`   |
| `/account`                                  | Your account: personal details, sign-in and security (flag on; needs a session)                                  |
| `/account/delete`                           | Delete the signed-in account (flag on; needs a session)                                                          |
| `/profile`                                  | The interview profile, where an account with `interviewAssistant` lands (flag on; needs a session and that flag) |
| `/profile/resources/:id`                    | One resource of the profile (the same conditions)                                                                |
| `/applications`                             | Applications, the list (flag `interviewAssistant`); `/home` without it                                           |
| `/applications/:id`                         | One job application: its brief, interviews, details and CVs (flag `interviewAssistant`)                          |
| `/applications/:id/interviews/:interviewId` | One interview of an application: when, what you know about it, "Edit" and "Remove" (D89; the same flag)          |
| anything else                               | Not found                                                                                                        |

# Quickstart

```bash
yarn install
yarn start:dev       # dev server on http://localhost:3000 with .env.dev
yarn start:prod      # same, with the production configuration (.env.prod)
yarn build           # production build into dist/ (.env.prod)
yarn build:dev       # dev build into dist/ (.env.dev): what the dev site and the PR previews serve
yarn preview         # serve dist/ locally
yarn hosting:serve   # serve dist/ with the Firebase Hosting emulator: the real rewrites and headers
```

# Checks

```bash
yarn typecheck && yarn lint && yarn test
yarn build && yarn check:well-known && yarn check:bundle
yarn e2e             # end-to-end tests (first time: yarn playwright install chromium)
yarn e2e:emulators   # the same site against the backend's emulators (needs a checkout of quadev-backend)
yarn format          # Prettier, same options as qd-mobile
```

`check:well-known` and `check:bundle` check `dist/`; both take another folder as an argument
(`yarn check:well-known dist-e2e`). `check:bundle` is for production builds only: a dev build
contains the preview auth gateway by design and fails it. It also fails when Firebase code is in
the output while `VITE_ACCOUNT_ENABLED` is off in the production configuration.

## Tests

Vitest + Testing Library, in `*.spec.ts` / `*.spec.tsx` files next to the code. As in the mobile app,
translations are mocked in the test setup (`vitest.setup.ts`): `t('area.key')` returns `area.key`, and
specs assert on keys, found by role where possible. Core modules are mocked per file
(`vi.mock('@/core/env', ...)`, `vi.mock('@/core/logger', ...)`). `renderWithProviders` (in
`src/testUtil/`) renders a component inside the store, an auth gateway and a router, and takes the
session to start with (`{ session: { status: SessionStatus.Ready } }`) and the gateway
(`createMockGateway()` from `src/testUtil/mockGateway.ts`, the web equivalent of mocking the app's
Firebase modules). `await renderRoute('/path')` renders the application's routes at a URL.

## End-to-end tests (Playwright)

The web equivalent of the app's Maestro flows, in `e2e/`. `yarn e2e` builds the site in the dev mode
with `VITE_ACCOUNT_ENABLED=true` and `VITE_AUTH_GATEWAY=preview` (into `dist-e2e/`), serves it with
`vite preview` on port 4173 and runs the tests in Chromium at two sizes: desktop (1280 x 900) and
phone (390 x 844). No backend is involved: the preview gateway answers.

```bash
yarn playwright install chromium   # once: downloads the browser
yarn e2e
yarn e2e --project=phone           # one size only
yarn e2e --ui                      # interactive runner
```

| File                           | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-email-lifecycle.spec.ts` | Sign up → verify email (too early, resend, verified) → complete profile → home → reload → sign out → sign in → delete account (wrong password, then the right one) → confirmation on the public home; the tab that checks by itself; the ways out of the two onboarding screens; deleting with Google                                                                                                                                                                                                                                                                                  |
| `auth-sign-in-errors.spec.ts`  | Empty and invalid fields, wrong password, forgot password (neutral message), then a successful sign-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `pages.spec.ts`                | Every page, every state of the account screens, the profile (not available, empty, with resources in every state), "Add a resource" in its three forms with their messages, and a resource (ready, being read, failed, a link that was read, the remove dialog), the applications (the home without and with them, "New application" with its messages, an application, its edit panel and remove dialog): no serious or critical accessibility violation (axe) and no horizontal scroll                                                                                               |
| `keyboard.spec.ts`             | Keyboard-only sign-in, the account menu and the add-a-resource panel with the keyboard, the focus ring colour on light and dark surfaces                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `profile.spec.ts`              | The profile: add a CV as a file → "Being read…" → "Ready", and its page with nothing read from it; a pasted text that is too long, shortened and added; a link whose address is not accepted, one that cannot be read, and one that is read, with its address and "Remove this link"; a failed resource opened, its reason read, removed in the dialog and gone from the list; the home's starting card ("Add your CV", then "Your CV is in your profile", which leads to its page) and the home without it ; the text kept of a file and of a note, a long one opened with "Show all" |
| `applications.spec.ts`         | An application added from the home ("Prepare for a job", its messages), its page, edited (a private address refused), still there after a reload and on the home, removed after asking; the home listing applications with every state of a brief ; the brief: a failed attempt, then prepared, a gap opened with "Add a story" as a note, a requirement with its item, a question with notes, out of date after the job changed in Details, refreshed ; a posting that cannot be read, its text pasted instead and named by hand; a job as a file, read and named from its name       |

The detailed cases (every validation rule, every error code) are unit tests; the end-to-end tests
cover the paths that cross screens. They prove the screens, the session and the guards, not the
backend: that is the suite below.

## End-to-end tests against the backend's emulators

`e2e-emulators/`, run with `playwright.emulators.config.ts`: the site is built with the **Firebase
gateway** and talks to the emulators of `quadev-backend` (Auth, Firestore, Functions, Storage),
which run the real functions with a fake model. Nothing reaches a real project, and nothing costs
money. They prove the contract between the two repositories: sign-in, the flag, App Check, the
callables, the rules, the upload and the documents the site reads. A state is tested in the fastest
layer that can prove it, so this suite stays small (ADR 0007): one size (1280), a new account per
test, and assertions on states and counts, never on the fake model's text.

```bash
yarn e2e:emulators ../quadev-backend                 # builds the backend, starts the emulators, runs the tests
yarn e2e:emulators ../quadev-backend -- --ui         # arguments after -- go to Playwright
```

It needs Node 24, Java 21 and the backend's dependencies (`npm ci` in its folder). With the
emulators already running (`npm run emulators` in `quadev-backend`),
`yarn playwright test -c playwright.emulators.config.ts` runs the tests alone.

| File                     | What it proves                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `profile-access.spec.ts` | The flag is read from the backend's document through its rules: an account without it, and one with it off, see "Not available"; one with it on gets the profile                                                                                                                                                                                                                                                   |
| `profile.spec.ts`        | Add a CV as a file: `createProfileResource`, the upload under the Storage rules, the trigger that reads it, the resource followed to "Ready" and its page, then `removeProfileResource` and an empty profile. Pasted text read; a link to a host ending in `.invalid` fails, says "We couldn't read this page" and is removed . The text kept of a note and of a text file, read back under the rules              |
| `applications.spec.ts`   | E4: a pasted job read and named by the backend, on its page and the home, edited and read back, removed. A job as a file uploaded under the Storage rules and read by the trigger. A posting on a `.invalid` host that cannot be read, its text pasted instead. E5 and E6: a brief prepared with the fake model, out of date when the job changes, refreshed, and "Your profile changed" after a resource is added |

**The backend commit is pinned** in `e2e-emulators/backend-commit`. The pipeline tests against that
commit, so a change in the backend cannot break an unrelated pull request here. Move it forward on
purpose, in a pull request of its own: if the backend changed the contract, that pull request is
where it shows, together with the change to `src/core/profile/contract.ts`.

### One-time setup for the pipeline (owner)

`quadev-backend` is private and this repository is public, so the job reads the backend with a
deploy key that can only read that one repository. Until the secret exists the job `e2e-emulators`
reports "skipped". The private half is a secret: it goes from the file into GitHub and is never
pasted anywhere.

```bash
dir="$(mktemp -d)"
ssh-keygen -t ed25519 -N '' -C 'qd-web e2e-emulators (read only)' -f "$dir/key"
gh repo deploy-key add "$dir/key.pub" -R quadev-ltd/quadev-backend --title 'qd-web e2e-emulators (read only)'
gh secret set BACKEND_DEPLOY_KEY -R quadev-ltd/qd-web < "$dir/key"
rm -rf "$dir"
```

`gh repo deploy-key add` creates a read-only key unless `--allow-write` is given. To revoke it,
delete the key in `quadev-backend` → Settings → Deploy keys. When the job has been green for a
while, add `e2e-emulators` to the required checks of `main` (Settings → Rules) and to
`.github/rulesets/main.json`.

What the job makes public (this repository's logs and artifacts are): the emulators' output, which
names the backend's functions and shows the events they log for the fictional test accounts; and,
when a test fails, Playwright's report of this repository's tests. It uploads nothing from the
backend's folder: no source, no build and no emulator log file.

## Lint

`eslint.config.js` ports the rules of `qd-mobile/.eslintrc.cjs` and lists, at the top, what is the
same, what was adapted, the one addition for the web (`jsx-a11y`) and what does not apply
(`react-native/*`).

## Pull request checks (CI)

Every pull request into `main` runs:

| Check           | Workflow          | What it proves                                                                                                                                                                                                                                                                                      |
| --------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-checks`    | `pr.yml`          | TypeScript, lint, Vitest, the production build, that the app-link files are unchanged in `dist/`, that the preview auth gateway is not in `dist/`, and that no Firebase code is in it while the account screens are off                                                                             |
| `e2e`           | `pr.yml`          | The Playwright tests above; the report is uploaded as an artifact when they fail                                                                                                                                                                                                                    |
| `e2e-emulators` | `pr.yml`          | The tests against the backend's emulators. It does the work only when the pull request touches what they go through (the gateways, the contract, the profile screens, sign-in, the tests, the pinned commit) and the deploy key is available; otherwise it passes at once. Not a required check yet |
| `gitleaks`      | `secret-scan.yml` | No secrets in the new commits                                                                                                                                                                                                                                                                       |

`gitleaks` also runs on pull requests into other branches; `run-checks`, `e2e` and `e2e-emulators`
only on those into `main`. On `main` itself, `e2e-emulators` runs after every merge.

A fourth job, `preview` (`pr.yml`), runs after `run-checks` and `e2e` pass and publishes the pull
request to a temporary address (see [Deploy](#deploy)). It is **not a required check**: it is skipped
until the one-time setup is done, and for pull requests from forks.

# Deploy

The site is moving from S3 + CloudFront to Firebase Hosting, in steps
([ADR 0003](docs/adr/0003-firebase-hosting-and-release-pipeline.md)). **This is the transition
state:** `quadev.net` is still served from S3 + CloudFront, a release deploys the production build
to both hosts, and Firebase Hosting also serves a dev site and pull request previews.

|            | Production                                                            | Dev site                                  | Pull request preview                              |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Address    | `quadev.net` (S3 + CloudFront today), `https://quadevapp.web.app`     | `https://quadevapp-dev.web.app`           | `https://quadevapp-dev--pr-<number>-<id>.web.app` |
| Hosted on  | S3 + CloudFront **and** Firebase Hosting, project `quadevapp`         | Firebase Hosting, project `quadevapp-dev` | Hosting preview channel `pr-<number>`             |
| Build      | `yarn build` (`.env.prod`)                                            | `yarn build:dev` (`.env.dev`)             | `yarn build:dev` (`.env.dev`)                     |
| Updated by | `release.yml`, on a tag `vX.Y.Z`, after approval                      | `main.yml`, job `deploy-dev`, on merge    | `pr.yml`, job `preview`, on every push            |
| Needs      | [One-time setup for production](#one-time-setup-for-production-owner) | The dev one-time setup below (done)       | The dev one-time setup below (done)               |

**A merge to `main` no longer changes `quadev.net`.** It updates the dev site only. Pointing
`dev.quadev.net` at the dev site, pointing `quadev.net` at Firebase Hosting, and removing the S3
deploy are the remaining steps (ADR 0003).

## Production release

`release.yml` runs when a tag `vX.Y.Z` is pushed:

1. **`run-checks`** fails unless the tag equals `v` + the `version` in `package.json` (the rule
   `qd-mobile` uses), the tagged commit is on `main`, and the production deploy is set up. Then it
   runs the same checks as a pull request (TypeScript, lint, tests, production build, app-link
   files, no preview auth gateway). The end-to-end tests are not repeated: the commit passed them in
   its pull request.
2. **`deploy-production`** waits for an approval on the GitHub environment `production`. Once
   approved it builds with `.env.prod`, repeats the two checks on that build, and deploys it to
   Firebase Hosting (`firebase deploy --only hosting --project prod`, labelled with the tag and the
   commit) and then to S3 (with `--delete`) with a CloudFront invalidation, as `main.yml` did on
   every merge before.

### Cutting a release

1. Merge a pull request that sets the new `version` in `package.json`.
2. Tag that commit on `main` and push the tag:

   ```bash
   git checkout main && git pull
   git tag v0.2.0        # must equal "v" + the version in package.json
   git push origin v0.2.0
   ```

3. Open **Actions → Release**. When `run-checks` has passed, the run shows **Review deployments**:
   tick `production` and approve.
4. Check the release:
   - `https://quadevapp.web.app/` and `https://quadev.net/` load;
   - `/privacy-policy`, `/terms-and-conditions` and `/delete-account` open by direct URL on both
     (on `quadev.net` they still answer with status 404 until it is served by Firebase Hosting);
   - `/.well-known/assetlinks.json` and `/.well-known/apple-app-site-association` still return the
     same content on both (the commands in [After a deploy](#after-a-deploy) do this for a
     Firebase Hosting address).

A tag that fails `run-checks` deploys nothing. Fix the cause, delete the tag
(`git push origin :refs/tags/v0.2.0`, `git tag -d v0.2.0`) and tag again. If the deploy job fails
part-way, use **Re-run failed jobs** on the same run: both deploys can be repeated safely.

### Rolling back

- **Both hosts:** open the run of the previous tag in **Actions → Release**, choose **Re-run all
  jobs** and approve it. It rebuilds that tag and deploys it to Firebase Hosting and S3.
- **Firebase Hosting only (seconds):** Firebase console → project `quadevapp` → Hosting → release
  history → the previous release → **Rollback**. This does not change what S3 serves, so while
  `quadev.net` is on CloudFront it is not enough on its own.

### One-time setup for production (owner)

All three are needed **before the first tag is pushed**.

1. **Create the environment `production` with a required reviewer.** Repository **Settings →
   Environments → New environment**, name `production` (lower case, exactly). Then:
   - tick **Required reviewers** and add yourself. Leave **Prevent self-review** unticked, or the
     person who pushes the tag cannot approve it;
   - under **Deployment branches and tags** choose **Selected branches and tags** and add the tag
     rule `v*.*.*`, so only a version tag can use the environment.

   If the environment does not exist when the first release runs, GitHub creates it **without any
   protection** and the release deploys with no approval.

2. **Create the keyless deploy on `quadevapp`**, signed in to `gcloud` as an Owner of the project:

   ```bash
   scripts/setup-wif.sh --project quadevapp           # dry run: prints the commands
   scripts/setup-wif.sh --project quadevapp --apply
   ```

   It is the same as on dev (see [One-time setup for dev](#one-time-setup-for-dev-owner)) with one
   difference: the provider on `quadevapp` accepts a token only from a job that runs in the
   environment `production`. No other workflow or job of this repository can deploy production,
   and the environment's rules above decide who gets there. Record the run in
   `quadev-backend/docs/operations/infrastructure-log.md`.

3. **Set the two repository variables it prints** (names of resources, not secrets):

   ```bash
   gh variable set WIF_PROVIDER_PROD -R quadev-ltd/qd-web --body '<printed value>'
   gh variable set WIF_SERVICE_ACCOUNT_PROD -R quadev-ltd/qd-web --body '<printed value>'
   ```

   While they are missing, a release stops in `run-checks` with a message that names them.

The S3 half of the release keeps using the repository secrets it always used (`S3_BUCKET_NAME`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `CLOUDFRONT_DISTRIBUTION_ID`); nothing
to do for it. They are removed with the S3 deploy (ADR 0003, step 5).

## Dev site and pull request previews (Firebase Hosting)

- **Dev site.** After the checks have passed, the job `deploy-dev` builds with `.env.dev` and
  runs `firebase deploy --only hosting --project dev`. The release is labelled with the commit, and
  the Firebase console (Hosting → release history) can roll back to an earlier one.
- **Previews.** On a pull request into `main`, after `run-checks` and `e2e` pass, the job `preview`
  deploys the same dev build to the preview channel `pr-<number>` and writes its address to the job
  summary (the pull request's **Checks** tab → `preview` → Summary). Each push updates the same
  address. The channel is deleted 7 days after the last push. Previews are public to anyone who has
  the address.
- Both jobs are **skipped** until the two repository variables below exist. `preview` also never
  runs for a pull request from a fork or from Dependabot.
- The dev build contains the preview auth gateway (the in-memory fake, see
  [The auth gateway](#the-auth-gateway)), as `.env.dev` asks for. Its account screens stay off
  (`VITE_ACCOUNT_ENABLED=false`) until the account work turns them on.
- Preview addresses are not added to the sign-in domains of Firebase Authentication
  (`--no-authorized-domains`); the deploy account has no rights over users.

Deploys are **keyless**: the workflow proves to Google Cloud that it runs in `quadev-ltd/qd-web`
(Workload Identity Federation) and gets a short-lived token for the service account
`hosting-deployer`, which can only manage Firebase Hosting. No key or token is stored in GitHub.
The Firebase CLI is not a dependency: `yarn firebase` runs the pinned version with `npx`
(`package.json`; the same version as `quadev-backend`).

### One-time setup for dev (owner)

Done for `quadevapp-dev` in October 2026; kept as the record of what exists and how to repeat it.

1. Read what will be created (prints the commands, runs nothing, needs no login):

   ```bash
   scripts/setup-wif.sh --project quadevapp-dev
   ```

2. Create it, signed in to `gcloud` as an Owner of the project:

   ```bash
   gcloud auth login
   scripts/setup-wif.sh --project quadevapp-dev --apply
   ```

   It reuses the workload identity pool `github` that `quadev-backend` created, adds a provider
   `qd-web` that accepts only this repository, and creates the service account `hosting-deployer`
   with the role `roles/firebasehosting.admin` (the script lists what was left out, and why). It can
   be run again safely. Record the run in `quadev-backend/docs/operations/infrastructure-log.md`.

3. Set the two repository variables it prints at the end (names of resources, not secrets):

   | Variable                  | Value                                                                                      |
   | ------------------------- | ------------------------------------------------------------------------------------------ |
   | `WIF_PROVIDER_DEV`        | `projects/<project number>/locations/global/workloadIdentityPools/github/providers/qd-web` |
   | `WIF_SERVICE_ACCOUNT_DEV` | `hosting-deployer@quadevapp-dev.iam.gserviceaccount.com`                                   |

   ```bash
   gh variable set WIF_PROVIDER_DEV -R quadev-ltd/qd-web --body '<printed value>'
   gh variable set WIF_SERVICE_ACCOUNT_DEV -R quadev-ltd/qd-web --body '<printed value>'
   ```

4. Open or update a pull request and check that `preview` publishes it; after the next merge, check
   the dev site as in [After a deploy](#after-a-deploy).

Production has its own setup: [One-time setup for production](#one-time-setup-for-production-owner).

### After a deploy

```bash
site=https://quadevapp-dev.web.app   # production: https://quadevapp.web.app
curl -sI $site/privacy-policy                 # 200, text/html, cache-control: no-cache, the security headers
curl -sI $site/assets/<a file from dist/assets>   # cache-control: public, max-age=31536000, immutable
curl -s $site/.well-known/assetlinks.json | shasum -a 256
curl -s $site/.well-known/apple-app-site-association | shasum -a 256   # both as in scripts/check-well-known.mjs
curl -sI $site/.well-known/apple-app-site-association   # content-type: application/json
curl -sI $site/assets/missing.js              # 404, and not cached for a year
```

All of these were checked on the live dev site after its first deploy (12 October 2026). The live
service is the reference, not the emulator: the emulator answers a missing file under `/assets/`
with a 404 that carries the one-year cache header, and the live service does not (`no-cache`).

## Hosting configuration

`firebase.json` is the whole configuration; JSON has no comments, so the reasons are here.

| Setting         | Value                                                                | Why                                                                                                                                                                                                      |
| --------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public`        | `dist`                                                               | The build output of both modes.                                                                                                                                                                          |
| `ignore`        | `firebase.json`, `node_modules`, `.DS_Store`                         | The usual `**/.*` entry is left out on purpose: it would skip `.well-known/`, which must be uploaded.                                                                                                    |
| `rewrites`      | everything except `/assets/**` and `/.well-known/**` → `/index.html` | A path that is not a file is a page of the single-page app (status 200; React Router shows "Not found" for unknown ones). A missing hashed file or app-link file is a real 404 instead of the HTML page. |
| `cleanUrls`     | `true`                                                               | Pages have no `.html` in their address: `/index.html` redirects to `/`. Pre-built pages can later be served at the same addresses (`privacy-policy.html` at `/privacy-policy`).                          |
| `trailingSlash` | `false`                                                              | One address per page: Hosting redirects a file address that ends in a slash to the one without it.                                                                                                       |

**Cache headers.** When several rules match, the last one wins, so the order in the file matters:

| Path                                                                            | `Cache-Control`                       | Why                                                                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| everything (the first rule): pages, `index.html`                                | `no-cache`                            | The browser asks every time, so a deploy is visible at once.                                                                             |
| `/assets/**`                                                                    | `public, max-age=31536000, immutable` | Vite puts a content hash in these file names: a changed file has a new name.                                                             |
| `/favicon.ico`, `/logo192.png`, `/logo512.png`, `/manifest.json`, `/robots.txt` | `public, max-age=3600`                | Fixed names, so they must be able to change; one hour.                                                                                   |
| `/.well-known/**`                                                               | `public, max-age=3600`                | Read by Apple's and Google's servers; one hour.                                                                                          |
| the 404 page                                                                    | `no-cache`                            | The documented `404.html` rule, so a missing file under `/assets/` is not remembered as missing for a year. Not applied by the emulator. |

`/.well-known/apple-app-site-association` has no extension, so a rule gives it
`Content-Type: application/json`.

**Security headers**, on every response (the first rule uses `"regex": ".*"`: in the emulator the glob `**`
skipped the files under the dot-folder `/.well-known/`, and a regular expression leaves no doubt):

| Header                                | Value                                                          | Effect                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`           | `max-age=31536000`                                             | Browsers use HTTPS only, for a year. No `includeSubDomains` or `preload` yet (ADR 0003).                                                |
| `X-Content-Type-Options`              | `nosniff`                                                      | Files are used as the type the server says.                                                                                             |
| `Referrer-Policy`                     | `strict-origin-when-cross-origin`                              | Other sites see the origin only, never the path.                                                                                        |
| `Permissions-Policy`                  | `camera=(), geolocation=(), microphone=(), payment=(), usb=()` | The site and anything embedded in it cannot use these. A feature that needs one (a live interview needs the microphone) allows it here. |
| `X-Frame-Options`                     | `DENY`                                                         | No site can show this one in a frame (older browsers).                                                                                  |
| `Content-Security-Policy`             | `frame-ancestors 'none'`                                       | The same, for current browsers. Enforced.                                                                                               |
| `Content-Security-Policy-Report-Only` | see below                                                      | The full policy, not enforced yet.                                                                                                      |

### Content-Security-Policy

```
default-src 'none'; script-src 'self' https://apis.google.com https://www.google.com/recaptcha/
https://www.gstatic.com/recaptcha/; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com
https://firestore.googleapis.com https://firebasestorage.googleapis.com
https://firebaseremoteconfig.googleapis.com https://firebaseinstallations.googleapis.com
https://content-firebaseappcheck.googleapis.com
https://europe-west1-quadevapp-dev.cloudfunctions.net
https://europe-west1-quadevapp.cloudfunctions.net;
frame-src https://quadevapp-dev.firebaseapp.com https://quadevapp.firebaseapp.com
https://www.google.com/recaptcha/ https://recaptcha.google.com/recaptcha/;
manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Nothing is allowed unless listed. The site's own script and style files (no inline code, no `style`
attributes, no `eval`), its own images and fonts; neither React nor Tailwind needs `'unsafe-inline'`
here. The other origins are what Firebase sign-in needs, and nothing uses them while the account
screens are off:

| Directive     | Origin                                                                                       | Used for                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `connect-src` | `identitytoolkit.googleapis.com`                                                             | Firebase Authentication: sign in, sign up, emails, deleting the account                                     |
| `connect-src` | `securetoken.googleapis.com`                                                                 | Renewing the session token                                                                                  |
| `connect-src` | `firestore.googleapis.com`                                                                   | The profile document, the feature flags and the interview profile                                           |
| `connect-src` | `firebasestorage.googleapis.com`                                                             | Uploading a file of the interview profile, and asking for its download address                              |
| `connect-src` | `firebaseremoteconfig.googleapis.com`, `firebaseinstallations.googleapis.com`                | The feature flags set for everyone (Remote Config, and the installation id it asks for first)               |
| `script-src`  | `apis.google.com`                                                                            | Google's loader for the helper frame below; the Firebase SDK adds it when the Google sign-in window is used |
| `frame-src`   | `quadevapp-dev.firebaseapp.com`, `quadevapp.firebaseapp.com`                                 | A hidden helper frame through which the Google sign-in window hands back its result                         |
| `connect-src` | `content-firebaseappcheck.googleapis.com`                                                    | App Check: exchanging the proof for a token                                                                 |
| `connect-src` | `europe-west1-quadevapp-dev.cloudfunctions.net`, `europe-west1-quadevapp.cloudfunctions.net` | The backend's callable functions (the interview profile)                                                    |
| `script-src`  | `www.google.com/recaptcha/`, `www.gstatic.com/recaptcha/`                                    | reCAPTCHA Enterprise, loaded by App Check                                                                   |
| `frame-src`   | `www.google.com/recaptcha/`, `recaptcha.google.com/recaptcha/`                               | The hidden reCAPTCHA frame                                                                                  |

One file serves both sites, so each lists both projects' sign-in domains. The Google sign-in window
itself is a separate window and is not governed by this policy. Nothing was added for the local
emulators: the policy is sent by Firebase Hosting only, not by `yarn start:dev`.

It starts in **report-only** mode: the browser applies nothing and writes each violation to its
console (there is no reporting endpoint, so nothing is collected). The only part enforced today is
`frame-ancestors 'none'`, in its own header.

To enforce it:

1. Browse every page of the dev site with the console open; there must be no message about the
   Content Security Policy. Locally: `yarn build && yarn hosting:serve`.
2. In `firebase.json`, put the full policy in the `Content-Security-Policy` header (it already
   contains `frame-ancestors 'none'`, so it replaces the short one) and delete the
   `Content-Security-Policy-Report-Only` entry.
3. Check the pull request preview the same way before merging.

Before enforcing it with the account screens on, repeat step 1 while signing in with email and with
Google on the dev site: the token renewal and the profile read only happen with a real account.
The App Check, reCAPTCHA, functions and Storage origins are the ones a browser asked for when the
profile's calls were tried from the development server on 13 Oct 2026 (ADR 0007). That server sends
no policy, so repeat step 1 on dev.quadev.net once a page there calls a function, where reCAPTCHA
really runs.

## The Hosting emulator

Serves `dist/` with the rewrites and headers of `firebase.json`, without touching any Firebase
project (the project id `demo-quadev` is a local-only one):

```bash
yarn build            # or yarn build:dev
yarn hosting:serve    # http://127.0.0.1:5002 (Ctrl+C stops it)
curl -sI http://127.0.0.1:5002/privacy-policy
```

The first run downloads the Firebase CLI. The port is 5002 because macOS uses 5000 and the
`quadev-backend` emulators use 5001. Restart it after changing `firebase.json`. It follows the same
rules as the live service for everything checked here except the cache header of a missing file
under `/assets/`, but it is an emulation: the checks in [After a deploy](#after-a-deploy) are the
proof.
