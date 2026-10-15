# ADR 0008: Job applications on the website

- **Status:** accepted (15 October 2026), built slice by slice (research doc 15 §16). Done: the
  applications foundation, the home that lists them, a new application with the pasted job, and the
  page of an application (its details, the job, "Edit", "Remove"). Next: the brief (slice 7), then
  the job from a file or a link once the backend has it (research doc 17).
- **Scope:** `src/core/profile/applications.ts`, `src/core/profile/ApplicationsProvider.tsx`, the
  `applications` slice of the store, `src/core/firebase/applications.ts`, `src/screens/Applications/`
  and `src/screens/Home/InterviewHome.tsx`

## Context

The backend has had job applications and their brief since 12 Oct 2026 (quadev-backend #22): the
callables `createJobApplication`, `updateJobApplication`, `removeJobApplication` and
`prepareApplicationBrief`, and documents the owner reads under `users/{uid}/applications`. A
proposed change (research doc 17, waiting for the owner) lets a new application take its job as
text, a file or a link and read its title from it. Applications are the second part of the
interview tools, behind the same `interviewAssistant` flag (D72 of the research notes).

## Decisions

- **The profile gateway carries the applications too.** They are in the same backend codebase,
  behind the same flag and App Check, with the same errors, and the brief points at the profile's
  items. One gateway keeps one choice of backend, one in-memory fake and one set of error codes. A
  new code, `profile/max-applications`, is the backend's refusal of a 51st application, logged as a
  normal refusal.
- **Read once, then kept in the store.** The first page that shows applications reads all of them
  (50 at most) with the profile's revision, and a change reads its own application again. No
  listener, as for the profile. The applications are sorted in the page, the most recently changed
  first.
- **"Out of date" is worked out in the page,** from two numbers the backend keeps: the brief's
  `applicationRevision` against the application's `revision` (the job changed), then its
  `profileRevision` against the profile's (`users/{uid}/interviewProfile/main`). When the
  profile's revision cannot be read, nothing is said about it.
- **Ready for research doc 17 without depending on it.** The `job` field it adds is read when
  present and ignored when absent, and a title may be empty. Until the backend reads the title, a
  new application asks for it above the pasted job, as the design chat suggested.
- **The home of an account with the interview tools is its applications.** With none yet: "Add your
  CV" and the three paths, of which "Prepare for a job" opens "New application" and the two others
  say "Coming soon". With some: "Your applications", each with where its brief is, and "Your
  profile" beside them. It is loaded on demand, so the page everyone else downloads does not grow.
  An account without the flag keeps the home it had.
- **An application's page is `/applications/:id`,** inside the profile's routes (the flag, the
  gateway), and the menu keeps "Home" marked on it.
- **"Edit the application" sends only what changed.** An optional field that is emptied is
  cleared; the job can be changed but not emptied; a posting's address is compared in its normal
  form.

Where the build goes beyond the artboards, or stops short of them:

| Where                      | What                                                                                      | Why                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| The home                   | The welcome banner and "Your account" stay, with the applications below the banner        | The artboard has neither; the account has no other page yet. Below the banner, a heading reads on the page's own background |
| The home's applications    | No "Start a session", no "Last practice", no "Practise without a job" and no minutes card | No backend for practice yet (research doc 15 §5)                                                                            |
| The page of an application | No tabs (Brief, Sessions, CV)                                                             | The brief is the next slice; sessions and CV versions have no backend yet                                                   |
| "New application"          | A title field above the job, and the job pasted only                                      | Until the backend reads the title and takes files and links (research doc 17)                                               |
| "The job"                  | "Pasted on …" only, with "Show all" for a long job                                        | A copy of a posting and "Read the posting again" come with research doc 17                                                  |
| "Remove this application"  | "Its brief is removed with it."                                                           | No sessions to mention yet                                                                                                  |

## Consequences

- The brief (slice 7) adds a tab to the application's page and reads the profile's items for the
  requirements a profile shows.
- When research doc 17 is merged on the backend, "New application" loses its title field, offers
  "Text", "File" and "Link", and the page shows the job's reading states.
