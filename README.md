QuaDev Website
=======

The public website at [quadev.net](https://quadev.net): a [Vite](https://vite.dev) single-page app
(React 19, TypeScript, React Router, Tailwind CSS). It follows the same conventions as `qd-mobile`
wherever they apply to the web: the same lint rules, Prettier options, TypeScript strictness, `@/`
alias, folder layout, script names, translations and test style.

**Merging to `main` deploys to production**, and to the dev site on Firebase Hosting once its
one-time setup is done (see [Deploy](#deploy)).

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
they must not hold secrets. They are validated in `src/core/env.ts`, the only file allowed to read
`import.meta.env` (a lint rule enforces it). A production build with a required variable missing
fails instead of deploying a blank page.

| Variable                       | Values                             | Meaning                                      |
| ------------------------------ | ---------------------------------- | -------------------------------------------- |
| `VITE_APPLICATION_NAME`        | `web`                              | Name of this application                     |
| `VITE_APPLICATION_ENVIRONMENT` | `test`, `dev`, `prod`              | Same values as the mobile app                |
| `VITE_ACCOUNT_ENABLED`         | `true`, `false` (default)          | Shows the account screens (see below)        |
| `VITE_AUTH_GATEWAY`            | `unavailable` (default), `preview` | What answers the account screens (see below) |

## The account flag

`VITE_ACCOUNT_ENABLED` is **off in production** until the account backend is connected. While it is
off:

- the public home shows no "Sign in", "Sign up" or "Create your account" buttons;
- `/sign-in`, `/sign-up`, `/forgot-password` and `/home` are not registered and show the Not found
  page;
- the browser never downloads the account screens (they are separate files, loaded on demand).

To see the account screens locally:

```bash
VITE_ACCOUNT_ENABLED=true yarn start:dev
```

`.env.dev` uses the preview auth gateway (below), so the screens work end to end: sign up or use the
sample account, land on the signed-in home, sign out.

## The auth gateway

The account screens do not talk to a backend yet. Everything they need (the session, sign in, sign
up, password reset, sign out) goes through one interface, `AuthGateway` (`src/core/auth/gateway.ts`),
with the same function names as the mobile app's Firebase service layer. `VITE_AUTH_GATEWAY` chooses
the implementation, in one place (`src/core/auth/selectAuthGateway.ts`):

| Value         | Used by                    | Behaviour                                                                                                      |
| ------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `unavailable` | production, tests, default | Nobody is signed in. The forms validate, then show "Sign-in on the web is not available yet." No network call. |
| `preview`     | `.env.dev`                 | An in-memory fake: the forms work end to end. Accounts live in the tab (`sessionStorage`) and nothing is sent. |

The preview gateway has one sample account, and sign-up creates more (they disappear when the tab
closes). "Sign in with Google" and "Sign in with Apple" sign in as the sample account.

| Sample account | Value                 |
| -------------- | --------------------- |
| Email          | `preview@example.com` |
| Password       | `Preview123!`         |

It is a fake for clicking through the screens: never type a real password into it.

**The preview gateway cannot reach production.** Three guards:

1. It is loaded with a dynamic import that the bundler removes unless `VITE_AUTH_GATEWAY=preview`.
2. A production build with `VITE_AUTH_GATEWAY=preview` fails (`vite.config.ts`).
3. `yarn check:bundle` (run in CI after the production build) fails if the build output contains
   it.

The dev build (`yarn build:dev`, what the dev site and the pull request previews serve) is
configured with the preview gateway and contains it on purpose, so `yarn check:bundle` is only run
on production builds.

When the backend is connected, a `firebaseGateway` replaces both without touching a screen;
`firebase/*` imports will then be limited to that folder by a lint rule. The reasoning is in
[ADR 0002](docs/adr/0002-auth-gateway-boundary.md).

# Architecture

```
src/
  app/          App.tsx (provider tree), routes.tsx, guards.tsx (route guards)
  components/   ui/ (Button, ButtonLink, Card, Chip, Checkbox)
                layout/ (PageShell, SiteHeader, SiteFooter, BrandLink, Arcs, LegalPage,
                         MainNav, AccountMenu)
                FormTextInput, Spinner, AppLoading
                HookFormInputs/ (HookFormTextInput, HookFormPasswordInput, HookFormDateInput)
                SignIn/ (Layout, SSOForm, Divider, ErrorMessage, FooterPrompt, SubmitButton)
  core/         env.ts, logger.ts, contact.ts, i18n/ (i18n.ts, translations/en.json)
                auth/ (types, gateway, errors, profile, the gateways, AuthGatewayProvider)
                state/ (store, hooks, slices/sessionSlice, selectors/session)
                session/ (SessionProvider, hooks)
                flags/ (registry, evaluate, FlagsProvider)
                sso/ (GoogleSSOCTA, AppleSSOCTA, useSSOSignIn)
  hooks/        usePasswordValidation.ts
  schemas/      signInSchema.ts, signUpSchema.ts, forgotPasswordSchema.ts
  screens/      one folder per screen: PublicHome/, SignIn/, SignUp/, ForgotPassword/, Home/,
                PrivacyPolicy/, TermsAndConditions/, DeleteAccountInfo/, NotFound/, Error/
  styles/       theme.css (design tokens), global.css
  testUtil/     renderWithProviders.tsx, mockGateway.ts
  util/         index.ts (date helpers)
e2e/            Playwright tests (the two critical flows, accessibility, keyboard)
scripts/        build output checks (check-*.mjs), setup-wif.sh (keyless deploy, run once)
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
[ADR 0003](docs/adr/0003-firebase-hosting-and-release-pipeline.md).

Rules (the same as in `qd-mobile` where they exist there):

- **Imports:** other folders through the `@/` alias (`@/components/...`); relative imports only
  inside a folder.
- **Components:** function components typed `React.FC<Props>`, with a named export and a default
  export. A screen lives in its own folder as `XScreen.tsx`, with its spec next to it.
- **Configuration:** only `src/core/env.ts` reads environment variables. The one exception is the
  build-time check in `src/core/auth/selectAuthGateway.ts`, which has to be written there for the
  bundler to drop the preview gateway (the file explains why).
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
- **Route guards** (`src/app/guards.tsx`) read the session status, like the app's Router: while it is
  `initializing` they show a loading state; a signed-in (`ready`) user who opens `/sign-in` or
  `/sign-up` is sent to `/home`; a visitor who is not signed in and opens `/home` is sent to
  `/sign-in`; a user who signs out on `/home` lands on the public home.
- **Feature flags:** `useFlag('key')` from `src/core/flags/FlagsProvider.tsx`. The registry mirrors
  the app's (and the backend's): never add a flag here that the backend does not have. The website
  has no remote source yet, so the code defaults apply (all off). On the signed-in home, "Mock
  interview" and "Live interview" follow `interviewAssistant`; the "CV tool" has no flag yet and is
  always "Coming soon".
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
- **Content-Security-Policy:** the hosting sends one (`firebase.json`, see
  [Hosting configuration](#hosting-configuration)). Code must work under it: no inline `<script>` or
  `<style>`, no `style` attribute, no `eval`, and nothing loaded from another origin without adding
  that origin to the policy in the same pull request. `src/core/env.ts` turns off zod's code
  generation (`jitless`) for this reason.

## Pages

| Path                    | Screen                                                                   |
| ----------------------- | ------------------------------------------------------------------------ |
| `/`                     | Public home                                                              |
| `/privacy-policy`       | Privacy Policy                                                           |
| `/terms-and-conditions` | Terms and Conditions                                                     |
| `/delete-account`       | How to delete an account (the deletion itself happens in the mobile app) |
| `/sign-in`              | Sign in (only with the account flag on)                                  |
| `/sign-up`              | Sign up (only with the account flag on)                                  |
| `/forgot-password`      | Reset password (only with the account flag on)                           |
| `/home`                 | Signed-in home (only with the account flag on; needs a session)          |
| anything else           | Not found                                                                |

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
yarn format          # Prettier, same options as qd-mobile
```

`check:well-known` and `check:bundle` check `dist/`; both take another folder as an argument
(`yarn check:well-known dist-e2e`). `check:bundle` is for production builds only: a dev build
contains the preview auth gateway by design and fails it.

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

| File                           | What it proves                                                                                                  |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `auth-email-lifecycle.spec.ts` | Sign up → signed-in home with the user's own name → reload keeps the session → sign out → public home → sign in |
| `auth-sign-in-errors.spec.ts`  | Empty and invalid fields, wrong password, forgot password (neutral message), then a successful sign-in          |
| `pages.spec.ts`                | Every page: no serious or critical accessibility violation (axe) and no horizontal scroll                       |
| `keyboard.spec.ts`             | Keyboard-only sign-in, the account menu with the keyboard, the focus ring colour on light and dark surfaces     |

The detailed cases (every validation rule, every error code) are unit tests; the end-to-end tests
cover the paths that cross screens. They prove the screens, the session and the guards, not the
backend: email verification and account deletion get their flows when the backend is connected.

## Lint

`eslint.config.js` ports the rules of `qd-mobile/.eslintrc.cjs` and lists, at the top, what is the
same, what was adapted, the one addition for the web (`jsx-a11y`) and what does not apply
(`react-native/*`).

## Pull request checks (CI)

Every pull request into `main` runs:

| Check        | Workflow          | What it proves                                                                                                                                        |
| ------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-checks` | `pr.yml`          | TypeScript, lint, Vitest, the production build, that the app-link files are unchanged in `dist/`, and that the preview auth gateway is not in `dist/` |
| `e2e`        | `pr.yml`          | The Playwright tests above; the report is uploaded as an artifact when they fail                                                                      |
| `gitleaks`   | `secret-scan.yml` | No secrets in the new commits                                                                                                                         |

`gitleaks` also runs on pull requests into other branches; `run-checks` and `e2e` only on those into
`main`.

A fourth job, `preview` (`pr.yml`), runs after `run-checks` and `e2e` pass and publishes the pull
request to a temporary address (see [Deploy](#deploy)). It is **not a required check**: it is skipped
until the one-time setup is done, and for pull requests from forks.

# Deploy

The site is moving from S3 + CloudFront to Firebase Hosting, in steps
([ADR 0003](docs/adr/0003-firebase-hosting-and-release-pipeline.md)). **This is the transition
state:** production is still served from S3 exactly as before, and Firebase Hosting serves a dev
site and pull request previews.

|            | Production                             | Dev site                                  | Pull request preview                              |
| ---------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Address    | `quadev.net`                           | `https://quadevapp-dev.web.app`           | `https://quadevapp-dev--pr-<number>-<id>.web.app` |
| Hosted on  | S3 + CloudFront                        | Firebase Hosting, project `quadevapp-dev` | Hosting preview channel `pr-<number>`             |
| Build      | `yarn build` (`.env.prod`)             | `yarn build:dev` (`.env.dev`)             | `yarn build:dev` (`.env.dev`)                     |
| Updated by | `main.yml`, job `run-checks`, on merge | `main.yml`, job `deploy-dev`, on merge    | `pr.yml`, job `preview`, on every push            |
| Status     | Live, unchanged                        | Skipped until the one-time setup below    | Skipped until the one-time setup below            |

`dev.quadev.net` is still another name for the production site on CloudFront. Pointing it at the dev
site, releasing production to Firebase Hosting from a version tag, and removing the S3 deploy are
later steps (ADR 0003).

## Production (unchanged)

`main.yml` runs on every push to `main`: the same checks as a pull request, then it syncs `dist/` to
the S3 bucket (with `--delete`) and invalidates the CloudFront distribution. The site is a
single-page app: the hosting answers unknown paths with `index.html`, and React Router picks the page.

After a merge, check that:

- `https://quadev.net/` loads;
- `https://quadev.net/privacy-policy`, `https://quadev.net/terms-and-conditions` and
  `https://quadev.net/delete-account` open by direct URL;
- `https://quadev.net/.well-known/assetlinks.json` and
  `https://quadev.net/.well-known/apple-app-site-association` still return the same content.

## Dev site and pull request previews (Firebase Hosting)

- **Dev site.** After the production job has passed, the job `deploy-dev` builds with `.env.dev` and
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

### One-time setup (repository owner)

Per Firebase project; only `quadevapp-dev` is needed for now.

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
   the dev site as in [After a dev deploy](#after-a-dev-deploy).

`--project quadevapp` prints the same for production, with the variables `WIF_PROVIDER_PROD` and
`WIF_SERVICE_ACCOUNT_PROD`. Nothing uses them yet: they belong to the release pipeline (ADR 0003).

### After a dev deploy

```bash
site=https://quadevapp-dev.web.app
curl -sI $site/privacy-policy                 # 200, text/html, cache-control: no-cache, the security headers
curl -sI $site/assets/<a file from dist/assets>   # cache-control: public, max-age=31536000, immutable
curl -s $site/.well-known/assetlinks.json | shasum -a 256
curl -s $site/.well-known/apple-app-site-association | shasum -a 256   # both as in scripts/check-well-known.mjs
curl -sI $site/.well-known/apple-app-site-association   # content-type: application/json
curl -sI $site/assets/missing.js              # 404, and not cached for a year
```

Until the first real deploy these rules are verified against the Hosting emulator only; the live
service is the reference. One known difference: the emulator answers a missing file under
`/assets/` with a 404 that carries the one-year cache header (it does not apply the `404.html`
rule). If the live service does the same, the rule has to change.

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
default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';
connect-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
```

Nothing is allowed unless listed, and everything listed comes from the site itself: its own script
and style files (no inline code, no `style` attributes, no `eval`), its own images and fonts.
Neither React nor Tailwind needs `'unsafe-inline'` here.

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

The policy describes the site as it is today. Connecting Firebase sign-in will add the origins that
work needs (the Firebase and Google endpoints in `connect-src`, the sign-in helper page in
`frame-src`, Google's script for the sign-in pop-up in `script-src`), in the same pull request as
the code that uses them.

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
rules as the live service for everything checked here, but it is an emulation: the checks in
[After a dev deploy](#after-a-dev-deploy) are the proof.
