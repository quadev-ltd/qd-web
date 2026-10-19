// The file of a CV version (research doc 15 Q6, doc 18, doc 19 §3.5): made in the browser, as
// PDF or Word (.docx), in one plain layout that tracking systems read well (doc 13 question 35):
// the name, the section headings, the lines, on A4 pages (a UK CV, D80). A written version is
// laid out from its structure (writtenBlocks); an edit version from its text, its headings
// guessed (cvBlocks). The libraries are loaded only when a file is made, so no page carries them.
import {
  CV_HEADER_SEPARATOR,
  CV_SECTION_HEADINGS,
  CV_SECTION_KEYS,
  type CvDocument,
  type CvHeaderDetails,
  type CvLine,
  cvLineText,
  cvLinkLabel,
  cvRightToWorkLine,
} from '@/core/profile/cvDocument';

/** One piece of the CV's text, as the file lays it out. */
export type CvBlock =
  | { kind: 'name'; text: string }
  /** The line under the name ("Staff Engineer"), set apart from the contact lines. */
  | { kind: 'headline'; text: string }
  /** A line of the header under the headline: contact, links, right to work. */
  | { kind: 'contact'; text: string }
  | { kind: 'heading'; text: string }
  /** A role's or project's heading, its dates on the right. */
  | { kind: 'entry'; text: string; when: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'paragraph'; text: string };

const shown = (lines: CvLine[]) =>
  lines.filter(({ state }) => state !== 'removed');

/** The longest contact line the right to work is added to: about one line at 9.5 pt. */
const CONTACT_LINE_CHARS = 100;

/**
 * The blocks of a written CV, from its structure: nothing is guessed. The header is the CV's
 * details as they are now (cvHeaderLines), then each section with something in it, in the fixed
 * order. The words are cvDocumentText's, laid out.
 */
export const writtenBlocks = (
  document: CvDocument,
  details?: CvHeaderDetails | null,
): CvBlock[] => {
  const blocks: CvBlock[] = [];
  // The header's words are cvHeaderLines'; the headline set apart, and the right to work on the
  // contact line when the two still make a short line.
  const join = (parts: (string | undefined)[]) =>
    parts
      .map(part => part?.trim() ?? '')
      .filter(Boolean)
      .join(CV_HEADER_SEPARATOR);
  const name = details?.name?.trim();
  const headline = details?.headline?.trim();
  const contact = join([details?.location, details?.phone, details?.email]);
  const links = join((details?.links ?? []).map(cvLinkLabel));
  const rightToWork = cvRightToWorkLine(details?.rightToWork);
  const together = join([contact, rightToWork]);
  const joined =
    Boolean(contact && rightToWork) && together.length <= CONTACT_LINE_CHARS;
  if (name) {
    blocks.push({ kind: 'name', text: name });
  }
  if (headline) {
    blocks.push({ kind: 'headline', text: headline });
  }
  for (const line of [joined ? together : contact, links]) {
    if (line) {
      blocks.push({ kind: 'contact', text: line });
    }
  }
  if (rightToWork && !joined) {
    blocks.push({ kind: 'contact', text: rightToWork });
  }
  for (const key of CV_SECTION_KEYS) {
    const section: CvBlock[] = [];
    if (key === 'summary') {
      const lines = shown(document.summary);
      if (lines.length > 0) {
        section.push({
          kind: 'paragraph',
          text: lines.map(cvLineText).join(' '),
        });
      }
    } else if (key === 'experience' || key === 'projects') {
      for (const entry of document[key]) {
        if (entry.state === 'removed') {
          continue;
        }
        section.push({
          kind: 'entry',
          text: [entry.title, entry.organisation, entry.location]
            .map(part => part.trim())
            .filter(Boolean)
            .join(', '),
          when: [entry.start, entry.end]
            .map(part => part.trim())
            .filter(Boolean)
            .join(' – '),
        });
        for (const line of shown(entry.bullets)) {
          section.push({ kind: 'bullet', text: line.text });
        }
      }
    } else {
      for (const line of shown(document[key])) {
        section.push({ kind: 'paragraph', text: cvLineText(line) });
      }
    }
    if (section.length > 0) {
      blocks.push(
        { kind: 'heading', text: CV_SECTION_HEADINGS[key] },
        ...section,
      );
    }
  }
  return blocks;
};

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

