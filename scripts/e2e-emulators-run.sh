#!/usr/bin/env bash
# Runs inside `firebase emulators:exec` (scripts/e2e-emulators.sh), in the checkout of
# quadev-backend: starts its `live-assist` relay against the emulators when it has one (mock
# interviews in real time, research doc 24 §15.7), waits for it at ws://localhost:8090, runs the
# command given (Playwright), and stops the relay.
set -uo pipefail

relay=""
if [ -f scripts/live-assist-emulators.ts ]; then
  log="${TMPDIR:-/tmp}/qd-web-live-assist.log"
  npm run live-assist:emulators >"$log" 2>&1 &
  relay=$!
  for _ in $(seq 1 120); do
    if (exec 3<>/dev/tcp/127.0.0.1/8090) 2>/dev/null; then
      break
    fi
    if ! kill -0 "$relay" 2>/dev/null; then
      echo "The live-assist relay stopped; its output is in $log." >&2
      exit 1
    fi
    sleep 0.5
  done
  echo "The live-assist relay is at ws://localhost:8090 (its output: $log)."
fi

"$@"
status=$?

if [ -n "$relay" ]; then
  # npm runs the relay as a child: stop the group.
  pkill -P "$relay" 2>/dev/null || true
  kill "$relay" 2>/dev/null || true
fi
exit $status
