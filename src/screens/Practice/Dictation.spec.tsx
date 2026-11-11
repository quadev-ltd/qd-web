// Dictating a practice answer (D102, research doc 25 §4; Web-X7-Dictating, -Dictated and
// -Dictation-States): "Dictate" under the answer, the recording with "Stop and add" and "Cancel",
// the text turned from it added at the end or at the cursor with Undo, the count of dictations sent
// with the answer, and the states: the microphone blocked or missing, a browser that can't record,
// nothing heard, a failure that keeps the recording, today's limit, and leaving while recording.
import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';

import { InterviewPracticeScreen } from './PracticeTurnScreen';

import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { applicationFixture } from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { practiceTurnFixture } from '@/testUtil/practiceFixtures';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const fake = vi.hoisted(() => ({
  canRecord: true,
  elapsedMs: 42_000,
  open: vi.fn<() => Promise<MediaStream>>(),
  stops: 0,
  discards: 0,
}));

vi.mock('@/core/audio/recording', async importOriginal => ({
  ...(await importOriginal<object>()),
  canRecord: () => fake.canRecord,
  openMicrophone: () => fake.open(),
  blobToBase64: (blob: Blob) => blob.text().then(text => btoa(text)),
  AnswerRecorder: class {
    start() {}
    elapsedMs() {
      return fake.elapsedMs;
    }
    stop() {
      fake.stops += 1;
      return Promise.resolve({
        blob: new Blob([`recording ${fake.stops}`], { type: 'audio/webm' }),
        mimeType: 'audio/webm',
        durationMs: 4_200,
      });
    }
    discard() {
      fake.discards += 1;
    }
  },
}));

const stream = () => {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  return {
    getTracks: () => [track],
    getAudioTracks: () => [track],
  } as unknown as MediaStream;
};

const Location = () => <p>now at {useLocation().pathname}</p>;

const setUp = (gateway = createMockProfileGateway()) => {
  gateway.getItems.mockResolvedValue([
    itemFixture({ id: 'item-1', kind: 'achievement', resourceId: 'r1' }),
  ]);
  gateway.getPracticeTurn.mockResolvedValue(practiceTurnFixture());
  renderProfilePage(<></>, {
    gateway,
    route: '/applications/a1/interviews/i1/practice/turn-1',
    routes: [
      {
        path: '/applications/:applicationId/interviews/:interviewId/practice/:turnId',
        element: <InterviewPracticeScreen />,
      },
      { path: '*', element: <Location /> },
    ],
    interviewProfile: {
      uid: 'uid-1',
      status: 'loaded',
      resources: [resourceFixture()],
    },
    applications: {
      uid: 'uid-1',
      status: 'loaded',
      applications: [applicationFixture()],
      profileRevision: 3,
    },
    flags: { textPractice: true },
  });
  return { gateway };
};

const answerField = () =>
  screen.findByRole('textbox', { name: 'practice.answerField' });
const dictate = () =>
  screen.getByRole('button', { name: 'practice.dictateButton' });
const feedbackButton = () =>
  screen.getByRole('button', { name: 'practice.feedbackButton' });

beforeEach(() => {
  fake.canRecord = true;
  fake.elapsedMs = 42_000;
  fake.open.mockReset();
  fake.open.mockImplementation(() => Promise.resolve(stream()));
  fake.stops = 0;
  fake.discards = 0;
});

