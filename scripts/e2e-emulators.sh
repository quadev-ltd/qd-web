#!/usr/bin/env bash
# Runs the end-to-end tests of e2e-emulators/ against the emulators of quadev-backend.
#
#   scripts/e2e-emulators.sh [<path to a checkout of quadev-backend>] [-- <playwright arguments>]
#
# The checkout defaults to $BACKEND_DIR, then to ../quadev-backend. It should be at the
# commit in e2e-emulators/backend-commit (the script says so when it is not, and carries
# on: trying a newer backend is a normal thing to do). It needs Node 24 and Java 21, and
# the backend's dependencies installed (`npm ci` there).
#
# What it does: builds the backend's functions, starts the Auth, Firestore, Functions and
# Storage emulators with the project demo-quadev (which can reach no real Google service
# and no model), runs Playwright with playwright.emulators.config.ts, and stops them.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

backend="${BACKEND_DIR:-$root/../quadev-backend}"
if [ "$#" -gt 0 ] && [ "$1" != "--" ]; then
  backend="$1"
  shift
fi
if [ "${1:-}" = "--" ]; then
  shift
fi

if [ ! -f "$backend/firebase.json" ]; then
  echo "No checkout of quadev-backend at \"$backend\"." >&2
  echo "Usage: scripts/e2e-emulators.sh [<path to quadev-backend>] [-- <playwright arguments>]" >&2
  exit 1
fi
backend="$(cd "$backend" && pwd)"

pinned="$(tr -d '[:space:]' < "$root/e2e-emulators/backend-commit")"
actual="$(git -C "$backend" rev-parse HEAD 2>/dev/null || echo unknown)"
if [ "$actual" != "$pinned" ]; then
  echo "Note: quadev-backend is at ${actual:0:7}; the tests are pinned to ${pinned:0:7} (e2e-emulators/backend-commit)." >&2
fi

# The same firebase-tools as `yarn firebase` (package.json).
firebase_tools="$(node -p "require('$root/package.json').scripts.firebase.split(' ').pop()")"

echo "Building the functions of quadev-backend (${actual:0:7})..."
(cd "$backend" && npm run build)

playwright=(yarn --cwd "$root" playwright test -c playwright.emulators.config.ts "$@")
command="$(printf '%q ' "${playwright[@]}")"

cd "$backend"
npx --yes "$firebase_tools" emulators:exec \
  --project demo-quadev \
  --only auth,firestore,functions,storage \
  "$command"
