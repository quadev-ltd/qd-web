import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DownloadButton } from './DownloadButton';

import { CV_TEXT } from '@/testUtil/cvVersionFixtures';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockFile = vi.hoisted(() => ({
  makePdf: vi.fn(),
  makeDocx: vi.fn(),
  saveFile: vi.fn(),
}));
vi.mock('./cvFile', async original => ({
  ...(await original<typeof import('./cvFile')>()),
  ...mockFile,
}));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const pdf = new Blob(['%PDF-'], { type: 'application/pdf' });
const docx = new Blob(['PK'], { type: 'application/zip' });

const setUp = () =>
  renderWithProviders(
    <DownloadButton
      version={{ cv: CV_TEXT, changes: [], questions: [] }}
      fileTitle="Senior Backend Engineer - CV - 14 Oct 2026"
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockFile.makePdf.mockResolvedValue(pdf);
  mockFile.makeDocx.mockResolvedValue(docx);
});

describe('DownloadButton', () => {
  it('makes the PDF from the version’s text and saves it', async () => {
    setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.downloadPdfButton' }),
    );

    expect(mockFile.makePdf).toHaveBeenCalledWith(
      expect.arrayContaining([{ kind: 'name', text: 'Maya Okafor' }]),
    );
    expect(mockFile.saveFile).toHaveBeenCalledExactlyOnceWith(
      pdf,
      'Senior Backend Engineer - CV - 14 Oct 2026.pdf',
    );
  });

  it('offers Word under its arrow', async () => {
    setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.otherFormats' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'cv.downloadWord' }),
    );

    expect(mockFile.saveFile).toHaveBeenCalledExactlyOnceWith(
      docx,
      'Senior Backend Engineer - CV - 14 Oct 2026.docx',
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes its menu with Escape', async () => {
    setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.otherFormats' }),
    );
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('says when the file could not be made', async () => {
    mockFile.makePdf.mockRejectedValue(new Error('no memory'));
    setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.downloadPdfButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cv.downloadFailedMessage',
    );
  });
});
