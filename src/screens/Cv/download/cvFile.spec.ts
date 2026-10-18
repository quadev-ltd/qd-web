import { cvBlocks, cvFileName, makeDocx, makePdf } from './cvFile';

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
  it('makes a PDF, writing a character the fonts lack as "?"', async () => {
    const bytes = await bytesOf(
      await makePdf([
        ...cvBlocks(CV),
        { kind: 'paragraph', text: 'Fluent in 中文' },
      ]),
    );

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  });

  it('makes a Word document', async () => {
    const bytes = await bytesOf(await makeDocx(cvBlocks(CV)));

    // A .docx is a zip file.
    expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b]);
  });
});
