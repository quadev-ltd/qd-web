# ADR 0007: The interview profile on the website

- **Status:** accepted (October 2026), and built slice by slice. Done: the checks of 13 Oct 2026
  ("slice 0", before any screen), the foundation ("slice 1": the flags, the gateway, `/profile`
  behind the flag, the tests against the emulators), the profile page with "Add a resource"
  ("slice 2"), the page of a resource ("slice 3") and the finish ("slice 5": what was read, on the
  page of each resource, the download, the home's starting card, Remote Config). The skill map and
  the item ("slice 4") wait: the owner took them out of this delivery on 14 Oct 2026 (see "The
  skill map waits"). Left: the walk-through on the dev site with the real model.
- **Scope:** `src/core/profile/`, `src/core/firebase/` (the callables, the reads, the upload),
  `src/core/flags/`, `src/screens/Profile/`, the Content-Security-Policy in `firebase.json`,
  `e2e-emulators/` and the `e2e-emulators` job

## Context

The first signed-in feature of the website is the interview profile: a candidate adds a CV and other
resources (a file, pasted text or a link), sees what was read from them, and corrects the skill map
(the skill map waits since 14 Oct 2026: see the section of that name).
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
   the order the backend uses. The override is read first (it is enough to open the feature for
   chosen accounts); Remote Config comes with the last slice, before the flag is turned on for
   everyone.
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

## The foundation (slice 1)

What exists after it, and the choices made while building it:

- **The flags come through the auth gateway** (`getFlagOverrides(uid)`), not through the profile
  gateway: they belong to the account, every signed-in page may need them, and the auth gateway
  and Firestore Lite are already loaded everywhere. `FlagsProvider` reads them once per user and
  says when they have arrived (`useFlagsReady`), so `/profile` waits instead of showing "Not
  available" for a moment to an account that has the flag.
- **The profile gateway is loaded by the profile's routes**, not by the application.
  `ProfileRoutes` (a layout route) checks the flag, shows "Not available for your account yet" at
  every address of the profile when it is off, and otherwise provides the gateway to the page. In
  a dev build the gateway and the Functions, App Check and Storage parts of the SDK are one file
  of 59 kB (19 kB gzip) that only a profile page requests. The main file of the production build
  grew by 0.6 kB gzip (the flags, the route, the texts).
- **A `ProfileError` with a code in the screens' words** is what every gateway rejects with. The
  Firebase gateway maps the callable, Firestore and Storage errors to it in one function
  (`toProfileError`). The Functions SDK reports a request that never left the browser as
  `internal`: it is read as a network failure when the browser says it is offline.
- **A document the page does not understand is left out, not fatal.** The reads check each
  document against the contract; one that fails is skipped and counted in the log (a count, never
  its content). A failure reason this version does not know is shown as a fault on our side.
- **The preview gateway behaves like the backend's fake model** (a reading that takes a moment, a
  `.invalid` link that fails, no item added twice, the same limits), with controls for what a test
  cannot wait for (`window.qdPreviewProfile`). Flags have their control on the auth side
  (`qdPreview.setFlag`): the sample account has the interview tools on, a new account does not.
- **"Not available" is not drawn for the profile.** The artboard shows the CV tool; the profile
  uses the same card with a description put together from the designs' own sentences.
- **The header on a phone.** With a third link the navigation no longer fitted next to the brand:
  it now takes a row of its own under the brand and the account button, as the artboards at 390
  show.
- **Tests against the emulators:** `e2e-emulators/`, three tests so far (who gets the profile),
  44 seconds on a developer's machine including the backend build and the start of the
  emulators. The pipeline job checks out the backend at the commit pinned in
  `e2e-emulators/backend-commit` with a read-only deploy key, and is skipped until that key
  exists. Its time in the pipeline is not known yet.

Left as it was: on the signed-in home, "Mock interview" and "Live interview" say "Available" for
an account with the flag, although neither exists on the website. The home is redrawn in the last
slice of this delivery.

## The profile page and "Add a resource" (slice 2)

- **The profile lives in the store** (`interviewProfile` slice), kept in step with the backend by
  `InterviewProfileProvider`, as `SessionProvider` does for the session. The pages that follow
  (a resource, the skill map, an item) read the same slice, so going from one to the other reads
  nothing again.
- **What is read, and when.** Everything once, by the first profile page of a session. Then only
  the resources the backend has not finished, every 2 seconds, and the skill map once more when
  one of them turns out to have added items. Coming back to the profile reads the unfinished
  ones again, once.
- **A resource is followed for 3 minutes**, counted from the backend's own time on the resource.
  A resource the page itself just added is also followed for 3 minutes by the page's clock, so a
  visitor whose clock is wrong still sees it become ready. After that the row keeps saying "Being
  read…" or "Waiting for the upload…"; the page of the resource (next slice) is where "taking too
  long" and "Remove" are.
- **A file whose upload fails can be uploaded again for the same resource** ("Try again"): the
  file store refuses a second upload only once a file is there. Sending the form again would
  leave a first resource waiting for ever. When the file store itself refuses the file, there is
  no second try.
- **Closing the panel does not stop an upload.** It goes on, and the list shows the resource.
- **Limits are checked before anything is sent,** with the messages of the designs: the file's
  type, an empty file, 10 MB, the title's 100 characters, the text's 50,000, and the address of a
  link with the backend's own check (`parseProfileLink`). The button waits while a limit is
  broken; an empty field is said when the form is sent.
- **Today's limit** is shown when it is reached: the count of today's usage document says so on
  opening, and the backend's refusal says so otherwise (it also has a limit on cost that the
  count does not show). "Three or fewer left" (question 18 of the design proposal) is not built:
  the question is open and the state is not drawn.
