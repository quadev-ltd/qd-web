// The mock interview pages around the interview itself (D100): the setup, Ready with "Before you
// start", a session opened again (Continue, or its end), the end's feedback card, what was said in
// Sessions, and a browser that can't record. The interview's own steps are the controller's spec
// and the browser journeys'.
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';

import MockInterviewScreen from './MockInterviewScreen';
import MockSessionScreen from './MockSessionScreen';
import MockSetupPanel from './MockSetupPanel';

import { type MockSession } from '@/core/profile/mockInterviews';
import {
  applicationFixture,
  interviewFixture,
} from '@/testUtil/applicationFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

/** Where the page went, shown in place of the next one. */
const Location = () => {
  const { pathname, search } = useLocation();
  return <p>now at {`${pathname}${search}`}</p>;
};

const session = (overrides: Partial<MockSession> = {}): MockSession => ({
  id: 's1',
  applicationId: 'a1',
  application: {
    title: 'Senior Backend Engineer',
    company: 'Northwind Logistics',
  },
  interviewId: 'i1',
  interview: { name: 'Technical interview', type: 'technical' },
  way: 'take-turns',
  lengthMinutes: 10,
  voice: 'chirp',
  hintsShown: 'on-request',
  hints: {},
  status: 'ended',
  endReason: 'finished',
  plan: {
    questions: [
      {
        id: 'p1',
        text: 'Tell me about yourself.',
        rephrased: '',
        kind: 'role',
      },
      {
        id: 'p2',
        text: 'An incident you led?',
        rephrased: '',
        kind: 'behavioural',
      },
    ],
  },
  turns: [
    {
      id: 't1',
      kind: 'planned',
      planId: 'p1',
      question: 'Tell me about yourself.',
      status: 'answered',
      answer: {
        transcript: 'I build payment systems.',
        spokenMs: 9_000,
        words: 4,
      },
      repeats: 0,
      askedAt: 1,
      answeredAt: 2,
    },
    {
      id: 't2',
      kind: 'follow-up',
      planId: 'p1',
      question: 'What was your part?',
      status: 'answered',
      answer: { transcript: 'I led the move.', spokenMs: 5_000, words: 4 },
      repeats: 0,
      askedAt: 3,
      answeredAt: 4,
    },
    {
      id: 't3',
      kind: 'planned',
      planId: 'p2',
      question: 'An incident you led?',
      status: 'skipped',
      repeats: 0,
      askedAt: 5,
      answeredAt: null,
    },
  ],
  startedAt: Date.parse('2026-11-09T18:20:00Z'),
  endedAt: Date.parse('2026-11-09T18:29:00Z'),
  pausedAt: null,
  pausedMs: 0,
  createdAt: Date.parse('2026-11-09T18:20:00Z'),
  updatedAt: Date.parse('2026-11-09T18:29:00Z'),
  ...overrides,
});

/** A browser that can record, as far as the page asks. */
const recordingBrowser = () => {
  vi.stubGlobal('MediaRecorder', class {});
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(), enumerateDevices: vi.fn(() => []) },
  });
};

const renderMock = (route: string, gateway = createMockProfileGateway()) => {
  gateway.getInterviews.mockResolvedValue([interviewFixture()]);
  return renderProfilePage(<></>, {
    gateway,
    route,
    flags: { mockInterview: true },
    applications: {
      uid: 'uid-1',
      status: 'loaded',
      applications: [applicationFixture()],
      profileRevision: 3,
    },
    routes: [
      {
        path: '/applications/:applicationId/interviews/:interviewId/mock/:sessionId?',
        element: <MockInterviewScreen />,
      },
      { path: '*', element: <Location /> },
    ],
  });
};

