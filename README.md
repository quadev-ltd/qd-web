QuaDev Website
=======

The public website at [quadev.net](https://quadev.net): a [Vite](https://vite.dev) single-page app
(React 19, TypeScript, React Router, Tailwind CSS). It follows the same conventions as `qd-mobile`
wherever they apply to the web: the same lint rules, Prettier options, TypeScript strictness, `@/`
alias, folder layout, script names, translations and test style.

**Merging to `main` deploys to production** (see [Deploy](#deploy)).

# Requirements

- Node 24 (`nvm use` reads `.nvmrc`) and Yarn 4 (`corepack enable`).
- Optional: [gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`). `yarn install`
  points git at `.githooks/`, whose pre-commit hook scans staged changes for secrets when gitleaks
  is installed.

## Configuration

Environment files, one per environment, with the keys from `.env.example`:

- `.env.dev` (`yarn start:dev`), `.env.prod` (`yarn build`, `yarn start:prod`) and `.env.test`
  (Vitest). The names match `qd-mobile`; Vite loads the file named after its mode (`--mode dev`,
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
- `/sign-in`, `/sign-up` and `/forgot-password` are not registered and show the Not found page;
- the browser never downloads the account screens (they are separate files, loaded on demand).

To see the account screens locally:

```bash
VITE_ACCOUNT_ENABLED=true yarn start:dev
```

The signed-in home (`/home`) is not built yet: after a successful sign-in with the preview gateway
the site goes to `/home`, which shows the Not found page for now.

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
3. `yarn check:bundle` (run in CI after the build) fails if the build output contains it.

When the backend is connected, a `firebaseGateway` replaces both without touching a screen
(see the plan's next steps); `firebase/*` imports will then be limited to that folder by a lint rule.

# Architecture

```
src/
  app/          App.tsx (provider tree), routes.tsx, guards.tsx (route guards)
  components/   ui/ (Button, ButtonLink, Card, Chip, Checkbox)
                layout/ (PageShell, SiteHeader, SiteFooter, BrandLink, Arcs, LegalPage)
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
  screens/      one folder per screen: PublicHome/, SignIn/, SignUp/, ForgotPassword/,
                PrivacyPolicy/, TermsAndConditions/, DeleteAccountInfo/, NotFound/, Error/
  styles/       theme.css (design tokens), global.css
  testUtil/     renderWithProviders.tsx, mockGateway.ts
  util/         index.ts (date helpers)
```

The provider tree in `App.tsx` has the same order as the mobile app:
`I18nextProvider > Provider (store) > AuthGatewayProvider > SessionProvider > FlagsProvider > Router`.

Files that have a mobile original say so in their first comment (`// Mirrors qd-mobile src/...`).
Change the two together.

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
  `initializing` they show a loading state; a signed-in (`ready`) user who opens `/sign-in`,
  `/sign-up` or `/forgot-password` is sent to `/home`.
- **Feature flags:** `useFlag('key')` from `src/core/flags/FlagsProvider.tsx`. The registry mirrors
  the app's (and the backend's); the website has no remote source yet, so the code defaults apply.
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
| anything else           | Not found                                                                |

# Quickstart

```bash
yarn install
yarn start:dev       # dev server on http://localhost:3000 with .env.dev
yarn start:prod      # same, with the production configuration (.env.prod)
yarn build           # production build into dist/ (.env.prod)
yarn preview         # serve dist/ locally
```

# Checks

```bash
yarn typecheck && yarn lint && yarn test
yarn build && yarn check:well-known && yarn check:bundle
yarn format          # Prettier, same options as qd-mobile
```

## Tests

Vitest + Testing Library, in `*.spec.ts` / `*.spec.tsx` files next to the code. As in the mobile app,
translations are mocked in the test setup (`vitest.setup.ts`): `t('area.key')` returns `area.key`, and
specs assert on keys, found by role where possible. Core modules are mocked per file
(`vi.mock('@/core/env', ...)`, `vi.mock('@/core/logger', ...)`). `renderWithProviders` (in
`src/testUtil/`) renders a component inside the store, an auth gateway and a router, and takes the
session to start with (`{ session: { status: SessionStatus.Ready } }`) and the gateway
(`createMockGateway()` from `src/testUtil/mockGateway.ts`, the web equivalent of mocking the app's
Firebase modules). `await renderRoute('/path')` renders the application's routes at a URL.

## Lint

`eslint.config.js` ports the rules of `qd-mobile/.eslintrc.cjs` and lists, at the top, what is the
same, what was adapted, the one addition for the web (`jsx-a11y`) and what does not apply
(`react-native/*`).

## Pull request checks (CI)

Every pull request into `main` runs:

| Check        | Workflow          | What it proves                                                                                                                                        |
| ------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `run-checks` | `pr.yml`          | TypeScript, lint, Vitest, the production build, that the app-link files are unchanged in `dist/`, and that the preview auth gateway is not in `dist/` |
| `gitleaks`   | `secret-scan.yml` | No secrets in the new commits                                                                                                                         |

`gitleaks` also runs on pull requests into other branches; `run-checks` only on those into `main`.

# Deploy

`main.yml` runs on every push to `main`: the same checks as a pull request, then it syncs `dist/` to
the S3 bucket (with `--delete`) and invalidates the CloudFront distribution. The site is a
single-page app: the hosting answers unknown paths with `index.html`, and React Router picks the page.

After a merge, check that:

- `https://quadev.net/` loads;
- `https://quadev.net/privacy-policy`, `https://quadev.net/terms-and-conditions` and
  `https://quadev.net/delete-account` open by direct URL;
- `https://quadev.net/.well-known/assetlinks.json` and
  `https://quadev.net/.well-known/apple-app-site-association` still return the same content.
