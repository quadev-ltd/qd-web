import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DownloadButton } from './DownloadButton';

import { type CvVersion } from '@/core/profile/cvVersions';
import {
  cvDetailsFixture,
  cvVersionFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

const mockFile = vi.hoisted(() => ({
  makePdf: vi.fn(),
  makeDocx: vi.fn(),
  saveFile: vi.fn(),
}));
vi.mock('./cvFile', async original => ({
  ...(await original<object>()),
  ...mockFile,
}));
vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const pdf = new Blob(['%PDF-'], { type: 'application/pdf' });
const docx = new Blob(['PK'], { type: 'application/zip' });

const setUp = (
  version: CvVersion = cvVersionFixture({ changes: [], questions: [] }),
) =>
  renderWithProviders(
    <DownloadButton
      version={version}
      fileTitle="Senior Backend Engineer - CV - 14 Oct 2026"
    />,
    {
      cvVersions: {
        uid: 'uid-1',
        detailsStatus: 'loaded',
        details: cvDetailsFixture(),
      },
    },
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

  it('lays a written CV out from its structure, its header from the CV details', async () => {
    setUp(writtenVersionFixture());

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.downloadPdfButton' }),
    );

    const [blocks] = mockFile.makePdf.mock.calls[0];
    expect(blocks.slice(0, 2)).toEqual([
      { kind: 'name', text: 'Maya Okafor' },
      { kind: 'contact', text: 'Senior Backend Engineer' },
    ]);
    expect(blocks).toContainEqual({
      kind: 'contact',
      text: 'Right to work in the UK: British citizen',
    });
    expect(blocks).toContainEqual({
      kind: 'entry',
      text: 'Senior Backend Engineer, Fenwick Pay, London',
      when: '2021 – 2026',
    });
    expect(blocks).toContainEqual({ kind: 'heading', text: 'Skills' });
    expect(blocks).toContainEqual({
      kind: 'paragraph',
      text: 'Languages and data: Go · PostgreSQL · Java',
    });
  });
});