describe('dictating a practice answer (D102, Web-X7-Dictating and -Dictated)', () => {
  it('records, turns it into text, adds it at the end with Undo, and counts it in the answer', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockResolvedValue({
      text: 'I kept support updated.',
      words: 4,
    });
    let resolveText: () => void = () => {};
    const gate = new Promise<void>(resolve => (resolveText = resolve));
    gateway.dictatePracticeAnswer.mockImplementationOnce(async () => {
      await gate;
      return { text: 'I kept support updated.', words: 4 };
    });

    const field = await answerField();
    expect(field).toHaveAttribute('placeholder', 'practice.answerPlaceholder');
    expect(screen.getByText('practice.dictateNote')).toBeVisible();
    await user.type(field, 'We rolled it back.');
    await user.click(dictate());

    // Recording: the box is read-only, "Get feedback" off, and "Stop and add" has the focus
    expect(screen.getByText('practice.dictationListening')).toBeVisible();
    expect(field).toHaveAttribute('readonly');
    expect(feedbackButton()).toBeDisabled();
    const stop = screen.getByRole('button', {
      name: 'practice.dictationStopButton',
    });
    expect(stop).toHaveFocus();
    expect(
      screen.queryByText('practice.dictationWarnMessage'),
    ).not.toBeInTheDocument();
    await user.click(stop);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'practice.dictationTurning',
    );
    expect(field).toHaveAttribute('readonly');
    expect(feedbackButton()).toBeDisabled();
    expect(gateway.dictatePracticeAnswer).toHaveBeenCalledWith({
      turnId: 'turn-1',
      audio: { mimeType: 'audio/webm', base64: btoa('recording 1') },
      durationMs: 4_200,
    });
    await act(async () => resolveText());

    expect(field).toHaveValue('We rolled it back. I kept support updated.');
    expect(field).not.toHaveAttribute('readonly');
    expect(await screen.findByText('practice.dictationAddedEnd')).toBeVisible();
    const undo = screen.getByRole('button', { name: 'practice.undoButton' });
    expect(undo).toHaveFocus();

    // Undo puts the box back, and the dictation isn't counted
    await user.click(undo);
    expect(field).toHaveValue('We rolled it back.');
    expect(
      screen.queryByText('practice.dictationAddedEnd'),
    ).not.toBeInTheDocument();

    // Dictated again, then typed: the line goes and the dictation stays
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );
    expect(await screen.findByText('practice.dictationAddedEnd')).toBeVisible();
    await user.type(field, ' Then the review.');
    expect(
      screen.queryByText('practice.dictationAddedEnd'),
    ).not.toBeInTheDocument();
    expect(field).toHaveValue(
      'We rolled it back. I kept support updated. Then the review.',
    );

    await user.click(feedbackButton());
    expect(gateway.answerPracticeTurn).toHaveBeenCalledWith({
      turnId: 'turn-1',
      answer: 'We rolled it back. I kept support updated. Then the review.',
      dictations: 1,
    });
  });

  it('adds the words where the cursor was left', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockResolvedValue({
      text: 'within 40 minutes',
      words: 3,
    });

    const field = (await answerField()) as HTMLTextAreaElement;
    await user.type(field, 'We rolled it back. Then the review.');
    field.setSelectionRange(17, 17);
    fireEvent.select(field);
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );

    expect(
      await screen.findByText('practice.dictationAddedCursor'),
    ).toBeVisible();
    expect(field).toHaveValue(
      'We rolled it back within 40 minutes. Then the review.',
    );
  });

  it('warns at 2:30, and “Cancel” adds nothing', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    fake.elapsedMs = 151_000;

    await answerField();
    await user.click(dictate());
    expect(screen.getByRole('alert')).toHaveTextContent(
      'practice.dictationWarnMessage',
    );
    await user.click(
      screen.getByRole('button', { name: 'practice.cancelButton' }),
    );

    expect(fake.discards).toBe(1);
    expect(gateway.dictatePracticeAnswer).not.toHaveBeenCalled();
    expect(dictate()).toHaveFocus();
  });

  it('asks before leaving the page while it records, then adds nothing', async () => {
    const user = userEvent.setup();
    setUp();

    await answerField();
    await user.click(dictate());
    await user.click(
      screen.getAllByRole('link', { name: 'Technical interview' })[0]!,
    );
    const dialog = screen.getByRole('dialog', {
      name: 'practice.dictationLeaveTitle',
    });
    await user.click(
      within(dialog).getByRole('button', { name: 'mock.stayButton' }),
    );
    expect(screen.getByText('practice.dictationListening')).toBeVisible();

    await user.click(
      screen.getAllByRole('link', { name: 'Technical interview' })[0]!,
    );
    await user.click(screen.getByRole('button', { name: 'mock.leaveButton' }));
    expect(
      await screen.findByText('now at /applications/a1/interviews/i1'),
    ).toBeVisible();
    expect(fake.discards).toBe(1);
  });
});

