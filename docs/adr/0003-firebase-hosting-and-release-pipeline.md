# ADR 0003: Firebase Hosting for dev and production, and how the site is released

- **Status:** accepted (October 2026); being implemented in steps (see "Steps")
- **Scope:** where `qd-web` is hosted, `firebase.json`, `.firebaserc`, `scripts/setup-wif.sh` and
  the deploy workflows

## Context

The website is served from an S3 bucket behind CloudFront, and merging to `main` deploys it with
long-lived AWS keys stored in GitHub. Four things are wrong with that today:

1. **There is no dev site.** `dev.quadev.net` is another name for the production distribution, so a
   change is first seen by real visitors. The account screens need a place to run against the dev
   backend (`quadevapp-dev`) before production.
2. **Every merge is a production release.** Nothing separates "merged" from "released", and there is
   no approval step. `qd-mobile` releases from a version tag.
3. **Direct links answer 404.** The bucket answers an unknown path with its error page, so
   `quadev.net/privacy-policy` opens the page with a 404 status. The site sends no security
   headers, and `apple-app-site-association` is served as `binary/octet-stream`.
4. **The rest of QuaDev is leaving AWS.** The backend is Firebase (`quadev-backend`) and deploys
   there without stored keys (its ADR 0008). The website is the last thing that needs the AWS
   account and its keys.

The site is a static single-page app: one `index.html`, hashed files under `/assets/`, and two
app-link files under `/.well-known/` that tie the domain to the mobile apps and must be served byte
for byte.

## Decision

**Host both sites on Firebase Hosting, one per Firebase project, and release like the mobile app:
merges go to dev, a version tag goes to production after approval.**

|                  | Dev                                 | Production                               |
| ---------------- | ----------------------------------- | ---------------------------------------- |
| Address          | `dev.quadev.net`                    | `quadev.net` (`www` redirects to it)     |
| Project and site | `quadevapp-dev`, default site       | `quadevapp`, default site                |
| Build            | `vite build --mode dev`, `.env.dev` | `vite build --mode prod`, `.env.prod`    |
| Updated by       | every merge to `main`               | a tag `vX.Y.Z`, after an approval        |
| Also             | a temporary preview of each PR      | rollback to an earlier release (console) |

- **One configuration, in the repository.** `firebase.json` holds the rewrite to `index.html` (so
  direct links answer 200), the cache rules (hashed files for a year, pages never) and the security
  headers, for both sites. `.firebaserc` names the projects `dev` and `prod`, as in
  `quadev-backend`.
- **One environment file per environment**, chosen by the Vite mode, as today (`.env.dev`,
  `.env.prod`). Values are public and fixed at build time; an environment is a build, not a runtime
  setting.
- **Keyless deploys.** GitHub Actions gets a short-lived Google Cloud token through Workload
  Identity Federation: the pool `github` that `quadev-backend` already has, a provider `qd-web` that
  accepts only `quadev-ltd/qd-web`, and a service account `hosting-deployer` whose only role is
  `roles/firebasehosting.admin`. `scripts/setup-wif.sh` creates them (dry run by default) and the
  owner runs it once per project. Workflows read two repository variables per environment
  (`WIF_PROVIDER_DEV`, `WIF_SERVICE_ACCOUNT_DEV`; `..._PROD` for production) and skip the deploy job
  while they are missing.
- **Pull request previews** on Hosting preview channels of the dev project (`pr-<number>`, expiring
  after 7 days), never for pull requests from forks.
- **Production by version tag with approval.** A tag `vX.Y.Z` that equals the version in
  `package.json` runs the checks, waits for a reviewer on the GitHub environment `production`, then
  deploys the production build. This is the rule `qd-mobile` uses for its releases.
- **A Content-Security-Policy from the start,** written for the site as it is (everything from its
  own origin, no inline code, no `eval`), sent in report-only mode first and enforced once the dev
  site shows no violation. The README has the policy and the steps.

### Steps

Each step is safe to merge on its own, and production is not touched before step 4.

1. Hosting configuration, the dev deploy on merge and pull request previews. Production stays on S3
   and still deploys on merge. **(this change)**
2. `dev.quadev.net` points at the dev site (DNS, by hand, logged in
   `quadev-backend/docs/operations/infrastructure-log.md`).
3. The release workflow: a version tag deploys production to Firebase Hosting and, during the
   transition, to S3 as well; `main.yml` stops deploying production.
4. `quadev.net` and `www` point at the production site. CloudFront stays up for two weeks as the
   rollback.
5. The S3 and CloudFront deploy, its secrets and the AWS resources are removed.

## Alternatives considered

- **Stay on S3 + CloudFront.** It works and is cheap. But fixing what is wrong means building, on
  AWS, what Firebase Hosting has: a second distribution for dev, a function or error-page rule for
  the single-page rewrite, a response-headers policy, per-PR previews by hand, and OIDC to replace
  the stored keys. It would also keep the AWS account alive for one static site.
- **Cloudflare Pages.** Equally good at static hosting, previews and headers, and free. Rejected
  because it adds a third provider and a second place for access control and DNS, while the account
  screens already depend on the Firebase projects; with Firebase Hosting the site, its sign-in
  domains and its backend are in one project per environment.
- **A Docker image with runtime variables** (one image, configured when it starts, for example on
  Cloud Run). It gives "build once, run anywhere", which matters when there are secrets or many
  environments. The site has neither: two environments and public values only. It would add a
  container, a registry and a server to patch, to serve files a CDN serves better.
- **Server-side rendering on Cloud Run.** Better first paint and link previews for public pages, at
  the cost of a running server and a different application structure. Not needed for a landing
  page, two legal pages and screens behind sign-in. It stays open as a later option: Firebase
  Hosting can send chosen paths to a Cloud Run service, so the move would not change the domain or
  the release pipeline. The nearer step is pre-building the public pages as HTML at build time.

## Consequences

- **Merged is no longer released** (from step 3): a merge is visible on the dev site, and
  production changes only when a version is tagged and approved. Until then every merge still
  releases production.
- **During the transition there are two hosts.** The README's "Deploy" section says which is live
  for what; `firebase.json` is not in effect on `quadev.net` until step 4, so the 404 on direct
  links and the missing headers remain there until then.
- **The dev site and the previews are public** to anyone with the address, and they serve the dev
  build, which contains the in-memory preview auth gateway (ADR 0002 keeps it out of production
  builds only). Nothing real is behind it.
- **Preview addresses cannot use Firebase sign-in pop-ups** as configured: they are not added to
  the authorised domains, because that would need rights over users for the deploy account. The
  account work decides whether previews need it.
- **Rollback** is a click in the Firebase console (release history) instead of a re-run of an old
  commit.
- **The policy must be kept with the code.** A change that loads something from another origin, or
  adds inline code, has to change the Content-Security-Policy in the same pull request (README,
  "Hosting configuration"). zod's code generation is turned off for it (`src/core/env.ts`).
- **Open for the production step:** whether `Strict-Transport-Security` gets `includeSubDomains`
  and `preload` on `quadev.net` (it would cover every subdomain, so each must serve HTTPS first),
  and narrowing the production provider to tag builds or to the `production` environment rather
  than the whole repository.
- **The app-link files have a new server.** Their bytes are checked in CI (`yarn check:well-known`)
  and must be compared on the live addresses at steps 2 and 4, together with their content types.