beforeEach(() => {
  recordingBrowser();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('setting up a mock interview (Web-X6-Setup)', () => {
  it('opens the mock interview with the length, the voice and the hints chosen', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getMockInterviewsToday.mockResolvedValue(1);
    renderProfilePage(
      <>
        <MockSetupPanel
          applicationId="a1"
          interviewId="i1"
          description="Technical interview"
          onClose={vi.fn()}
        />
        <Location />
      </>,
      { gateway, route: '/applications/a1/interviews/i1' },
    );

    const panel = screen.getByRole('dialog', { name: 'mock.setupTitle' });
    expect(panel).toHaveTextContent('mock.wayTakeTurns');
    expect(await within(panel).findByText('mock.left')).toBeVisible();
    await user.click(within(panel).getAllByRole('radio')[1]!);
    await user.click(within(panel).getAllByRole('radio')[3]!);
    // Hints: "When I ask" first chosen, then "After I answer"
    expect(
      within(panel).getByRole('radio', { name: 'mock.hintsOnRequest' }),
    ).toBeChecked();
    await user.click(
      within(panel).getByRole('radio', { name: 'mock.hintsAfterAnswer' }),
    );
    await user.click(
      within(panel).getByRole('button', { name: 'mock.continueButton' }),
    );

    expect(
      screen.getByText(
        'now at /applications/a1/interviews/i1/mock?length=20&voice=chirp&hints=after-answer',
      ),
    ).toBeInTheDocument();
  });

  it('can’t continue with none left today', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockInterviewsToday.mockResolvedValue(3);
    renderProfilePage(
      <MockSetupPanel
        applicationId="a1"
        interviewId="i1"
        description="Technical interview"
        onClose={vi.fn()}
      />,
      { gateway, route: '/applications/a1/interviews/i1' },
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'mock.limitMessage',
    );
    expect(
      screen.getByRole('button', { name: 'mock.continueButton' }),
    ).toBeDisabled();
  });
});

describe('a mock interview’s page (Web-X6-Ready, -End, -CantRecord)', () => {
  it('Ready: the choices from the address, "Before you start" until the first, and the start', async () => {
    renderMock(
      '/applications/a1/interviews/i1/mock?length=20&voice=chirp&hints=after-answer',
    );

    const summary = await screen.findByRole('region', {
      name: 'mock.summaryTitle',
    });
    expect(summary).toHaveTextContent('mock.lengthSummary20');
    expect(summary).toHaveTextContent('mock.voiceChirp');
    expect(summary).toHaveTextContent('mock.hintsSummaryAfterAnswer');
    expect(
      await screen.findByRole('region', { name: 'mock.noticeTitle' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'mock.startButton' }),
    ).toBeEnabled();
  });

  it('Ready: no notice once the account has had one; "Change" goes back to the setup', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.countMockSessions.mockResolvedValue(2);
    renderMock(
      '/applications/a1/interviews/i1/mock?length=10&voice=gemini',
      gateway,
    );

    await user.click(
      await screen.findByRole('button', { name: 'mock.changeButton' }),
    );
    expect(
      screen.getByText(
        'now at /applications/a1/interviews/i1?length=10&voice=gemini&hints=on-request&mock=setup',
      ),
    ).toBeInTheDocument();
    expect(gateway.countMockSessions).toHaveBeenCalled();
  });

  it('a session still going, opened again: "Continue the interview"', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSession.mockResolvedValue(
      session({
        status: 'active',
        endReason: undefined,
        endedAt: null,
        updatedAt: Date.now(),
      }),
    );
    renderMock('/applications/a1/interviews/i1/mock/s1', gateway);

    expect(
      await screen.findByRole('button', {
        name: 'mock.continueInterviewButton',
      }),
    ).toBeEnabled();
    expect(
      screen.queryByRole('region', { name: 'mock.noticeTitle' }),
    ).not.toBeInTheDocument();
    expect(gateway.getMockSession).toHaveBeenCalledWith('uid-1', 's1');
  });

  it('an ended one: how it ended, and the feedback card that sends what was chosen', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getMockSession.mockResolvedValue(session({ endReason: 'failed' }));
    renderMock('/applications/a1/interviews/i1/mock/s1', gateway);

    expect(
      await screen.findByRole('heading', { name: 'mock.endFailedTitle' }),
    ).toBeVisible();
    const card = screen.getByRole('region', { name: 'mock.feedbackTitle' });
    const send = within(card).getByRole('button', { name: 'mock.sendButton' });
    expect(send).toBeDisabled();
    await user.click(within(card).getByRole('radio', { name: '4' }));
    await user.click(
      within(card).getByRole('radio', { name: 'mock.waitBitLong' }),
    );
    await user.type(
      within(card).getByRole('textbox', { name: 'mock.commentLabel' }),
      ' The wait felt long. ',
    );
    await user.click(send);

    expect(gateway.sendMockFeedback).toHaveBeenCalledWith({
      sessionId: 's1',
      feel: 4,
      wait: 'a-bit-long',
      comment: 'The wait felt long.',
    });
    expect(await within(card).findByText('mock.feedbackThanks')).toBeVisible();
  });

  it('an active one idle for 30 minutes is shown as not finished', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSession.mockResolvedValue(
      session({
        status: 'active',
        endReason: undefined,
        endedAt: null,
        updatedAt: Date.now() - 31 * 60_000,
      }),
    );
    renderMock('/applications/a1/interviews/i1/mock/s1', gateway);

    expect(
      await screen.findByRole('heading', { name: 'mock.endIdleTitle' }),
    ).toBeVisible();
  });

  it('a browser that can’t record: open the page in one that can', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('MediaRecorder', undefined);
    renderMock('/applications/a1/interviews/i1/mock?length=10&voice=gemini');

    expect(
      await screen.findByRole('heading', { name: 'mock.cantRecordTitle' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'mock.copyAddressButton' }),
    ).toBeVisible();
  });

  it('says it isn’t available without the flag', async () => {
    const gateway = createMockProfileGateway();
    renderProfilePage(<></>, {
      gateway,
      route: '/applications/a1/interviews/i1/mock',
      routes: [
        {
          path: '/applications/:applicationId/interviews/:interviewId/mock/:sessionId?',
          element: <MockInterviewScreen />,
        },
      ],
    });

    expect(await screen.findByText('access.notAvailableChip')).toBeVisible();
  });
});

