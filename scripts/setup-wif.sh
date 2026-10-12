#!/usr/bin/env bash
# Sets up Workload Identity Federation so GitHub Actions in quadev-ltd/qd-web can deploy the website to
# Firebase Hosting (the live site and PR preview channels) WITHOUT a service-account key.
#
#   Dry run (default; prints the gcloud commands, runs nothing, needs no login):
#     scripts/setup-wif.sh --project quadevapp-dev
#   Apply (owner, after `gcloud auth login` with an account that is Owner of the project):
#     scripts/setup-wif.sh --project quadevapp-dev --apply
#
# Creates (idempotent: existing resources are kept):
#   - workload identity pool `github` (shared with quadev-backend, which created it; reused when present)
#     and OIDC provider `qd-web`, accepting only tokens whose `repository` claim is quadev-ltd/qd-web.
#     On quadevapp (production) the token must also come from a job in the GitHub environment
#     `production`, which is the approval step of release.yml;
#   - service account hosting-deployer@<project>.iam.gserviceaccount.com with the role below;
#   - a binding that lets that repository impersonate the service account.
# Then prints the two GitHub repository variables the workflows need.
#
# Modelled on quadev-backend/scripts/setup-wif.sh (see its ADR 0008 for why deploys are keyless).
#
# Role (the least we could verify, by reading what firebase-tools 15.32.1 calls for
# `deploy --only hosting` and `hosting:channel:deploy` when firebase.json has no rewrites to
# Cloud Functions or Cloud Run):
#   roles/firebasehosting.admin   firebasehosting.sites.get / .update: read the site, create and finalise
#                                 a version, upload its files, release it to `live` or to a preview
#                                 channel, create a preview channel and set its expiry;
#                                 firebase.projects.get: firebase-tools reads the Firebase project to find
#                                 its default Hosting site.
# Not granted on purpose:
#   roles/firebase.viewer         only needed for firebase.projects.get, which the Hosting role already has.
#                                 It would also let CI read Firestore data and every other Firebase product.
#   roles/serviceusage.serviceUsageConsumer
#                                 only the permission pre-check of firebase-tools bills its request to the
#                                 project (x-goog-user-project). Without the role that check is refused,
#                                 firebase-tools logs it at debug level and deploys anyway.
#   roles/firebaseauth.admin      `hosting:channel:deploy` can add each preview address to the authorised
#                                 domains of Firebase Authentication. The workflow turns that off
#                                 (--no-authorized-domains): CI must not be able to manage users.
#   roles/run.viewer, roles/cloudfunctions.viewer
#                                 only for rewrites to Cloud Run or Cloud Functions; the site has none.
# If a real deploy reports a missing permission, add the role here with its reason, in the same change.
set -euo pipefail

REPO="quadev-ltd/qd-web"
POOL="github"
PROVIDER="qd-web"
SA_NAME="hosting-deployer"
PROJECT=""
APPLY=0

usage() { sed -n '2,17p' "$0"; exit "${1:-0}"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift; [ $# -gt 0 ] && shift ;;
    --apply) APPLY=1; shift ;;
    --dry-run) APPLY=0; shift ;;
    -h|--help) usage 0 ;;
    *) echo "Unknown argument: $1" >&2; usage 1 ;;
  esac
done

# The GitHub variables are named after the environment, so one repository can hold both.
# CONDITION is what a GitHub token must satisfy to be accepted by the provider.
#   dev:  any workflow of the repository (the dev deploy on merge and pull request previews).
#   prod: only a job that runs in the GitHub environment `production`. GitHub puts the environment
#         in the token's subject, and a job gets there only through the environment's rules
#         (required reviewer, version tags only). A pull request workflow can therefore not deploy
#         production, even if someone edits it to try.
case "$PROJECT" in
  quadevapp-dev)
    VAR_SUFFIX="DEV"
    CONDITION="assertion.repository == '$REPO'"
    ACCEPTED="only $REPO is accepted"
    ;;
  quadevapp)
    VAR_SUFFIX="PROD"
    CONDITION="assertion.repository == '$REPO' && assertion.sub == 'repo:$REPO:environment:production'"
    ACCEPTED="only $REPO, environment production, is accepted"
    ;;
  "") echo "Missing --project (quadevapp-dev or quadevapp)." >&2; exit 1 ;;
  *) echo "Unknown project '$PROJECT' (expected quadevapp-dev or quadevapp)." >&2; exit 1 ;;
