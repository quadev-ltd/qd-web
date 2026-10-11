QuaDev Website
=======

The public website at [quadev.net](https://quadev.net): a [Vite](https://vite.dev) single-page app
(React 19, TypeScript, React Router). It follows the same conventions as `qd-mobile` wherever they
apply to the web: the same lint rules, Prettier options, TypeScript strictness, `@/` alias, script
names and test layout.

**Merging to `main` deploys to production** (see [Deploy](#deploy)).

# Requirements

- Node 24 (`nvm use` reads `.nvmrc`) and Yarn 4 (`corepack enable`).
- Optional: [gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`). `yarn install`
  points git at `.githooks/`, whose pre-commit hook scans staged changes for secrets when gitleaks
  is installed.

# Quickstart

```bash
yarn install
yarn start:dev       # dev server on http://localhost:3000 (Vite mode `dev`)
yarn start:prod      # same, with the production configuration (Vite mode `prod`)
yarn build           # production build into dist/
yarn preview         # serve dist/ locally
```

# Architecture rules

- `src/` is imported through the `@/` alias (`@/components/...`); relative imports only inside a folder.
- Static files that must keep their exact URL live in `public/` and are copied as they are into
  `dist/`. `public/.well-known/` holds the app-link files that tie `quadev.net` to the mobile apps
  (Android App Links, iOS Universal Links): they must never change by accident. `yarn check:well-known`
  compares them, and their copies in `dist/`, with pinned SHA-256 hashes
  (`scripts/check-well-known.mjs`); changing one on purpose means updating its hash in the same commit.
- Tests sit next to the file they test, as `*.spec.ts` / `*.spec.tsx` (Vitest + Testing Library).
- Lint rules are ported from `qd-mobile/.eslintrc.cjs`; `eslint.config.js` lists what is the same,
  what was added for the web (`jsx-a11y`) and what does not apply (`react-native/*`).

# Checks

```bash
yarn typecheck && yarn lint && yarn test
yarn build && yarn check:well-known
yarn format          # Prettier, same options as qd-mobile
```

## Pull request checks (CI)

Every pull request into `main` runs:

| Check        | Workflow          | What it proves                                                                                       |
| ------------ | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `run-checks` | `pr.yml`          | TypeScript, lint, Vitest, the production build, and that the app-link files are unchanged in `dist/` |
| `gitleaks`   | `secret-scan.yml` | No secrets in the new commits                                                                        |

# Deploy

`main.yml` runs on every push to `main`: the same checks as a pull request, then it syncs `dist/` to
the S3 bucket (with `--delete`) and invalidates the CloudFront distribution. The site is a
single-page app: the hosting answers unknown paths with `index.html`, and React Router picks the page.

After a merge, check that:

- `https://quadev.net/` loads;
- `https://quadev.net/privacy-policy` and `https://quadev.net/terms-and-conditions` open by direct URL;
- `https://quadev.net/.well-known/assetlinks.json` and
  `https://quadev.net/.well-known/apple-app-site-association` still return the same content.
