import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ResourceTextCard } from './ResourceTextCard';

import { type ProfileResourceText } from '@/core/profile/contract';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { renderProfilePage } from '@/testUtil/renderProfilePage';

const mockLogger = vi.hoisted(() => ({
  logError: vi.fn(),
  logMessage: vi.fn(),
}));
vi.mock('@/core/logger', () => ({ default: vi.fn(() => mockLogger) }));

const TAKEN = Date.parse('2026-10-11T09:30:00Z');

const kept = (overrides: Partial<ProfileResourceText> = {}) => ({
  text: 'The load test failed a week before launch.',
  kind: 'note' as const,
  format: 'text' as const,
  takenAt: TAKEN,
  chars: 42,
  truncated: false,
  ...overrides,
});

const setUp = (
  resource: { source: 'text' | 'file' | 'link'; textAt?: number | null },
  gateway = createMockProfileGateway(),
) =>
  renderProfilePage(<ResourceTextCard resource={{ id: 'r1', ...resource }} />, {
    gateway,
    interviewProfile: { uid: 'uid-1', status: 'loaded' },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ResourceTextCard', () => {
  it('shows nothing, and reads nothing, for a resource without a text', () => {
    const gateway = createMockProfileGateway();
    setUp({ source: 'link' }, gateway);

    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(gateway.getResourceText).not.toHaveBeenCalled();
  });

  it('shows a note as it was added, after reading its one document', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText.mockResolvedValue(kept());
    setUp({ source: 'text', textAt: TAKEN }, gateway);

    const card = screen.getByRole('region', { name: 'resource.noteTextTitle' });
    expect(card).toHaveTextContent('resource.noteTextMeta');
    expect(
      await screen.findByText('The load test failed a week before launch.'),
    ).toBeInTheDocument();
    expect(gateway.getResourceText).toHaveBeenCalledExactlyOnceWith(
      'uid-1',
      'r1',
    );
  });

  it.each([
    ['pdf', 'resource.pdfTextMeta'],
    ['docx', 'resource.docxTextMeta'],
    ['text', 'resource.plainTextMeta'],
  ] as const)(
    'says where the text of a file came from (%s)',
    async (format, meta) => {
      const gateway = createMockProfileGateway();
      gateway.getResourceText.mockResolvedValue(kept({ kind: 'file', format }));
      setUp({ source: 'file', textAt: TAKEN }, gateway);

      const card = screen.getByRole('region', {
        name: 'resource.fileTextTitle',
      });
      await waitFor(() => expect(card).toHaveTextContent(meta));
    },
  );

  it('shows the copy of a link’s page with the day it was taken', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText.mockResolvedValue(
      kept({
        text: 'Moving a ledger to event sourcing',
        kind: 'page',
        format: 'page',
      }),
    );
    setUp({ source: 'link', textAt: TAKEN }, gateway);

    const card = screen.getByRole('region', { name: 'resource.pageTextTitle' });
    expect(card).toHaveTextContent('resource.pageTextMeta');
    expect(
      await screen.findByText('Moving a ledger to event sourcing'),
    ).toBeInTheDocument();
  });

  it('says when a page’s copy was cut, at its own length', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText.mockResolvedValue(
      kept({ kind: 'page', format: 'page', truncated: true }),
    );
    setUp({ source: 'link', textAt: TAKEN }, gateway);

    expect(
      await screen.findByText(/resource\.pageTextTruncated/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/resource\.textTruncated/),
    ).not.toBeInTheDocument();
  });

  it('says when a long text was cut', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText.mockResolvedValue(
      kept({ kind: 'file', format: 'pdf', truncated: true }),
    );
    setUp({ source: 'file', textAt: TAKEN }, gateway);

    expect(
      await screen.findByText(/resource\.textTruncated/),
    ).toBeInTheDocument();
  });

  it('shows nothing when the text turns out to be gone', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText.mockResolvedValue(null);
    setUp({ source: 'file', textAt: TAKEN }, gateway);

    await waitFor(() =>
      expect(screen.queryByRole('region')).not.toBeInTheDocument(),
    );
  });

  it('says it could not be read, logs the code only, and reads it again on "Try again"', async () => {
    const gateway = createMockProfileGateway();
    gateway.getResourceText
      .mockRejectedValueOnce(new ProfileError(ProfileErrorCode.Network))
      .mockResolvedValueOnce(kept());
    setUp({ source: 'text', textAt: TAKEN }, gateway);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'resource.textLoadError',
    );
    expect(mockLogger.logMessage).toHaveBeenCalledWith(
      'getResourceText failed: code=profile/network uid=uid-1',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'resource.textRetryButton' }),
    );
    expect(
      await screen.findByText('The load test failed a week before launch.'),
    ).toBeInTheDocument();
  });
});
