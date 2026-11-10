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

## Feedback on the answers (slice F2, D101, 10 Nov 2026)

Against the backend's slice F1 (research doc 24 §18): the trigger writes each answer's feedback into the
session's `answerFeedback`, by turn, as soon as it is answered, and `overall` ("How it went") once the session has
ended and every answer's has settled; `retryMockFeedback` asks for one of them again. Drawn as `Web-X6-End`,
`Web-R2-Mock` and `Web-R2-Mock-Feedback-States` (canvas versions 71 to 73).

- **Never during the interview.** The end page shows "How it went" above the testers' card; Sessions shows it at
  the top, and each answer's feedback behind "Show feedback". A session still going shows none.
- **The page reads the session again every 5 seconds** while an answer's or the overall view is being written,
  for 3 minutes, then says "This is taking longer than usual" with "Check again" (§18.7).
- **None coming is worked out by the page:** an answer with no entry 5 minutes after it was given, or one still
  `writing` 5 minutes after the trigger claimed it (the trigger's time), and an ended session with no overall
  view 5 minutes on. It shows "Get feedback" rather than reading for 3 minutes. Sessions from before F1, the
  owner's first interview among them, are the case; one call starts every answer with none, since the trigger
  claims them all, and the overall view follows.
- **Asked for again on the page, it is on its way** until a read shows it, since the call clears it first. A
  `not-failed` refusal means it is on its way already, and is not shown as a failure.
- **Today's limit:** the time it can be had is the next midnight UTC in the candidate's time; once the UTC day has
  changed, "Get feedback" asks again.
- **One component for the sections,** text practice's and each answer's (`FeedbackSections`); the overall view
  uses its lists.
- **"Practise it" and "Practise this question"** start text practice with `{ source: 'mock', sessionId, turnId }`
  and no interview (the session's is used), with the `textPractice` flag, and open the practice under the
  interview from the end page, under Sessions from Sessions. "Start again with new key points" on such a
  practice asks the question as typed, since the hints would be the same key points again.

## Real time (slice 4, D100, 10 Nov 2026)

Against the backend's slice 3 (quadev-backend #69, `cf88e08`; the contract in doc 24 §15, its code in
`packages/live-protocol`) and its #71 (the continue call says where to connect). Drawn as `Web-X6-Setup` redrawn,
`Web-X6-RT-Ready`, `-RT-Speaking`, `-RT-Listening` and `-RT-States` (canvas versions 70 and 75).

- **A controller of its own** (`src/core/mock/LiveInterviewController.ts`), beside the take-turns one: one
  WebSocket to the relay, whose `state` messages say what the page shows. The page picks the controller by the way:
  the session's once there is one, else the setup's. The screens of the interview are its own
  (`MockLiveRealTime.tsx`); the setup, the progress line, the hints, the pause, the end and what was said are
  shared.
- **The microphone streams all the time** in 100 ms frames of 16 kHz PCM, through an AudioWorklet served as it is
  (`public/mock/live-capture.js`), with the browser's echo cancellation. Paused, nothing is sent and the pings go
  on. **The voice** is 24 kHz PCM, played frame by frame on the same AudioContext, unlocked in the press.
- **The page's own voice detection interrupts:** two frames in a row above a level, a higher one while the
  interviewer plays, since some of its voice comes back in. The line stops, and `interrupt` says how far into it.
  The closing can't be interrupted. The levels are a first guess, for the relay's `leakedWords` and
  `falseBargeIns` to measure.
- **Reconnecting:** a connection that drops after it was ready is tried again at once, then after 1, 2, 4 and 8
  seconds, with the resume token while it is under 2 minutes old. After that, "We couldn't reconnect" with "Try
  again" and "End the interview", which uses the call. `reconnect` from the relay connects again at once. `replaced`
  says the interview is open in another tab; "Continue here" connects again, which takes it back.
- **Pause and end are messages while connected;** the calls are used only when the socket is down, as the backend
  asked (a call's pause isn't seen by an open connection).
- **Continuing after a reload** calls `resumeMockInterview`, which on this way says where the relay is and nothing
  else; the relay then says the line waiting.
- **The preview has a stand-in relay** (`previewLiveRelay.ts`), which behaves as the backend's offline fakes: a
  short tone per line, any sound heard as speech, 1.5 seconds of silence ending an answer. Its controls drop the
  connection and take it to another tab, for the browser tests.
- **No Repeat on this way** (doc 24 §16): "Say it differently" and Skip only; the candidate can ask aloud.
- **The content policy** lists the relay's address on dev under `connect-src`.

## The voice model (website slice 5, D100, 10 Nov 2026)

Against the backend's slice 5 (quadev-backend #72, `79ad181`): the same relay and messages, and a Gemini Live model
that listens and speaks in its own voice. Drawn on `Web-X6-RT-States` (canvas versions 70 and 77).

- **The same controller and screens as real time.** The relay's `ready` says the way. The voice model's differences
  are kept to a few places.
- **No voice to choose:** the setup says the model speaks in its own voice. None is sent at the start, and Sessions
  reads the stored `gemini-live` as "The model's own".
- **Its words come after it speaks:** a `line` comes with no text, and the card shows the level and "Its words
  appear here when it finishes speaking." until `lineEnd`. A line cut off within its first word gets no words, and
  the card says the interviewer stopped when the candidate started speaking.
- **The line with a turn is the one to answer:** the opening asks the first question, and later lines say only
  "question". A line carries the turn waiting when it starts. The page takes each line's turn from the record's
  `lineIds` once its words have come, reading the session again at each `lineEnd`, for the hints and the progress
  line.
- **No `answerEnd`:** an answer ends when the model speaks or thinks again. That moment stands in for it for "after
  I answer" hints and the answer's length.
- **The page still sends `interrupt`** when it hears the candidate: the relay stops sending that line's audio at
  once, before the model stops by itself.
- **The stand-in relay** has the voice model's way too, as the backend's fake model behaves.

## Where the job is (doc 24 §19, 10 Nov 2026)

The owner noticed mock interviews could be found only from Sessions in the menu. Drawn in canvas version 78.

- **The interview's page** shows "Your mock interviews" under its details: the ones held for it, the newest first,
  up to 3, then "See all n in Sessions", which links to the application's Sessions tab. A session still going is
  left out. The page queries `mockSessions` where `interviewId ==` (one field: no index) alongside the interview,
  and draws both together so the likely questions don't move. A failed read leaves the card out.
- **The Interviews tab** counts each interview's mock interviews in a chip, from the account's sessions read once
  (200 at most). The chips may come a moment after the list.
- **The application's Sessions tab** comes with text practice or mock interviews, after Interviews. It shows this
  job's practice as Sessions groups it: its mock interviews, named by their interview, then its questions practised.
  The tab bar wraps at phone width.
- **The feedback chip:** "Preparing feedback" while any of it is being written or not yet due; otherwise "Feedback
  ready" once one answer's is; otherwise "No feedback yet". Agreed with the design chat.

## Consequences

- Real time (slice 4) adds a WebSocket and an AudioWorklet next to the recorder; the controller's view and the
  screens stay, with the end of the answer noticed by the server.
