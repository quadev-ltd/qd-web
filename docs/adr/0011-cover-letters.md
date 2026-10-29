# ADR 0011: Cover letters (D98)

- Status: accepted. Slice 28 (writing and reading a letter) is built; slice 29 (changing one) is next
- Date: 2026-10-28

## Context

The owner decided cover letters as drawn (D98, research doc 22 §10 and §11, canvas versions 55 to 59): a
letter for one application, written from the profile, the job and the CV it goes with, every fact sentence
naming its sources, or improved from the candidate's own draft. The backend's slice 3 (quadev-backend #60,
`e15940b`) has the callables and the documents (`users/{uid}/coverLetters/{letterId}`), behind a new flag,
`coverLetters`, with `interviewAssistant`. The website's plan is research doc 15 §26, its thirteen choices
agreed with the design chat.

## Decisions

- **A copy of the backend's text functions** (`src/core/profile/coverLetters.ts`): `coverLetterText`,
  `coverLetterBody`, `coverLetterGreeting`, `coverLetterDate`, `coverLetterLength` and `coverLetterWords`,
  with the backend's fixtures in the spec, as for `cvDocument.ts`. The copied text, the downloads, a form's
  box counter and the tab's sizes all come from them, so the website says what the backend counts.
- **Letters live in their own slice of the store, by application** (`coverLetters`), read when the "CV
  and letter" tab or a letter first opens, and changed only through the callables. A letter is written in
  the background; `useFollowLetters` reads it again every 2 seconds meanwhile, as the CV pages do. Only the
  hook that shows the letters loads them, so a page reads them once.
- **Under the application** (D96): a letter at `/applications/:id/cv/letters/:letterId`, routed inside the
  CV routes (the versions it goes with and the CV details of its heading), with "Not available" without
  `coverLetters`. The tab reads "CV and letter" with the flag, "CV" without it, and so do the CV pages' ways
  back.
- **The panel sends what it shows:** "To" starts as the posting's contact (`job-read` 1.2.0's `contact`), the
  convention as the job's country suggests, one page, and the CV sent for the job, else the latest one for
  it, else none. Only ready CVs for this job are offered. "Write it for me" is off when no ready resource
  has items, as the backend refuses `no-items`; a draft still works.
- **A sentence is a button inside its paragraph,** pressed to open "Where it says this" beside the letter,
  or in a side panel at phone width. A number only the draft gives is a `<mark>` at its `at`, with its line
  under the paragraph whether sources are shown or not; it is never in the copied text.
- **The downloads reuse the CV's** (`BlocksDownloadButton`, split out of `DownloadButton`): the letter's text
  as blocks, the name and details at the top of a one-page letter, US Letter for a US letter.
- **"Try again"** after a letter couldn't be written asks for a new one with the same settings and removes
  the failed one, as for a CV.

## Consequences

- Changing a letter (its sentences, its questions, writing it again, "Edit the whole letter", a saved
  version) is slice 29, on the same store and page.
- The phone's read-only tab is `qd-mobile`'s.
