# ADR 0010: A CV written for the job (D83)

- Status: in progress (slice 16 of the website's numbering)
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

## What follows

The written version itself (doc 19 slice 3: `mode: 'write'`, `cvDocumentText`,
`reviseCvLine`, `rewriteCvVersion`) waits for the backend's contract to be merged. Then come the
new-version panel and "Writing your CV", the review of a written CV with its sources, editing
and removing lines and roles, "Write again", and the download drawn from the structure with an
embedded Unicode font.