- **Panels are the native `<dialog>`,** opened as a modal: the focus stays inside, Escape closes
  it and the focus returns to what opened it, with no code of ours. It does not close on a press
  outside, so a form is not lost by accident. The unit tests cannot see a modal dialog (jsdom has
  none), so the keyboard is tested in a real browser.

Where the build goes beyond the artboards, or stops short of them:

| Where                         | What                                                                             | Why                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| The list                      | A resource is not a link yet, and has no arrow                                   | The page it leads to is the next slice                                                          |
| The skill map card            | No "Open the skill map" button                                                   | The skill map is the slice after                                                                |
| A failed resource in the list | Nine of the ten short reasons are ours ("No text found", "File too large", ...)  | Only "Could not read this page" is drawn; the full sentences belong to the page of the resource |
| "Upload a file"               | The form opens with an empty box and "Choose a file"                             | The artboards show the form once a file is chosen                                               |
| The title of a file           | Proposed from the file name in every file form                                   | Drawn for "Add your CV" only; it saves typing in both                                           |
| A file of another type        | "This file can't be read. Choose a PDF, a Word document (.docx) or a text file." | Not drawn                                                                                       |
| A failed upload               | "The file didn't upload. Check your connection and try again.", with "Try again" | Not drawn: the artboard has "could not start" only                                              |
| The empty profile             | A card in the middle of the page, with no button in the heading                  | Drawn for the phone only                                                                        |

## The page of a resource (slice 3)

- **It reads nothing of its own.** The resource and its items come from the store the profile page
  filled; opened by its address, it waits for that same read. The polling of the profile keeps it
  current while the backend is reading the resource.
- **"Taking longer than usual" after 3 minutes** without a change, by the backend's time on the
  resource. The page looks at the clock every 15 seconds while a resource is unfinished, so the
  message appears by itself.
- **Every way out of a failure is "Remove".** A resource is read once and never retried, so each
  of the ten reasons has its heading, its sentence and the same button.
- **Removing asks first,** says how many items go with the resource (and, until 14 Oct 2026, how
  many of those were edited), and cannot be left while the backend is at it. "Already gone" counts as done. The page
  then replaces itself with the profile, so "Back" does not return to what was removed.
- **Confirmations are the native `<dialog>` too** (`Dialog`), with the same code as the side panel
  for opening and closing.

Where the build goes beyond the artboards, or stops short of them:

| Where                                   | What                                                                                                              | Why                                                               |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| A failed resource                       | Eight of the ten headings and sentences are put together from the table of messages in the design proposal (§7.3) | Two are drawn: the page that could not be read, and today's limit |
| A resource stuck while being read       | "Reading it did not finish. A resource is read once, so remove it and add it again."                              | The artboard has the stuck upload only                            |
| "This resource"                         | "File: PDF", without the size                                                                                     | The backend's document has no size                                |
| "This resource"                         | No "Download the file" yet                                                                                        | It comes with the last slice                                      |
| An item in the list                     | Not a link yet                                                                                                    | The page of an item is the next slice                             |
| The dialog for a resource with no items | "No items were read from it.", and "Remove the resource" on the button                                            | Drawn for a resource with items only                              |
| An address that is not in the profile   | "This resource is not in your profile", with the way back                                                         | Not drawn                                                         |

**Open, and the owner's to decide: losing shared facts when a CV is replaced** (question 21 of the
design proposal). The backend does not add a fact the profile already has, and removing a resource
removes every item that came from it. So a new CV added before the old one is removed loses the
facts both share, with their stars and edits, when the old one goes. The dialog says how many
items go, as drawn; it does not explain this case. It could not be observed against the emulators
either: the fake model never gives the same fact twice.

## The finish (slice 5)

- **Remote Config is the second layer of the flags,** after the user's override, as in the
  backend. It was tried from a browser against the dev project before it was wired in (13 Oct
  2026): the fetch answers with the web app's own key, with the three flags of the client
  template, after one request to `firebaseinstallations.googleapis.com` and one to
  `firebaseremoteconfig.googleapis.com`. Both origins are in the policy now.
  - It is read once after sign-in, with the override, and a fetched template is trusted for an
    hour. A page waits for both layers (5 seconds at most for Remote Config) before it says "not
    available". A layer that cannot be read decides nothing.
  - Its part of the SDK is loaded on demand after sign-in, not with the Firebase gateway that
    every page of a build with accounts requests.
  - Against the emulators nothing is read: there is no Remote Config emulator, and the backend
    skips it there too.