esac

SA_EMAIL="${SA_NAME}@${PROJECT}.iam.gserviceaccount.com"
ROLES=(
  roles/firebasehosting.admin
)

# Prints a command; runs it only with --apply.
run() {
  printf '  '; printf '%q ' "$@"; printf '\n'
  if [ "$APPLY" -eq 1 ]; then "$@"; fi
}

# Like run, for a command that names the deploy service account. A service account created seconds
# ago is not visible to every IAM endpoint yet, and binding a role to it fails with "Service account
# ... does not exist" until it is, so the command is tried again for up to a minute.
run_retry() {
  printf '  '; printf '%q ' "$@"; printf '\n'
  [ "$APPLY" -eq 1 ] || return 0
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if "$@"; then return 0; fi
    if [ "$attempt" -lt 6 ]; then
      echo "  (attempt $attempt failed; trying again in 10 s, a new service account takes a moment to be visible)"
      sleep 10
    fi
  done
  echo "Gave up after 6 attempts: $*" >&2
  return 1
}

# Runs "create" only when "describe" fails (resource missing). In a dry run nothing is looked up, so
# the create command is printed with a note.
ensure() {
  local describe="$1"; shift
  if [ "$APPLY" -eq 1 ]; then
    if eval "$describe" >/dev/null 2>&1; then
      echo "  (exists) $*"
      return
    fi
  else
    echo "  # skipped when it already exists:"
  fi
  run "$@"
}

if [ "$APPLY" -eq 1 ]; then
  echo "APPLYING to project $PROJECT as $(gcloud config get-value account 2>/dev/null)"
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
else
  echo "DRY RUN for project $PROJECT (nothing is executed). Re-run with --apply to execute."
  PROJECT_NUMBER="<PROJECT_NUMBER>"
  echo "  PROJECT_NUMBER=\$(gcloud projects describe $PROJECT --format='value(projectNumber)')"
fi
POOL_ID="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}"

echo
echo "# 1. APIs used by token exchange, impersonation and the Hosting deploy"
run gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  cloudresourcemanager.googleapis.com firebase.googleapis.com firebasehosting.googleapis.com \
  --project "$PROJECT"

echo
echo "# 2. Workload identity pool (shared with quadev-backend) and GitHub OIDC provider ($ACCEPTED)"
ensure "gcloud iam workload-identity-pools describe $POOL --project $PROJECT --location global" \
  gcloud iam workload-identity-pools create "$POOL" --project "$PROJECT" --location global \
  --display-name "GitHub Actions"
ensure "gcloud iam workload-identity-pools providers describe $PROVIDER --project $PROJECT --location global --workload-identity-pool $POOL" \
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project "$PROJECT" --location global \
  --workload-identity-pool "$POOL" --display-name "$REPO" \
  --issuer-uri "https://token.actions.githubusercontent.com" \
  --attribute-mapping "google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition "$CONDITION"

echo
echo "# 3. Deploy service account and its role"
ensure "gcloud iam service-accounts describe $SA_EMAIL --project $PROJECT" \
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" \
  --display-name "Firebase Hosting deploy from GitHub Actions ($REPO)"
if [ "$APPLY" -eq 1 ]; then
  # Wait until the account can be read back before binding roles to it (up to a minute).
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT" >/dev/null 2>&1; then break; fi
    echo "  (waiting for $SA_EMAIL to be visible)"
    sleep 5
  done
else
  echo "  # then waits until the account is visible; the two bindings below are retried for up to a minute"
fi
for role in "${ROLES[@]}"; do
  run_retry gcloud projects add-iam-policy-binding "$PROJECT" --member "serviceAccount:$SA_EMAIL" --role "$role" \
    --condition None --quiet
done

echo
echo "# 4. Let workflows from $REPO impersonate the service account"
run_retry gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" --project "$PROJECT" \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/${POOL_ID}/attribute.repository/${REPO}" --quiet

echo
echo "# 5. GitHub repository variables for .github/workflows (names, not secrets)"
echo "  gh variable set WIF_PROVIDER_${VAR_SUFFIX} -R $REPO --body '${POOL_ID}/providers/${PROVIDER}'"
echo "  gh variable set WIF_SERVICE_ACCOUNT_${VAR_SUFFIX} -R $REPO --body '${SA_EMAIL}'"
