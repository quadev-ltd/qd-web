# ADR 0008: Job applications on the website

- **Status:** accepted (15 October 2026), built slice by slice (research doc 15 §16). Done: the
  applications foundation, the home that lists them, a new application with the pasted job, the
  page of an application (its details, the job, "Edit", "Remove"), its brief (slice 7), and the job
  as its text, a file or a link, read and named by the backend (slice 8, research doc 17), and its
  interviews (slice 22, D89).
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

## The brief (slice 7)

- **The page of an application has two tabs,** "Brief" (its own address) and "Details"
  (`/applications/:id/details`). A new application opens on its brief, not prepared yet.
- **Preparing is one call of up to a minute.** The page says it is working while it runs and reads
  the application again when it answers. A failure keeps the brief there was and says so; today's
  limit (10 briefs) is said when the backend refuses, and the buttons stop offering more. The count
  of today's briefs is read from the usage of the day, for "3 of 10 left today".
- **The items behind a requirement are read when there is a brief to show them in,** and again after
  each new brief: each item is a billed read, so no other page reads them since D70. An item the
  brief names that was removed since is left out.
- **"Out of date" has two levels,** as agreed in the design review: the job changed (a banner with
  "Refresh") or the profile changed (a line beside "Refresh"). The profile's revision is read again
  each time an application page opens, so a resource added on the profile shows here at once.
- **"Add a story" on a gap opens "Add a resource" on pasted text, as a note** (D53).

Where the brief goes beyond the artboards, or stops short of them:

| Where             | What                                                                   | Why                                                          |
| ----------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| The requirements  | Every requirement opens in place, the gaps first; six, then "Show all" | The artboard shows some open and others closed, with no rule |
| A gap             | "Add a story" only                                                     | "Practise this" has no backend yet                           |
| A likely question | Its notes, with the profile item a note comes from or "Advice"         | "Practise this question" has no backend yet                  |
| The tabs          | "Brief" and "Details"                                                  | Sessions and CV versions have no backend yet                 |

## The job from its text, a file or a link (slice 8)

The backend reads a job since quadev-backend #28 (research doc 17, D79): a new application is its
job and nothing else, and the backend names it.

- **"New application" asks for the job only:** "Text", "File" or "Link". A file follows the rules of
  a resource's file (PDF, Word or text, 10 MB) and is uploaded after the application is created, to
  the place the backend answers; a failed upload can be tried again there. The title, the company
  and the role are read from the job.
- **The application's page follows the reading,** as the profile follows a resource: every 2
  seconds, for 3 minutes at most. Until it is named, it is "New application", with the posting's
  site or the file's name under it. Until the job is ready there is no brief to prepare: the brief
  tab says the job is being read, or that it could not be read and why, with "Paste the text
  instead" (the edit form, where the job and a title can be given) and "Open the posting".
- **"The job" says where its text came from:** pasted, read from a file, or the copy of a posting,
  with the day, and whether the candidate changed it since.
- **While the job is being read its text cannot change** (the backend refuses), so "Edit the
  application" leaves it out.
- **A job read counts towards the day's limit of 20 readings,** shared with resources.

Where it goes beyond the artboards, or stops short of them:

| Where                      | What                                                                    | Why                                                                       |
| -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| "Paste the text instead"   | Opens "Edit the application" on the job, where a title can be given too | After a failed reading the backend reads no names: the candidate names it |
| The job's file not arrived | "Waiting for the file", with removing as the way out                    | Not drawn                                                                 |
| "Read the posting again"   | Not built                                                               | It comes with the backend's slice 4 (research doc 17)                     |

## The posting read again (18 Oct 2026)

Since research doc 17's slice 4 (quadev-backend #32), a job from a posting can be read again, as
a link resource can (ADR 0007, "A page read again", for how the page follows it and says how it
went).

- **"Read the posting again"** ends "The job" on Details: "If the posting has changed. The new copy
  replaces this one", and with a brief "and your brief will show as out of date." While it is
  read, the copy stays, and the brief can still be prepared from it. A new copy raises the
  application's revision, so the brief says the job changed; the title, the company and the role
  stay.
- **Over a text the candidate edited, the page asks first:** "Replace your edited text?" (not drawn;
  worded as the remove dialogs), then sends `replaceEdited`. A `job-edited` refusal (edited in
  another tab) opens the same question.
- **"Try again" after a failed first reading,** next to "Paste the text instead", reads the posting
  from the start; the page follows the job as when it was added.
- **While the posting is read again its text cannot change** (`job-not-ready`), so "Edit the
  application" leaves it out, as during a first reading. For a posting it says "Your copy of the
  posting. Reading the posting again replaces it."

## The interviews of an application (D89, 25 Oct 2026)

Since quadev-backend #54 (`36fbe7d`), an application holds its interviews, one per round, under
`users/{uid}/applications/{applicationId}/interviews`, written by `createApplicationInterview`,
`updateApplicationInterview` and `removeApplicationInterview` (research doc 15 §21, canvas version
43, row A8). The contract is mirrored in `src/core/profile/interviews.ts`.

- **The profile gateway carries them too,** with one new code, `profile/max-interviews`, for the
  `interview-limit` refusal (20 per application). `no-application` and `no-interview` are both "not
  found": the page says the interview or its application is no longer here.
- **Each application's interviews are read once, when its Interviews tab or one of them opens**, into
  an `interviews` slice by application, earliest first; a change reads its interview again, and the
  application, whose `interviewTimes` the list of applications shows. Removing an application
  forgets its interviews; signing out forgets them all.
- **The page never works out when an interview starts.** It sends the date and start time as typed,
  with the browser's IANA zone, and shows the backend's `startsAt` in the browser's zone ("Times are
  in London time (GMT)"). An interview entered in another zone says so on its page ("Added in New
  York time: 10:00"). The edit panel shows the date and time in the browser's zone, and sends the
  three together only when one changed, so an untouched interview keeps its zone.
- **An interview has ended at its start plus its length, or an hour after its start without one.**
  Until then it is under "Coming up", and the next interview on the list of applications; the pages
  read the time again once a minute.
- **Length and type are toggle chips** (`ToggleChips`): buttons with `aria-pressed`, where pressing
  the chosen one clears it, since an optional choice can't be a group of radios left empty.
- **Times in tests:** the unit tests run in `Europe/London` (`vite.config.ts`), and both Playwright
  configurations set `timezoneId: 'Europe/London'` and `locale: 'en-GB'`, so a run says the same
  things on any computer. The preview's backend works out `startsAt` as the real one does, with the
  same rule for a change of the clocks.

## Consequences

- When research doc 17 is merged on the backend, "New application" loses its title field, offers
  "Text", "File" and "Link", and the page shows the job's reading states.