/**
 * A4 in points, with margins of about 14 mm, at 10 pt with single line spacing: a page holds the
 * CV_WORDS_PER_PAGE (500) words the length check counts (doc 19 §3.4), headings and spacing
 * included, so "about 2 pages" downloads as 2. Measured: an estimate up to 1.1 fills one page, up
 * to 2.2 two (cvFile.spec.ts).
 */
const PAGE = { width: 595.28, height: 841.89, margin: 40 };
const SIZES = { name: 18, headline: 12, heading: 11, text: 10, contact: 9.5 };
const LEADING = 1.2;
/** Before a role's heading: half a line more than between its bullets. */
const ENTRY_GAP = 6;

/** Noto Sans (SIL Open Font License, public/fonts/OFL.txt): Latin, Greek and Cyrillic letters. */
export const UNICODE_FONTS = {
  regular: '/fonts/NotoSans-Regular.ttf',
  bold: '/fonts/NotoSans-Bold.ttf',
} as const;

/** Reads the two fonts from the site, as they are needed. */
const fetchFonts = async (): Promise<[ArrayBuffer, ArrayBuffer]> => {
  const read = async (path: string) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(
        `The font ${path} could not be read (${response.status})`,
      );
    }
    return response.arrayBuffer();
  };
  return Promise.all([read(UNICODE_FONTS.regular), read(UNICODE_FONTS.bold)]);
};

export interface MakePdfOptions {
  /** Where the Unicode fonts come from; the site's own files by default. */
  loadFonts?: () => Promise<[ArrayBuffer, ArrayBuffer]>;
}

