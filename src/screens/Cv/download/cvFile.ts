// The file of a CV version (research doc 15 Q6, doc 18): made in the browser from the version's
// text (cvVersionText), as PDF or Word (.docx), in one plain layout that tracking systems read
// well (doc 13 question 35): the name, the section headings, the lines, on A4 pages (a UK CV,
// D80). The libraries are loaded only when a file is made, so no page carries them.

/** One piece of the CV's text, as the file lays it out. */
export type CvBlock =
  | { kind: 'name'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'paragraph'; text: string };

const LIST_MARK = /^\s*(?:[-•*▪◦–]\s+)/;

/**
 * The blocks of a CV's text: its first line is the name; a list line is a bullet; a short line
 * that ends no sentence and is followed by more is a section heading; the rest are paragraphs.
 * Empty lines only separate.
 */
export const cvBlocks = (text: string): CvBlock[] => {
  const lines = text.split('\n').map(line => line.trim());
  const blocks: CvBlock[] = [];
  lines.forEach((line, index) => {
    if (!line) {
      return;
    }
    if (blocks.length === 0) {
      blocks.push({ kind: 'name', text: line });
      return;
    }
    if (LIST_MARK.test(line)) {
      blocks.push({ kind: 'bullet', text: line.replace(LIST_MARK, '') });
      return;
    }
    const more = lines.slice(index + 1).some(Boolean);
    const heading =
      more &&
      line.length <= 40 &&
      !/[.,;:!?)]$/.test(line) &&
      !line.includes('·');
    blocks.push({ kind: heading ? 'heading' : 'paragraph', text: line });
  });
  return blocks;
};

/** A file name without the characters file systems refuse. */
export const cvFileName = (parts: string[], extension: 'pdf' | 'docx') =>
  `${parts
    .filter(Boolean)
    .join(' - ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)}.${extension}`;

// ---------- PDF ----------

/** A4 in points, with margins of about 20 mm. */
const PAGE = { width: 595.28, height: 841.89, margin: 56 };
const SIZES = { name: 20, heading: 11.5, text: 10.5 };
const LEADING = 1.4;

export const makePdf = async (blocks: CvBlock[]): Promise<Blob> => {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  type Font = typeof regular;

  // The standard fonts write Western European text only: anything else becomes "?".
  const known = new Map<string, boolean>();
  const writable = (font: Font, text: string) =>
    [...text]
      .map(character => {
        const key = `${font.name}${character}`;
        if (!known.has(key)) {
          try {
            font.widthOfTextAtSize(character, SIZES.text);
            known.set(key, true);
          } catch {
            known.set(key, false);
          }
        }
        return known.get(key) ? character : '?';
      })
      .join('');

  const width = PAGE.width - 2 * PAGE.margin;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - PAGE.margin;
  const room = (height: number) => {
    if (y - height < PAGE.margin) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
  };
  /** Writes a text in lines that fit, from `indent`, and moves down. */
  const write = (text: string, font: Font, size: number, indent = 0) => {
    const words = writable(font, text).split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width - indent) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      lines.push(line);
    }
    for (const part of lines) {
      room(size * LEADING);
      y -= size * LEADING;
      page.drawText(part, {
        x: PAGE.margin + indent,
        y,
        size,
        font,
        color: rgb(0.13, 0.13, 0.13),
      });
    }
  };

  for (const block of blocks) {
    if (block.kind === 'name') {
      write(block.text, bold, SIZES.name);
      y -= 6;
    } else if (block.kind === 'heading') {
      y -= 10;
      room(SIZES.heading * LEADING + 4);
      write(block.text.toUpperCase(), bold, SIZES.heading);
      y -= 3;
      page.drawLine({
        start: { x: PAGE.margin, y: y - 1 },
        end: { x: PAGE.width - PAGE.margin, y: y - 1 },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.8),
      });
      y -= 4;
    } else if (block.kind === 'bullet') {
      room(SIZES.text * LEADING);
      page.drawText('•', {
        x: PAGE.margin + 2,
        y: y - SIZES.text * LEADING,
        size: SIZES.text,
        font: regular,
      });
      write(block.text, regular, SIZES.text, 14);
    } else {
      write(block.text, regular, SIZES.text);
    }
  }
  const bytes = await pdf.save();
  // A copy in an ArrayBuffer of its own, which a Blob takes.
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
};

// ---------- Word ----------

/** A4 in twentieths of a point, with margins of about 20 mm. */
const WORD_PAGE = { width: 11906, height: 16838, margin: 1134 };

export const makeDocx = async (blocks: CvBlock[]): Promise<Blob> => {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } =
    await import('docx');
  const children = blocks.map(block => {
    switch (block.kind) {
      case 'name':
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 160 },
          children: [new TextRun({ text: block.text, bold: true, size: 40 })],
        });
      case 'heading':
        return new Paragraph({
          spacing: { before: 240, after: 80 },
          border: {
            bottom: { style: 'single', size: 4, color: 'BFBFCC', space: 2 },
          },
          children: [
            new TextRun({
              text: block.text.toUpperCase(),
              bold: true,
              size: 23,
            }),
          ],
        });
      case 'bullet':
        return new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: block.text, size: 21 })],
        });
      default:
        return new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: block.text, size: 21 })],
        });
    }
  });
  const document = new Document({
    styles: { default: { document: { run: { font: 'Arial' } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: WORD_PAGE.width, height: WORD_PAGE.height },
            margin: {
              top: WORD_PAGE.margin,
              bottom: WORD_PAGE.margin,
              left: WORD_PAGE.margin,
              right: WORD_PAGE.margin,
            },
          },
        },
        children,
      },
    ],
  });
  return Packer.toBlob(document);
};

/** Gives the browser a file to save, as a link to it would. */
export const saveFile = (blob: Blob, name: string) => {
  const address = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = address;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // After the browser has taken it.
  setTimeout(() => URL.revokeObjectURL(address), 1000);
};
