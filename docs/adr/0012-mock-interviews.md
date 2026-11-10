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
  application?". A mock interview opens at `/sessions/mock/:sessionId` with what was said.
- **The voices' samples are files of the site** (`public/mock/voice-gemini.mp3`, `voice-chirp.mp3`), voiced once
  by the backend's check, behind "Hear it" in the setup.
- **The browser tests use a stand-in microphone:** a tone played into a real audio stream, which MediaRecorder
  records as it would a microphone. Chromium's fake devices wait on the system's microphone permission on a
  Mac, which a headless run never gets. Against the emulators (`e2e-emulators/mock.spec.ts`) a gain silences it,
  so a short answer is under the fake's 1,000 bytes and "nothing heard"; the clock is moved with the
  administrator's REST call, as the backend's own tests move it.

## Consequences

- Real time (slice 4) adds a WebSocket and an AudioWorklet next to the recorder; the controller's view and the
  screens stay, with the end of the answer noticed by the server.
- Hints (slice H2) take the side column at 1280; until then the interview is one column.
