# Branch rules for `main`

`main.json` is the ruleset for the `main` branch, kept here so the rule is documented and can be re-created.
It mirrors the ruleset of `qd-mobile`:

- changes reach `main` only through a pull request, with all review threads resolved;
- the checks `run-checks`, `gitleaks` and `e2e` must pass;
- `main` cannot be deleted or force-pushed;
- organisation admins can bypass the rule in an emergency.

Merging to `main` deploys to production, so these checks are the gate for every release.

## Apply or update it

GitHub does not read this file by itself. An admin of the repository imports it once:

1. Repository **Settings → Rules → Rulesets → New ruleset → Import a ruleset**.
2. Choose `.github/rulesets/main.json` and save.

After changing the rule in the GitHub settings, export it and replace `main.json` in a pull request.
