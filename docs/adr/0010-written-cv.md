# ADR 0010: A CV written for the job (D83)

- Status: in progress (slices 16 and 17 of the website's numbering)
- Date: 2026-10-19

## Context

The owner's first real CV version, made by editing an uploaded CV (ADR 0009), came out badly
(research doc 18 §9). The owner decided that a new version is a whole CV written from the profile
(D83). The research docs are 19 (the plan, the backend's slices 1 to 5) and 13 §20 (the design,
canvas version 31). The website side is the plan's slice 5, built here as several slices, behind
the flags `interviewAssistant` and `cvTool`.

Before this ADR, three changes got the website ready for the backend changing first (#40 to #42):
the marked view of a passage over two lines, versions of an unknown `mode` left out, and the new
item kinds `education`, `certification` and `language`.

## The CV's details (slice 16)

The name and contact lines at the top of every written CV are not written by the model. They are
a record of their own, `users/{uid}/interviewProfile/main/details/cv`, filled when a resource is
read and corrected by the candidate with `updateCvDetails` (quadev-backend #38, `61f4185`). The
contract copy is `src/core/profile/cvDetails.ts`.

- The details live in the `cvVersions` slice with a status of their own (`detailsStatus`), so a
  failure to read them shows on their card only and never hides the versions.
- `CvVersionsProvider` reads them each time the CV pages open, not once a session: reading a
  resource in the profile can fill them meanwhile.
- "Your CV details" (a side panel, doc 13 §20.3) sends **only the fields the candidate
  changed**. Every field sent is marked `edited` by the backend and is never filled again by a
  reading, so sending the whole form would freeze empty fields that a CV added later should fill.
  A cleared field is sent as `''`, and empty link inputs are dropped. With nothing changed, "Save
  my details" closes the panel without a call.
- Links are free text as the candidate wants them printed, at most 4, each up to 200 characters,
  as the contract says. The inputs cap their length (`maxLength`), so there is no length error to
  show.
- The note at the top says where the details came from: the resources still named in `sources`.
  With nothing filled, it says so and suggests adding a CV.
- The card "At the top of every CV" is on the CV section's first screen and in the list. It shows
  nothing until the details are read, so it never shows "nothing yet" by mistake.
- The preview gateway fills the details when a CV is read (from the fictional Maya Okafor) and
  follows the backend's rules: a field the candidate set or cleared is kept, and removing a
  resource clears what it filled unless the candidate edited it.

Tests: specs of the contract reader, the slice, the panel (only the changed fields are sent) and
the card; a journey on the preview build; the page checks (accessible, no horizontal scroll at
both widths); and an emulator test against `61f4185` (filled by the fake reading, corrected, read
back after a reload).

## The written version: making and reading it (slice 17)

Against quadev-backend `fbf8c26` (doc 19 slice 3, #40, and the right-to-work line, #41).

- **The contract copy.** `src/core/profile/cvDocument.ts` copies the backend's
  `packages/shared/src/cvDocument.ts`: the document, `cvHeaderLines`, `cvRightToWorkLine`,
  `cvEntryHeading`, `cvDocumentText`, `cvDocumentWords`, `cvDocumentPages`, `CV_WORDS_PER_PAGE` and
  the section headings. Its spec is the backend's fixtures, copied as they are, so the same input
  gives the same text here and there. `CvVersion` is now `CvWrittenVersion | CvEditVersion`, read
  with one zod union. A version with no `mode` is an edit, and a mode the website doesn't know is
  still left out (#41). A line's source of a kind the website doesn't know is dropped, not the line.
- **Every new version is written.** The panel sends `mode: 'write'` with `pages` (1 or 2, 2 by
  default), and no CV to start from. It shows the CV details that go at the top, with "Edit"
  opening their panel over it (native modal dialogs stack). An edit version can no longer be asked
  for. Its review, compare, copy and download still work for the versions made before.
- **The first screen asks for something in the profile, not for a CV.** A written CV needs items,
  not a CV with its text, so "Add to your profile first" shows when the profile holds nothing. The
  backend refuses a profile with no visible items (`no-items`), and the panel says so.
- **The written CV as a page.** The header comes from the CV details as they are now (doc 13
  §20.6), then the sections in their fixed order, an empty one left out. A role's heading is laid
  out with its dates on the right. The source line under each line names the resources of the items
  it cites, read once for the page. An answer says "your answer of <date>", the date of the version
  it was written again from. A cited item that is gone says "a source no longer in your profile".
  Removed lines are left out; editing and removing come in slice 18.
- **Length.** `cvDocumentPages` rounded to half a page: "About 1½ pages". "Longer than you asked"
  shows when that is over the pages asked for.
- **The download is drawn from the structure.** `writtenBlocks` turns the document into the
  file's blocks: name, header lines, headings, a role's heading with its dates, bullets and lines.
  Nothing is guessed from line lengths. The layout is denser for every file (10 pt, margins of about
  17 mm), so a page holds about `CV_WORDS_PER_PAGE` words. It is still drawn with the PDF's standard
  fonts. The Unicode font comes with slice 19.
- **Compare** uses `versionText`: a written version's `cvDocumentText` with the current details,
  or an edit version's `cvVersionText`. So an old version and a written one can be compared.
- **The preview gateway** writes a CV from the profile's visible items, each line citing its item,
  with notes, a question, a line "left out", and the job's first words as terms. A control,
  `createEditVersion`, makes a version the old way, for the specs and journeys of its review.

Tests: the backend's fixtures; specs of the reader (both kinds, an unknown source left out), the
written review, the source line and length, the panel, the version page (written, failed and
tried again, ready) and the structured download; journeys on the preview build (a general CV end
to end, a CV for a job marked as sent, a failure tried again, an empty profile, an old version
reviewed and compared with a written one); the page checks; and emulator tests against `fbf8c26`
(a CV written by the fake writer, read back, removed; two compared and one restored).

## What follows

- Slice 18: a line opened ("Where it says this" with the items' words), edit, remove and restore
  of lines and roles (`reviseCvLine`), the questions answered and "Write again"
  (`rewriteCvVersion`, "Written again from the version of …").
- Slice 19: the PDF's Unicode font, loaded only when a file is made, and the layout checked
  against the page estimate.
