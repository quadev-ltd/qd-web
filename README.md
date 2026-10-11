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

| Variable                       | Values                    | Meaning                                    |
| ------------------------------ | ------------------------- | ------------------------------------------ |
| `VITE_APPLICATION_NAME`        | `web`                     | Name of this application                   |
| `VITE_APPLICATION_ENVIRONMENT` | `test`, `dev`, `prod`     | Same values as the mobile app              |
| `VITE_ACCOUNT_ENABLED`         | `true`, `false` (default) | Shows the account entry points (see below) |

## The account flag

`VITE_ACCOUNT_ENABLED` is **off in production** until the account backend is connected. While it is
off, the public home shows no "Sign in", "Sign up" or "Create your account" buttons. To preview them:

```bash
VITE_ACCOUNT_ENABLED=true yarn start:dev
```

The buttons link to `/sign-in` and `/sign-up`. Those screens do not exist yet, so the links show the
Not found page for now.

# Architecture

```
src/
  app/          App.tsx (provider tree), routes.tsx
  components/   ui/ (Button, ButtonLink, Card, Chip)
                layout/ (PageShell, SiteHeader, SiteFooter, BrandLink, Arcs, LegalPage)
  core/         env.ts, logger.ts, contact.ts, i18n/ (i18n.ts, translations/en.json)
  screens/      one folder per screen: PublicHome/, PrivacyPolicy/, TermsAndConditions/,
                DeleteAccountInfo/, NotFound/
  styles/       theme.css (design tokens), global.css
  testUtil/     renderWithProviders.tsx
```

Rules (the same as in `qd-mobile` where they exist there):

- **Imports:** other folders through the `@/` alias (`@/components/...`); relative imports only
  inside a folder.
- **Components:** function components typed `React.FC<Props>`, with a named export and a default
  export. A screen lives in its own folder as `XScreen.tsx`, with its spec next to it.
- **Configuration:** only `src/core/env.ts` reads environment variables.
- **Logging:** `logger().logError(error)` / `logger().logMessage(text)` from `src/core/logger.ts`
  (set up once in `App.tsx`); `console.log` is a lint error.
- **Text:** every user-facing string is a key in `src/core/i18n/translations/en.json`, named
  `<area>.<camelCaseKey>` with the mobile suffixes (`xTitle`, `xDescription`, `xButton`,
  `xAccessibilityLabel`), and read with `t('area.key')`. Literal text in JSX is a lint error. A key
  that is not in `en.json` fails `yarn typecheck`. The same wording as the mobile app reuses the
  mobile key (`landing.signUpButton`).
  - Exception: the two legal documents (`PrivacyPolicyContent.tsx`, `TermsAndConditionsContent.tsx`)
    keep their text as literal JSX, word for word.
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
yarn build && yarn check:well-known
yarn format          # Prettier, same options as qd-mobile
```

## Tests

Vitest + Testing Library, in `*.spec.ts` / `*.spec.tsx` files next to the code. As in the mobile app,
translations are mocked in the test setup (`vitest.setup.ts`): `t('area.key')` returns `area.key`, and
specs assert on keys, found by role where possible. Core modules are mocked per file
(`vi.mock('@/core/env', ...)`). `renderWithProviders` (in `src/testUtil/`) renders a component inside
a router; `renderRoute('/path')` renders the application's routes at a URL.

## Lint

`eslint.config.js` ports the rules of `qd-mobile/.eslintrc.cjs` and lists, at the top, what is the
same, what was adapted, the one addition for the web (`jsx-a11y`) and what does not apply
(`react-native/*`).

## Pull request checks (CI)

Every pull request into `main` runs:

| Check        | Workflow          | What it proves                                                                                       |
| ------------ | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `run-checks` | `pr.yml`          | TypeScript, lint, Vitest, the production build, and that the app-link files are unchanged in `dist/` |
| `gitleaks`   | `secret-scan.yml` | No secrets in the new commits                                                                        |

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