- **A percentage rollout would not match the backend.** Remote Config decides a percentage per
  installation (per browser) on the client, and the functions decide it per account
  (`randomizationId: uid`). The same account could have a feature on one side and not on the
  other, for good. A release as the backend's guide describes it (one account, then everyone) has
  no such problem. Nothing here prevents a rollout from being set in the console; the README says
  not to.
- **The download is a link whose address is asked for when the page of the resource opens,** not
  at the press on "Download": a link the browser follows by itself is never blocked as a window
  the page opened, and the page never reads the file. When the address cannot be had (the stored
  file is gone), there is no link.
- **The home starts with "Add your CV"** for an account with the interview tools (D58, the first
  card only): it opens the profile with the CV panel. Once a CV is in the profile it is one line
  that says so. The card reads the profile through the same provider as the profile's pages, so
  opening the profile afterwards reads nothing again. A CV that could not be read does not count.
- **The three tools on the home say "Coming soon" to everyone.** Until now "Mock interview" and
  "Live interview" said "Available" to an account with the flag, although neither exists on the
  website. That made sense only while nothing read the flag.
- **One profile gateway for the page.** The home's card and the profile's routes each provide the
  gateway; `selectProfileGateway` now gives the same one every time. The browser tests found the
  need: the in-memory gateway was created twice and the second one did not know who was signed in.
- **The pipeline caches the packages and the browser** in `run-checks` and `e2e` too (they were
  only in the new emulator job), to keep the run inside the plan's budget.

## The skill map waits (14 Oct 2026)

The owner took the skill map and the page of an item out of this delivery, for now: "Can we delete
the skills map section, maybe I can add them later, but not now" (D68 in the research notes). Slice 4
(#25) is not merged and its branch is kept. The artboards were redrawn the same day, and the finish
follows them:

- **The profile's summary is "What we found":** how many items of each kind, and where to see them.
  It is not a link.
- **The page of a resource shows "What we read",** by kind and read only: the skills as tags, the
  other kinds as rows that open on the passage they were read from ("Where it says this").
  "Something not right?" says how to correct an item while items cannot be changed: remove the
  resource, then add a corrected one. Nothing on the page is starred, edited or linked to an item.
- **A link that was read has "The page":** its address, read once when it was added, and "Open the
  page". The address is then not repeated beside it, and the button says "Remove this link".
- **No "skill map" in the wording** while there is no page of that name. The home's line leads to
  the page of the CV and counts what was read from it. The remove dialog no longer counts edited
  items: nothing on the website edits them now.
- **The backend does not change.** Every resource is still read into items, and `updateSkillMapItem`
  stays in the contract, unused.

Where the build goes beyond the redrawn artboards, or stops short of them:

| Where                                | What                                                                   | Why                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| "Show all"                           | Three items of a kind, then "Show all"                                 | The artboards show two or three, and put "Show all" after two of three as well as after two of six        |
| The skills                           | Every one as a tag; a long one wraps inside its tag                    | The model writes skills as short sentences ("Go and PostgreSQL in production for six years."), not words  |
| An item without a passage            | Plain text, with nothing to open                                       | Not drawn; the backend can leave the passage empty                                                        |
| A link that was read, on the website | "The page" above "What we read"; "Remove this link" in "This resource" | Drawn on the phone only                                                                                   |
| The home's line while the CV is read | "Being read…" or "Waiting for the upload…" in place of the count       | Not drawn                                                                                                 |
| "Your profile" on the home           | Not built ("6 resources · 42 items read from them")                    | It is part of the home with applications (delivery 2a). The home of this delivery has the first card only |

## Consequences

- The plan holds: nothing found here changes a screen or needs a change in the backend.
- **Two additions for the Firebase folder**, both proven in the checks and added with the
  foundation: a `storage()` service with its emulator connection, and the App Check provider for
  emulator builds.
- **The end-to-end suite against the emulators uses the Firebase gateway as it is**, with the
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
- **Remote Config with a flag turned on for everyone.** The fetch was seen with every flag off.
  `set-global-flag --on` on dev, and the site following it, is part of the walk-through.

## Alternatives considered

- **The full Firestore SDK with a live listener** for the resource being read: the result would
  show up to 2 seconds sooner, for 106 kB more (ADR 0004).
- **A switch in the backend that turns App Check off inside the emulator:** it would touch every
  function and the tests that prove a call without App Check is refused. Not needed.
- **Reading the file in the page** (to show it, or to name the download): needs a cross-origin rule
  on the bucket of each project. A link does the job.
- **Installing `@quadev/shared`** from the private repository: the public website's build would
  need a credential for it. Mirroring one small file costs less.