export const makePdf = async (
  blocks: CvBlock[],
  { loadFonts = fetchFonts }: MakePdfOptions = {},
): Promise<Blob> => {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdf = await PDFDocument.create();

  // The standard fonts write Western European text only. A CV with any other letter ("Łukasz",
  // "Dvořák") is written in Noto Sans, of which only the letters used go into the file. The
  // letters are checked against a document of their own, so the file carries one set of fonts.
  const probe = await (
    await PDFDocument.create()
  ).embedFont(StandardFonts.Helvetica);
  const fits = (character: string) => {
    try {
      probe.widthOfTextAtSize(character, SIZES.text);
      return true;
    } catch {
      return false;
    }
  };
  const characters = new Set(
    blocks.flatMap(block => [
      ...block.text,
      ...(block.kind === 'entry' ? block.when : ''),
    ]),
  );
  const unicode = [...characters].some(
    character => !/\s/.test(character) && !fits(character),
  );
  let regular;
  let bold;
  if (unicode) {
    const [{ default: fontkit }, [regularBytes, boldBytes]] = await Promise.all(
      [import('@pdf-lib/fontkit'), loadFonts()],
    );
    pdf.registerFontkit(fontkit);
    // As bytes of this page's own kind, wherever they were read.
    regular = await pdf.embedFont(new Uint8Array(regularBytes), {
      subset: true,
    });
    bold = await pdf.embedFont(new Uint8Array(boldBytes), { subset: true });
  } else {
    regular = await pdf.embedFont(StandardFonts.Helvetica);
    bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  type Font = typeof regular;

  // What a font cannot write (a script Noto Sans doesn't cover) becomes "?".
  const known = new Map<string, boolean>();
  const writable = (font: Font, text: string) =>
    [...text]
      .map(character => {
        const key = `${font.name}${character}`;
        if (!known.has(key)) {
          known.set(
            key,
            /\s/.test(character) ||
              font.getCharacterSet().includes(character.codePointAt(0) ?? -1),
          );
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
  const ink = rgb(0.13, 0.13, 0.13);
  const muted = rgb(0.3, 0.3, 0.35);
  const write = (
    text: string,
    font: Font,
    size: number,
    indent = 0,
    color = ink,
  ) => {
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
        color,
      });
    }
  };

  for (const block of blocks) {
    if (block.kind === 'name') {
      write(block.text, bold, SIZES.name);
      y -= 2;
    } else if (block.kind === 'headline') {
      write(block.text, regular, SIZES.headline);
      y -= 2;
    } else if (block.kind === 'contact') {
      write(block.text, regular, SIZES.contact, 0, muted);
    } else if (block.kind === 'entry') {
      // More room before a role than between its bullets, and never alone at a page's foot.
      y -= ENTRY_GAP;
      room(SIZES.text * LEADING * 2);
      const when = writable(regular, block.when);
      const whenWidth = when ? regular.widthOfTextAtSize(when, SIZES.text) : 0;
      const what = writable(bold, block.text);
      // The dates on the right of the heading's line, when both fit; under it otherwise.
      if (
        when &&
        bold.widthOfTextAtSize(what, SIZES.text) + whenWidth + 16 <= width
      ) {
        room(SIZES.text * LEADING);
        write(what, bold, SIZES.text);
        page.drawText(when, {
          x: PAGE.width - PAGE.margin - whenWidth,
          y,
          size: SIZES.text,
          font: regular,
          color: muted,
        });
      } else {
        if (what) {
          write(what, bold, SIZES.text);
        }
        if (when) {
          write(when, regular, SIZES.text);
        }
      }
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

/** A4 in twentieths of a point, with margins of about 14 mm, as the PDF. */
const WORD_PAGE = { width: 11906, height: 16838, margin: 800 };
/** The PDF's sizes in half-points, as Word counts them. */
const WORD_SIZES = {
  name: 36,
  headline: 24,
  heading: 22,
  text: 20,
  contact: 19,
};

export const makeDocx = async (blocks: CvBlock[]): Promise<Blob> => {
  const { AlignmentType, Document, Packer, Paragraph, TabStopType, TextRun } =
    await import('docx');
  const text = WORD_SIZES.text;
  const children = blocks.map(block => {
    switch (block.kind) {
      case 'name':
        return new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: block.text,
              bold: true,
              size: WORD_SIZES.name,
            }),
          ],
        });
      case 'headline':
        return new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: block.text, size: WORD_SIZES.headline }),
          ],
        });
      case 'contact':
        return new Paragraph({
          spacing: { after: 20 },
          children: [
            new TextRun({
              text: block.text,
              size: WORD_SIZES.contact,
              color: '4D4D59',
            }),
          ],
        });
      case 'heading':
        return new Paragraph({
          spacing: { before: 200, after: 60 },
          border: {
            bottom: { style: 'single', size: 4, color: 'BFBFCC', space: 2 },
          },
          children: [
            new TextRun({
              text: block.text.toUpperCase(),
              bold: true,
              size: WORD_SIZES.heading,
            }),
          ],
        });
      case 'entry':
        // The dates at a right tab stop on the heading's line.
        return new Paragraph({
          // Half a line more before a role than between its bullets, kept with its first one.
          spacing: { before: 120, after: 20 },
          keepNext: true,
          tabStops: [
            {
              type: TabStopType.RIGHT,
              position: WORD_PAGE.width - 2 * WORD_PAGE.margin,
            },
          ],
          children: [
            new TextRun({ text: block.text, bold: true, size: text }),
            ...(block.when
              ? [new TextRun({ text: `\t${block.when}`, size: text })]
              : []),
          ],
        });
      case 'bullet':
        return new Paragraph({
          bullet: { level: 0 },
          children: [new TextRun({ text: block.text, size: text })],
        });
      default:
        return new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: block.text, size: text })],
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
