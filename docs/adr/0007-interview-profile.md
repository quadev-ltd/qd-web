# ADR 0007: The interview profile on the website

- **Status:** accepted for the build (October 2026). Nothing described here is in a build yet: this
  record was written with the checks of 13 Oct 2026 ("slice 0"), before any screen. Each slice that
  follows updates it.
- **Scope:** `src/core/profile/` (to come), `src/core/firebase/` (the callables, the reads, the
  upload), `src/core/flags/`, the Content-Security-Policy in `firebase.json`, the `e2e-emulators`
  job (to come)

## Context

The first signed-in feature of the website is the interview profile: a candidate adds a CV and other
resources (a file, pasted text or a link), sees what was read from them, and corrects the skill map.
The backend is built and on the dev project (`quadev-backend`, codebase `interview-profile`): the
callables `createProfileResource`, `updateSkillMapItem` and `removeProfileResource`, a Storage
trigger that reads what is uploaded, and documents the owner reads straight from Firestore. Its
contract is `docs/api.md` in that repository.

Until now the website had only signed users in. It had never called a function, exchanged an App
Check token, uploaded a file or read anything but the account document, and its end-to-end tests ran
against an in-memory fake. Five things were unknown, and each could have changed the design, so they
were tried first.

## Decision

The build follows the patterns the repository already has.

1. **A profile gateway, as the account has** (ADR 0002). An interface in `src/core/profile/`, a
   Firebase implementation in `src/core/firebase/`, an in-memory preview implementation, and a mock
   for specs. Screens never import Firebase.
2. **The contract is mirrored, not imported.** `@quadev/shared` is private and not published. The
   names of the callables, the limits, the document shapes and the link check are copied into
   `src/core/profile/contract.ts`, which names the backend file each part mirrors (the flags
   registry already works this way). The end-to-end tests against the emulators are what catches a
   drift. The file changes only after the backend's `docs/api.md` says the same.
3. **Waiting for a resource is polling, not a listener.** The page reads the resource every 2
   seconds while it is `awaitingUpload` or `processing`, and says "taking too long" after 3 minutes.
   This keeps Firestore Lite (ADR 0004). The list of items is read when a page opens and after a
   change, not on every poll: each document read is billed.
4. **The upload is resumable** (`uploadBytesResumable`), to the path and with the content type the
   callable answers, once. Progress is shown with the native `<progress>` element, because the
   policy forbids the `style` attribute.
5. **The original file is downloaded through a link**, not read by the page (see the checks).
6. **The flag is read for real:** `featureFlags/{uid}`, then Remote Config, then the code default,
   the order the backend uses.
7. **An action shows that it is working until the backend answers.** Nothing is shown as done
   before the call returns (see "Cold starts" below).
8. **Production stays clean.** The new code loads behind the same dynamic import as the Firebase
   gateway, and `yarn check:bundle` also looks for the Storage and Functions addresses.
9. **Nothing about the candidate in the logs:** an operation name, an error code and the user id.
   Never a title, an address or the text of an item.

## What was checked before any screen

A page that used the real modules of `src/core/firebase` was driven in Chromium by a script, first
against the backend's emulators (`quadev-backend` at `106a428`, project `demo-quadev`, fake model),
then against the dev project (`quadevapp-dev`, the real model) from the development server with a
debug token. Each run used an account created for it and deleted at the end.

| Unknown                                                | Emulators                                                             | Dev project                                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| A signed-in call to a callable, with App Check         | Works, with a provider of our own (below)                             | Works. First debug token exchanged, first call accepted                             |
| A call that must be refused                            | Not signed in, no flag, a request off the contract, an unknown item   | No flag: `permission-denied`, `details.reason` = `flag`                             |
| The upload from the browser                            | 600 kB in 3 progress events; the trigger made it `ready` in 1.5 s     | A text file; `ready` after 12 s with 11 items from the real model                   |
| A second upload to the same path, another type of file | Both refused by the rules (`storage/unauthorized`)                    | The second upload refused                                                           |
| The reads with Firestore Lite                          | One document, a list in order, another user's document refused        | The same reads                                                                      |
| Getting the original file back                         | The download address works, and so does reading the bytes in the page | The address works. Reading the bytes in the page is blocked (no CORS on the bucket) |
| The origins the policy needs                           | Not applicable (local addresses)                                      | One is missing: `firebasestorage.googleapis.com`                                    |

### App Check

- **On the dev project** the SDK exchanged the debug token (`exchangeDebugToken`, status 200) and
  the deployed function accepted the call. It is the first App Check token this code has exchanged
  and the first signed-in call the deployed backend has had: 13 Oct 2026, 09:45:14 UTC (refused for
  the flag, as it should be), then 09:59:33 UTC (accepted, with the flag on for that account).
- **Against the emulators** neither reCAPTCHA nor a debug token can work: both are exchanged with
  Google for the real project. The Functions emulator reads a token without checking who signed it,
  so a build for the emulators uses a `CustomProvider` that returns an unsigned token in the shape
  of `fakeAppCheckToken()` in the backend's `tests/emulators.ts`. A deployed function refuses such a
  token. The emulator still refuses a call that carries no token at all.
