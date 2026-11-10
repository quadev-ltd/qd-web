# ADR 0012: Mock interviews, taken in turns (D100)

- Status: accepted. Slice 2 of research doc 24 (the take-turns way), proven against the backend's slice 1
  (quadev-backend 5ab5f7e) in its emulators
- Date: 2026-11-10

## Context

The owner approved mock interviews on dev for testers, in three ways to choose between (D100, research doc 24).
The first is "take turns": the interviewer's question is played with the microphone off, the answer is recorded
until "I'm done" and sent in the call itself, never stored, and the next line comes back with its audio. The
backend's contract is doc 24 §13 (callables `startMockInterview` to `removeMockSession`, documents
`users/{uid}/mockSessions/{id}`, flag `mockInterview` with `interviewAssistant`, service `mockInterview` at 3
sessions and $2 a day). The screens are canvas version 62 (doc 24 §14), and the browser's own states were agreed
with the design chat (§12). Real time and the voice model come with slices 4 and 5; hints with H2.

## Decisions

- **The interview runs in a controller outside React** (`src/core/mock/MockInterviewController.ts`). It plays the
  lines, records, sends, pauses and ends; the page shows its `view` (useSyncExternalStore) and calls its actions.
  The gateway, the microphone, the recorder and the player are given to it, so its spec drives every step with
  fakes. Each action raises a generation count, so a step still waiting on the one before stops.
- **The sound is unlocked by the press that starts or continues it.** One AudioContext is made or resumed in
  "Start the interview" (or "Continue the interview" after a reload), and every line plays through it. If the
  browser still holds the sound back, the page asks for a tap ("Tap to hear the question"). Lines are decoded by
  Web Audio, so MP3 and WAV both play.
- **The answer is recorded as the browser can:** Opus in WebM where it can be (Chrome, Edge, Firefox), else AAC
  (Safari), at 32 kbit/s. It stays in the page's memory until it is sent. Leaving the page, or ending the
  interview, while an answer is held asks first (`useBlocker` and `beforeunload`).
- **Every press that sends something has a request id,** reused for "Send again", so an answer is never sent
  twice. A `busy` call is sent again a second later, up to 5 times.
- **What §13.5 asks the browser to measure** goes with the next call (`played`): from the press to the first
  sound, from the response to the first sound, whether a tap was needed, and the repeats. The browser, the
  system and a guess at headphones go once, with the start. The devices' labels never leave the page.
- **Leaving the tab pauses the interview** (`visibilitychange`), the recording and the backend's clock. The
  "Pause" button does the same. Back, the same answer can go on, start again, or the question be heard again.
- **One route with the session's id optional** (`…/interviews/:interviewId/mock/:sessionId?`), so the page and
  its controller stay when the address gets the id after the start, and a reload comes back to the session.
- **The progress line reads the session** after each new question: "Question n of m" from the plan, a follow-up
  keeping its question's number, and the time left from the calls, run down on the page.
- **Mock interviews join Sessions** in their job's group, first, and the counts in "Remove all" and "Remove this
  application?". A mock interview opens at `/sessions/mock/:sessionId` with what was said. A question said
  differently shows the wording heard last, which the answer replies to, marked "Said differently", with the first
  wording under it (canvas version 66).
- **The voices' samples are files of the site** (`public/mock/voice-gemini.mp3`, `voice-chirp.mp3`), voiced once
  by the backend's check, behind "Hear it" in the setup.
- **The browser tests use a stand-in microphone:** a tone played into a real audio stream, which MediaRecorder
  records as it would a microphone. Chromium's fake devices wait on the system's microphone permission on a
  Mac, which a headless run never gets. Against the emulators (`e2e-emulators/mock.spec.ts`) a gain silences it,
  so a short answer is under the fake's 1,000 bytes and "nothing heard"; the clock is moved with the
  administrator's REST call, as the backend's own tests move it.

- **The hosting headers let the site's own pages use the microphone** (`Permissions-Policy: microphone=(self)`,
  the other features still off) and play its own sounds (`media-src 'self'` in the content policy waiting to be
  enforced, for the voices' samples). A spec reads `firebase.json`: the browser tests are served by Vite without
  these headers, and their stand-in microphone replaces `getUserMedia`, so they could not see `microphone=()`,
  which blocked every mock interview on dev until this was fixed (10 Nov 2026).

## Hints (slice H2, 10 Nov 2026)

Against the backend's slice H1 (quadev-backend #67, `8bff7f1`): the setup's choice goes with the start as `hints`
and is kept on the session as `hintsShown`; the trigger `onMockSessionWritten` writes each question's 3 to 5 key
points into the session's `hints`, by plan question for a planned turn and by turn for a follow-up. Drawn as
`Web-X6-Hints` (canvas version 69).

- **The page reads the session again for hints, every 3 seconds,** while the ones it shows are on their way, and
  stops when they are in or failed, or after a minute (then "No hints for this question this time"). The site
  reads Firestore with Firestore Lite, which has no listeners; a follow-up's hints take 5 to 15 seconds, so about
  5 reads.
- **"After I answer" follows the controller:** its view says which turn's answer was just sent, from "I'm done"
  until the next answer starts recording, and the column shows that turn's points under "For the question you
  just answered" meanwhile (agreed with the design chat: a few seconds of thinking are too short to read them).
- **"Show hints" and "Show them now" hold for one turn,** so a follow-up starts hidden again.
- **A column beside the interview at 1280** (the page widens to 1120 px), under the answer on a phone; none
  during the opening.
- **The points are drawn as text practice's key points,** one component for both (`KeyPointList`).
- **An empty recording is "nothing heard",** decided in the page: "I'm done" pressed within a few milliseconds
  gave the backend an empty recording, which it refuses as invalid, and the page said the answer couldn't be sent.

## Consequences

- Real time (slice 4) adds a WebSocket and an AudioWorklet next to the recorder; the controller's view and the
  screens stay, with the end of the answer noticed by the server.