describe('a mock interview in Sessions (Web-R2-Mock)', () => {
  const renderSession = (gateway = createMockProfileGateway()) =>
    renderProfilePage(<></>, {
      gateway,
      route: '/sessions/mock/s1',
      flags: { mockInterview: true },
      routes: [
        { path: '/sessions/mock/:sessionId', element: <MockSessionScreen /> },
        { path: '*', element: <Location /> },
      ],
    });

  it('shows the way, the length used, the voice and the rating, then what was said', async () => {
    const gateway = createMockProfileGateway();
    gateway.getMockSession.mockResolvedValue(
      session({ feedback: { feel: 4, wait: 'a-bit-long' } }),
    );
    renderSession(gateway);

    const said = await screen.findByRole('region', { name: 'mock.saidTitle' });
    const turns = within(said).getAllByRole('listitem');
    expect(turns).toHaveLength(3);
    expect(turns[0]).toHaveTextContent('mock.questionChip');
    expect(turns[0]).toHaveTextContent('I build payment systems.');
    expect(turns[1]).toHaveTextContent('mock.followUpChip');
    expect(turns[2]).toHaveTextContent('mock.skippedChip');
    expect(screen.getByText('mock.voiceChirp')).toBeVisible();
    expect(screen.getByText('mock.rating')).toBeVisible();
  });

  it('a question said differently: the wording heard last, marked, with the first one under it', async () => {
    const gateway = createMockProfileGateway();
    const said = session();
    gateway.getMockSession.mockResolvedValue({
      ...said,
      turns: said.turns.map(turn =>
        turn.id === 't2' ? { ...turn, rephrased: 'What came of it?' } : turn,
      ),
    });
    renderSession(gateway);

    const region = await screen.findByRole('region', {
      name: 'mock.saidTitle',
    });
    const turns = within(region).getAllByRole('listitem');
    expect(turns[1]).toHaveTextContent('mock.saidDifferentlyChip');
    expect(turns[1]).toHaveTextContent('What came of it?');
    expect(turns[1]).toHaveTextContent('mock.firstAsked');
    expect(turns[0]).not.toHaveTextContent('mock.saidDifferentlyChip');
    expect(turns[0]).not.toHaveTextContent('mock.firstAsked');
  });

  it('removes it, asked first, and goes back to Sessions', async () => {
    const user = userEvent.setup();
    const gateway = createMockProfileGateway();
    gateway.getMockSession.mockResolvedValue(session());
    renderSession(gateway);

    await user.click(
      await screen.findByRole('button', { name: 'mock.removeLink' }),
    );
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'mock.removeDialogTitle' }),
      ).getByRole('button', { name: 'mock.removeConfirmButton' }),
    );

    expect(gateway.removeMockSession).toHaveBeenCalledWith('s1');
    expect(await screen.findByText('now at /sessions')).toBeInTheDocument();
  });
});