- The backend's notes said the client SDK has no way to attach a token the emulator accepts. It
  has, so the end-to-end tests can use the real gateway and no switch is needed in the backend.

### Cold starts

On the dev project the first call of each function after a pause took 5 to 11 seconds
(`createProfileResource` 4.9 s, `updateSkillMapItem` 10.6 s, `removeProfileResource` 7.0 s); a warm
call took 0.3 s. Starring an item can therefore take ten seconds. Hence decision 7: a button or a
star shows that it is working and the result appears when the call returns. Showing the change at
once and taking it back after a failure ten seconds later would be worse.

### The original file

`getDownloadURL` answers an address on `firebasestorage.googleapis.com` that a normal link opens.
Reading the bytes from the page (`fetch`, or the SDK's `getBytes`) needs a cross-origin rule on the
bucket, which does not exist: `fetch` fails at once and `getBytes` retries for two minutes before it
gives up. The download is a link, and the bucket stays as it is.

### The Content-Security-Policy

Every request the page made to another origin during the dev run, from the page itself (requests
made inside reCAPTCHA's frame are governed by Google's policy, not ours):

| Origin                                          | Directive     | In the policy today |
| ----------------------------------------------- | ------------- | ------------------- |
| `identitytoolkit.googleapis.com`                | `connect-src` | Yes                 |
| `firestore.googleapis.com`                      | `connect-src` | Yes                 |
| `content-firebaseappcheck.googleapis.com`       | `connect-src` | Yes                 |
| `europe-west1-quadevapp-dev.cloudfunctions.net` | `connect-src` | Yes                 |
| `firebasestorage.googleapis.com`                | `connect-src` | **No: to add**      |
| `www.google.com/recaptcha/` (script)            | `script-src`  | Yes                 |
| `www.gstatic.com/recaptcha/` (script)           | `script-src`  | Yes                 |
| `www.google.com/recaptcha/` (frame)             | `frame-src`   | Yes                 |

The origin is added in the pull request that adds the upload. Remote Config will bring its own
(`firebaseremoteconfig.googleapis.com`, `firebaseinstallations.googleapis.com`) with the slice that
adds it.

### What else the runs showed

- **A callable's refusal carries its reason:** `error.code` (`functions/permission-denied`) and
  `error.details.reason` (`flag`) reach the page as the contract says.
- **Test accounts need no new dependency.** The Auth emulator creates an account and marks its
  email verified over HTTP, and the Firestore emulator takes the flag document with the header
  `Authorization: Bearer owner`.
- **The emulators' bucket** is `demo-quadev.appspot.com`; the dev project's is
  `quadevapp-dev.firebasestorage.app`. The website needs the name in a setting of its own
  (`VITE_FIREBASE_STORAGE_BUCKET`): the SDK cannot work it out.
- **Cost on dev:** two extractions (a short CV and a note), 1,743 tokens in and 579 out, $0.007.
- **On a developer's machine the Firebase SDK writes the debug token to the browser console.** It
  is the SDK's own line and cannot be turned off; it never happens in a build, which has no token.

## Consequences

- The plan holds: nothing found here changes a screen or needs a change in the backend.
- **Two additions for the Firebase folder**, both proven here and added with the first slice that
  needs them: a `storage()` service with its emulator connection, and the App Check provider for
  emulator builds.
- **The end-to-end suite against the emulators can use the Firebase gateway as it is**, with the
  backend at a pinned commit.
- **Every action needs its waiting state.** The designs have them ("uploading", "saving",
  "removing"); none may be skipped as "too quick to matter".

## Not verified

- **reCAPTCHA Enterprise on dev.quadev.net.** The debug token stands in for it on a developer's
  machine. The real exchange can only be seen when a page that calls a function is deployed to the
  dev site: the first check after the slice that adds "Add a resource" is merged.
- **The policy as Firebase Hosting sends it.** The origins above were recorded from the development
  server, which sends no policy. The browser console on dev.quadev.net is the proof, at the same
  moment.
- **A PDF and a Word document through the real model, and a link,** from the website. The backend
  has its own results for them; the walk-through at the end of the delivery repeats them here.
- **A large upload to the real bucket.** The dev run uploaded 549 bytes; the progress events were
  seen on the emulator only.
- **Remote Config on the website.** It comes with the last slice.

## Alternatives considered

- **The full Firestore SDK with a live listener** for the resource being read: the result would
  show up to 2 seconds sooner, for 106 kB more (ADR 0004).
- **A switch in the backend that turns App Check off inside the emulator:** it would touch every
  function and the tests that prove a call without App Check is refused. Not needed.
- **Reading the file in the page** (to show it, or to name the download): needs a cross-origin rule
  on the bucket of each project. A link does the job.
- **Installing `@quadev/shared`** from the private repository: the public website's build would
  need a credential for it. Mirroring one small file costs less.