describe('dictation’s states (Web-X7-Dictation-States)', () => {
  it('nothing heard: nothing is added, and it can be dictated again', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockRejectedValue(
      new ProfileError(ProfileErrorCode.MockNothingHeard),
    );

    const field = await answerField();
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationNothingHeardMessage',
    );
    expect(field).toHaveValue('');
    expect(dictate()).toBeEnabled();
  });

  it('couldn’t turn it into text: “Try again” sends the same recording, “Discard it” drops it', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Unknown),
    );

    await answerField();
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationFailedMessage',
    );
    const again = screen.getByRole('button', { name: 'practice.retryButton' });
    expect(again).toHaveFocus();
    await user.click(again);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationFailedMessage',
    );
    expect(gateway.dictatePracticeAnswer).toHaveBeenCalledTimes(2);
    expect(
      gateway.dictatePracticeAnswer.mock.calls.map(
        ([request]) => request.audio.base64,
      ),
    ).toEqual([btoa('recording 1'), btoa('recording 1')]);

    await user.click(
      screen.getByRole('button', { name: 'practice.discardButton' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(dictate()).toBeEnabled();
  });

  it('today’s dictations used: said before recording, and when the backend refuses', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getDictationsToday.mockResolvedValue(30);
    setUp(gateway);

    await answerField();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationLimitMessage',
    );
    expect(dictate()).toBeDisabled();
    expect(screen.queryByText('practice.dictateNote')).not.toBeInTheDocument();

    // Typing still works
    await user.type(await answerField(), 'Typed.');
    expect(feedbackButton()).toBeEnabled();
  });

  it('today’s limit met as it sends: the recording goes and “Dictate” is off', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockRejectedValue(
      new ProfileError(ProfileErrorCode.DailyLimit),
    );

    await answerField();
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationLimitMessage',
    );
    expect(dictate()).toBeDisabled();
  });

  it('the microphone blocked, or none found: how to put it right, and “Try again”', async () => {
    const user = userEvent.setup();
    setUp();
    const { MicrophoneError } = await import('@/core/audio/recording');
    fake.open.mockRejectedValueOnce(new MicrophoneError('refused'));
    fake.open.mockRejectedValueOnce(new MicrophoneError('missing'));

    await answerField();
    await user.click(dictate());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationRefusedMessage',
    );
    expect(screen.getByText('practice.dictationStillType')).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'practice.retryButton' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'practice.dictationMissingMessage',
    );
    await user.click(
      screen.getByRole('button', { name: 'practice.retryButton' }),
    );
    expect(screen.getByText('practice.dictationListening')).toBeVisible();
  });

  it('a browser that can’t record: “Dictate” off, with where to dictate instead', async () => {
    fake.canRecord = false;
    setUp();

    await answerField();
    expect(dictate()).toBeDisabled();
    expect(screen.getByText('practice.dictationUnsupportedNote')).toBeVisible();
  });

  it('a turn removed meanwhile: the page reads it again', async () => {
    const user = userEvent.setup();
    const { gateway } = setUp();
    gateway.dictatePracticeAnswer.mockRejectedValue(
      new ProfileError(ProfileErrorCode.NotFound),
    );

    await answerField();
    gateway.getPracticeTurn.mockResolvedValue(null);
    await user.click(dictate());
    await user.click(
      screen.getByRole('button', { name: 'practice.dictationStopButton' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'practice.notFoundTitle' }),
    ).toBeVisible();
  });
});
