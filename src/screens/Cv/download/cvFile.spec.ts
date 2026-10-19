import { readFileSync } from 'node:fs';

import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

import {
  cvBlocks,
  cvFileName,
  makeDocx,
  makePdf,
  writtenBlocks,
} from './cvFile';

import {
  type CvDocument,
  cvDocumentPages,
  type CvLine,
} from '@/core/profile/cvDocument';

/** The fonts the site serves, read from the repository as a browser would fetch them. */
const loadFonts = vi.fn(async (): Promise<[ArrayBuffer, ArrayBuffer]> => {
  const read = (name: string) => {
    const file = readFileSync(`public/fonts/${name}`);
    return file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
  };
  return [read('NotoSans-Regular.ttf'), read('NotoSans-Bold.ttf')];
});

/** The names of the fonts a PDF uses. */
const fontsOf = async (bytes: Uint8Array) => {
  const pdf = await PDFDocument.load(bytes);
  return pdf.context
    .enumerateIndirectObjects()
    .flatMap(([, object]) =>
      object instanceof PDFDict &&
      object.get(PDFName.of('Type')) === PDFName.of('Font')
        ? [String(object.get(PDFName.of('BaseFont')))]
        : [],
    );
};

const CV = [
  'Maya Okafor',
  'London, UK · maya.okafor@example.com',
  '',
  'Experience',
  'Fenwick Pay · Senior Backend Engineer · 2021 – 2026',
  '- Built the reconciliation service that matches two million card transactions a day.',
  '• Led the move of the ledger to event sourcing.',
  'Education',
  'BSc Computer Science, Ashdown University, 2015.',
].join('\n');

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe('cvBlocks', () => {
  it('reads the name, the section headings, the bullets and the lines of a CV’s text', () => {
    expect(cvBlocks(CV)).toEqual([
      { kind: 'name', text: 'Maya Okafor' },
      { kind: 'paragraph', text: 'London, UK · maya.okafor@example.com' },
      { kind: 'heading', text: 'Experience' },
      {
        kind: 'paragraph',
        text: 'Fenwick Pay · Senior Backend Engineer · 2021 – 2026',
      },
      {
        kind: 'bullet',
        text: 'Built the reconciliation service that matches two million card transactions a day.',
      },
      { kind: 'bullet', text: 'Led the move of the ledger to event sourcing.' },
      { kind: 'heading', text: 'Education' },
      {
        kind: 'paragraph',
        text: 'BSc Computer Science, Ashdown University, 2015.',
      },
    ]);
  });

  it('takes a short last line for a line, not a heading', () => {
    expect(cvBlocks('Maya Okafor\nReferences on request').at(-1)).toEqual({
      kind: 'paragraph',
      text: 'References on request',
    });
  });
});

describe('cvFileName', () => {
  it('names the file without what file systems refuse', () => {
    expect(
      cvFileName(['Senior Backend Engineer · Northwind: UK/EU - CV'], 'pdf'),
    ).toBe('Senior Backend Engineer · Northwind UK EU - CV.pdf');
  });
});

describe('the files', () => {
  beforeEach(() => {
    loadFonts.mockClear();
  });

  it('makes a PDF in the built-in fonts when every letter is Western European', async () => {
    const bytes = await bytesOf(
      await makePdf(
        [
          ...cvBlocks(CV),
          { kind: 'paragraph', text: 'Café, Zürich, São Paulo' },
        ],
        { loadFonts },
      ),
    );

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(loadFonts).not.toHaveBeenCalled();
    expect((await fontsOf(bytes)).sort()).toEqual([
      '/Helvetica',
      '/Helvetica-Bold',
    ]);
  });

  it('embeds Noto Sans for other letters, only those used, and writes what it lacks as "?"', async () => {
    const bytes = await bytesOf(
      await makePdf(
        [
          { kind: 'name', text: 'Łukasz Dvořák' },
          ...cvBlocks(CV).slice(1),
          { kind: 'paragraph', text: 'Fluent in Ελληνικά, русский and 中文' },
        ],
        { loadFonts },
      ),
    );

    expect(loadFonts).toHaveBeenCalledOnce();
    const fonts = await fontsOf(bytes);
    // pdf-lib names a subset after its font: "/NotoSans-Regular-2708"
    expect(fonts.map(name => name.replace(/-\d+$/, ''))).toEqual(
      expect.arrayContaining(['/NotoSans-Regular', '/NotoSans-Bold']),
    );
    expect(fonts.some(name => name.startsWith('/Helvetica'))).toBe(false);
    // A subset: far smaller than the two fonts it comes from (1.2 MB)
    expect(bytes.length).toBeLessThan(120_000);
  });

  it('makes a Word document', async () => {
    const bytes = await bytesOf(await makeDocx(cvBlocks(CV)));

    // A .docx is a zip file.
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  });
});

describe('the layout, against the page estimate (doc 19 §3.4)', () => {
  const words = (count: number, seed: number) =>
    `${Array.from(
      { length: count },
      (_, index) =>
        [
          'Led',
          'the',
          'ledger',
          'migration',
          'for',
          'nine',
          'engineers',
          'in',
          'Go',
        ][(index + seed) % 9],
    ).join(' ')}.`;
  /** A CV of `roles` roles of four bullets of 22 words, with a profile, skills and education. */
  const cvOf = (roles: number): CvDocument => {
    let id = 0;
    const line = (count: number): CvLine => {
      id += 1;
      return {
        id: `l${id}`,
        text: words(count, id),
        sources: [],
        state: 'written',
        proposed: '',
      };
    };
    const heading = {
      title: 'Senior Backend Engineer',
      organisation: 'Fenwick Pay',
      location: 'London',
      start: '2021',
      end: '2026',
    };
    return {
      summary: [line(45)],
      experience: Array.from({ length: roles }, (_, index) => ({
        id: `e${index + 1}`,
        ...heading,
        sources: [],
        state: 'written' as const,
        proposedFields: heading,
        bullets: [line(22), line(22), line(22), line(22)],
      })),
      projects: [],
      skills: [{ ...line(12), label: 'Languages' }],
      education: [line(8)],
      certifications: [],
      languages: [line(3)],
    };
  };
  const pagesOf = async (document: CvDocument) => {
    const blob = await makePdf(
      writtenBlocks(document, {
        name: 'Maya Okafor',
        headline: 'Senior Backend Engineer',
        email: 'maya.okafor@example.com',
        phone: '07700 900123',
        location: 'London, UK',
      }),
    );
    return (await PDFDocument.load(await bytesOf(blob))).getPageCount();
  };

  it('downloads "about 1 page" as one page and "about 2 pages" as two', async () => {
    const one = cvOf(4);
    const two = cvOf(9);
    expect(cvDocumentPages(one)).toBeCloseTo(1, 0);
    expect(cvDocumentPages(two)).toBeCloseTo(2, 0);

    expect(await pagesOf(one)).toBe(1);
    expect(await pagesOf(two)).toBe(2);
  });
});
