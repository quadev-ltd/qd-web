# ADR 0010: A CV written for the job (D83)

- Status: accepted (slices 16 to 19 of the website's numbering: doc 19 slice 5 is built)
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

## Lines, roles, questions and "Write again" (slice 18)

Against quadev-backend `3ed7884` (#42: no new edit version, `edit-retired`).

- **A line or a role opens.** Each line, each role's heading and each summary sentence of the CV
  is a button. Opened, it shows beside the CV when the window is at least 768 px wide (a card in the
  aside, with "What we did and why" closed meanwhile), and in a side panel over it on a phone
  (`useMediaQuery`). "Where it says this" lists each source: the resource's title and type with
  the item's words, the candidate's answer with its question and the day of the version it was
  written again from, or "Your words". An item removed or hidden since is "No longer in your
  profile".
- **Revisions are one `reviseCvLine` each**, then the version is read again, so the page shows
  what the backend keeps. A line is edited in "Your wording" beside "What we wrote", up to 800
  characters as the contract allows. A role's heading sends only the fields changed. An edited one
  offers "Restore what we wrote". A removed one keeps its place in the CV while the sources show,
  with "Restore"; off, the CV shows as it downloads.
- **Questions** are answered or skipped with `answerCvQuestion`, as before. An answer changes
  nothing by itself.
- **"Write again"** is `rewriteCvVersion`: a new version, followed while it is written. With
  answers the button counts them. Without, it writes again from the profile as it is now. Both say
  the version stays and that it counts as one of today's versions. The new version says which one
  it was written again from, with how many answers, and links to it.
- **"Try again" on an old edit version that failed** now writes a CV for the same target, at 2
  pages. The backend refuses new edit versions (`edit-retired`, mapped to `Invalid`), and nothing
  on the website asks for one any more.
- **The preview gateway** revises lines and roles, and writes again keeping the edits, leaving
  out what was removed and citing each answer, as the backend's checks keep them.

## The PDF's fonts and length (slice 19)

- **Letters beyond Western European.** The PDF's built-in fonts (Helvetica) write Western European
  letters only, and print anything else as "?". The CV details make that matter: "Łukasz" or
  "Dvořák" is the first line of the CV. When every letter fits, the file keeps the built-in fonts:
  small, and nothing to fetch. Otherwise it embeds Noto Sans (Latin, Greek and Cyrillic), regular
  and bold. Only the letters used go into the file (a subset: about 11 KB for a short CV). What
  Noto Sans lacks (Chinese, say) still prints as "?". The letters are checked against a throwaway
  document, so a file carries one set of fonts.
- **Where the fonts come from.** `@pdf-lib/fontkit` 1.1.1 (MIT), in its own chunk of about 330 KB
  gzipped, and the two TTF files (about 630 KB each), served from `public/fonts/` with their
  licence (`OFL.txt`, SIL Open Font License 1.1). They were taken from `@expo-google-fonts/noto-sans`
  0.4.2, which packages Google's Noto Sans. Both load only when such a file is made, so no page
  carries them. The build warns that the fontkit chunk is over 500 kB; it is lazy, so the warning
  is left as it is.
- **The layout keeps to the page estimate.** A page holds `CV_WORDS_PER_PAGE` (500) words with
  headings and spacing at 10 pt, single line spacing (1.2) and margins of about 14 mm (40 pt), in the
  PDF and in Word. Measured on CVs of known length: an estimate up to about 1.1 fills one page, up
  to about 2.2 two. Before, an estimate of 0.9 took two pages. A spec makes a CV of "about 1 page"
  and one of "about 2 pages" and counts the PDF's pages.
- **Word** names Arial and lets Word substitute fonts. It needs no embedding: Word writes any letter
  the system has.

Tests: specs make real PDFs (built-in fonts for "Café, Zürich", a Noto Sans subset and no
Helvetica for "Łukasz Dvořák", Greek and Cyrillic, and the page count against the estimate). A
journey on the preview build sets the name "Łukasz Dvořák" in the CV details, downloads the PDF and
reads its fonts.

## Less cluttered (after the owner's second CV, 19 Oct 2026)

The owner found the downloaded PDF too cluttered and approved layout fixes on the website side. The
writer's content (fewer full roles, "Earlier career") is changing separately, in cv-write 1.1.0.

- **Links are printed short.** `cvLinkLabel` drops the scheme, "www.", any fragment and a trailing
  "/", and keeps a query only for a Play store link's `id`. It is never cut short. `cvHeaderLines`
  uses it, so the text, the compare view, the page and the file agree. The rule was agreed with
  the backend chat, for `packages/shared` in its cv-write 1.1.0 change.
- **The header is set apart.** The headline is at 12 pt under the name, and the contact lines are
  at 9.5 pt in grey. The right to work goes on the contact line when the two stay within 100
  characters, about a line.
- **Roles stand apart from their bullets.** There is half a line more before each role's heading
  than between bullets, and a heading is never left alone at a page's foot (Word: "keep with
  next"). The page estimate still holds (the layout spec).
- **A role with no title** prints its organisation alone. An entry with no organisation or dates
  ("Earlier career") prints no date column. Both are checked, in the file and on the page.

## What follows

Doc 19 slice 5 is complete on the website. What is left is in doc 19 §6: "Edit my CV" (a resource
marked as "my CV"), saving an answer to the profile, "private" and "do not name", and US resumes.
