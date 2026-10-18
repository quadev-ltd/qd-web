# ADR 0009: CV versions on the website (delivery 2b)

- Status: accepted, being built
- Date: 18 Oct 2026
- Context: research doc 15 §18 (the website slices), doc 18 (the backend plan), doc 13 §16, §17.3
  and §19 (canvas version 26), D69, D75, D80, D81

## Context

A CV version starts from one of the candidate's CVs (a resource of type CV with its text kept,
research doc 17) and is improved with what the whole profile shows, in general or for one job.
quadev-backend makes it with the `cv-version` skill pack and keeps it in
`users/{uid}/cvVersions/{versionId}`: a copy of the CV's text, the findings, the changes (each
quoting the passage it changes and naming its sources), the questions and, for a job, the job's
terms the CV and the profile don't show. The candidate decides each change. The backend's slices
are all merged (quadev-backend #33 to #36).

## Decisions

- **Behind two flags.** The CV tool is part of the interview tools (`interviewAssistant`) and has
  its own flag, `cvTool`, default off. `CvRoutes` sits inside the profile's routes (which give the
  first flag, the gateway and the profile) and says "Not available for your account yet" without
  the second. "CV" appears in the main navigation, and the home's "Improve your CV" path opens it,
  only with both.
- **The contract is mirrored, `cvVersionText` included.** `src/core/profile/cvVersions.ts` copies
  the backend's names, limits and its `cvVersionText`, the text of a version with the accepted
  changes and answers applied. The download and the comparison use it, so they say what the backend
  says. Its spec carries the backend's own cases.
- **Making a version is asynchronous.** `createCvVersion` answers at once with the version's id,
  `creating`; a background trigger makes it (about a minute) and the document says how it ended. The
  page opens the version at once ("Creating your version… You can leave this page") and
  `CvVersionsProvider` follows it every 2 seconds, as a resource is followed. One `creating`
  status, no steps (D80). A version still `creating` after 5 minutes was lost: the page offers
  "Remove".
- **"Try again" after a failure** asks for the same version again and removes the failed one,
  which keeps nothing. A failure does not always count towards the 5 a day (the backend counts a
  model call whose answer was unusable), so the page says nothing about the count there.
- **The panel** asks what the version is for only when opened from "New version"; the first
  screen's two cards open it with the choice made. "Start from" shows only with two or more CVs
  that have their text; the length is under "More options"; it says "Written as a UK CV" instead
  of asking (D80), and asks for no names to leave out (D81). "Takes about a minute · 4 of 5 left
  today" comes from the day's usage, as the brief's count does.
- **State** is a `cvVersions` slice of the store, like the applications: read once by the first
  CV page of a session.

## In this first slice, and what follows

Slice 12 (this ADR's first part): the CV section in its three states, the panel, a version being
made, failed and lost, a version made shown as its CV with what is left to review, and remove.
Then: the review (findings, the job's terms, the CV with each change marked, the changes and
questions with their decisions, "Mark as sent", the download), and compare, restore and the
application's CV tab (doc 15 §18).

## Not verified

- The real model has not made a version yet (the backend's first live run waits for the owner);
  the tests use the backend's offline answer and the website's own fake.
