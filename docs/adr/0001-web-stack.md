# ADR 0001: Website stack, and how it maps to the mobile app

- **Status:** accepted (October 2026)
- **Scope:** `qd-web`, the website at quadev.net

## Context

The website was a Create React App project (deprecated tooling, React 18, MUI) with a landing page
and two legal pages. It needs the account screens the mobile app already has (sign in, sign up,
forgot password, a signed-in home), and one person maintains both codebases.

So the first goal is **one way of working**: someone who knows `qd-mobile` should find the same
libraries, folders, names and test style here. The second is **current, maintained tooling**.

Merging to `main` deploys to production, so every step had to be safe to merge on its own.

## Decision

Web-native React (real HTML and CSS, not React Native Web), with the mobile app's choices wherever
they apply to a browser, and the web standard where they do not.

| Concern               | `qd-mobile`                                   | `qd-web`                                               | Same?   |
| --------------------- | --------------------------------------------- | ------------------------------------------------------ | ------- |
| Language              | TypeScript 6, strict, `@/` alias              | TypeScript 6, strict, `@/` alias                       | same    |
| UI library            | React 19                                      | React 19                                               | same    |
| Build                 | Expo / Metro                                  | Vite 8                                                 | web     |
| Routing               | React Navigation 7, a status switch in Router | React Router 7, route guards reading the same status   | adapted |
| State                 | Redux Toolkit, typed hooks, `session` slice   | Redux Toolkit, typed hooks, the same `session` slice   | same    |
| Forms                 | react-hook-form + zod 3                       | react-hook-form + zod 4 (as in `quadev-backend`)       | same    |
| Translations          | i18next, `<area>.<key>`, `en.json`            | i18next, the same keys and English strings, typed keys | same    |
| Styling               | React Native Paper theme + StyleSheet         | Tailwind CSS v4, design tokens as CSS variables        | web     |
| Fonts                 | system                                        | Sora + DM Sans, self-hosted (`@fontsource-variable`)   | web     |
| Unit tests            | Jest + Testing Library, co-located `*.spec`   | Vitest + Testing Library, co-located `*.spec`          | adapted |
| End-to-end tests      | Maestro, two critical flows                   | Playwright, the same two flows, plus axe on each page  | adapted |
| Lint                  | ESLint 8, `.eslintrc.cjs`                     | ESLint 10 flat config, the same rules, plus `jsx-a11y` | adapted |
| Format                | Prettier                                      | Prettier, the same options                             | same    |
| Package manager, Node | Yarn 4.6, Node 24 (`.nvmrc`)                  | Yarn 4.6, Node 24 (`.nvmrc`)                           | same    |
| Secret scanning       | gitleaks hook + CI job                        | gitleaks hook + CI job                                 | same    |
| Configuration         | `core/env.ts` (zod), `EXPO_PUBLIC_*`          | `core/env.ts` (zod), `VITE_*`                          | same    |
| Backend access        | `core/firebase/*` service modules             | `core/auth/` gateway interface (ADR 0002)              | adapted |

The folder layout mirrors `qd-mobile/src`: `app/`, `components/`, `core/` (`env`, `logger`, `i18n`,
`state`, `session`, `auth`, `flags`, `sso`), `hooks/`, `schemas/`, `screens/<Screen>/`, `styles/`,
`testUtil/`, `util/`. A file that has a mobile original names it in its first comment.

Conventions kept from the app:

- Screens: `XScreen.tsx` owns `useForm` + `zodResolver`, `XForm.tsx` reads the form context,
  `useX.ts` calls the backend boundary and maps errors to fields.
- Validation rules and error keys: the app's schemas, ported to zod 4.
- Session: the same `SessionStatus`, state shape, actions and `deriveSessionStatus`.
- Feature flags: the same registry and evaluation order; only the code defaults until there is a
  remote source.
- Tests: translations mocked to their keys, sentence-style names, core modules mocked per file.
- Logging: only an operation name, an error code and a uid; never emails, names or raw errors.

## Deviations, and why

- **ESLint 10 with `eslint-plugin-import-x`.** The app is on ESLint 8. The website uses the current
  major, where `eslint-plugin-import` does not run; `import-x` is its maintained fork, registered
  under the `import` name so the rule names and options are identical. `eslint-plugin-react` and
  `jsx-a11y` do not list ESLint 10 in their peer ranges yet (Yarn warns); the React version is
  written in the config because version detection calls an API ESLint 10 removed.
- **No pre-rendering while the site is on S3 + CloudFront.** React Router can pre-render one HTML
  file per route, but the host must then serve those files and use a separate fallback file. Today
  the fallback is `index.html` for every unknown path; changing that belongs to the hosting move.
  The site is a single-page app until then.
- **React Router 7**, not 8: the major the plan was written and reviewed for. The data router API
  used here (`createBrowserRouter`, `lazy` routes) is the upgrade path.
- **zod 4** (the app is on zod 3; the backend is on 4). Same rules, new API (`error` instead of
  `required_error`, `z.email` piped after `trim`). One visible difference: zod 4 reports a
  non-matching password confirmation together with other field errors; zod 3 reports it only once
  the other fields are valid.
- **A visible `<label>` above each field** (the app uses the label as the placeholder), and field
  errors tied to the field with `aria-describedby`: the web design and web accessibility need it.
- **Errors the app shows as a toast are shown in the page** (`ErrorMessage`, `role="alert"`).
- **While a form is being sent the button is disabled and shows a spinner; the fields stay.** The
  app replaces the form with a spinner. On the web that would lose the keyboard focus.
- **Terms: a checkbox** (web design) instead of the app's sentence, so the sign-up schema has one
  extra field, `terms`. Its error key already exists in the app's translations.
- **`usePasswordValidation` computes its result while rendering** (the app copies it into state in
  an effect, which the current React lint rules reject). Same rules, same result.
- **Tests use the real store with a starting state** (`renderWithProviders({ session })`) instead of
  `redux-mock-store`, which is no longer maintained.
- **`.env.*` files are committed.** They hold public values only and the CI production build
  needs them.

## Consequences

- A change to a shared rule (a validation rule, an error code, a session status, a flag) must be
  made in both repositories. The first comment of each mirrored file says where its twin is. A
  shared package would remove the duplication; it is a listed next step, not part of this work.
- Web-only pieces (Tailwind, React Router, Playwright) have no twin and follow web practice.
- Moving the hosting later allows pre-rendering without touching the screens.
