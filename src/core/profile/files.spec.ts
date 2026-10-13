import {
  formatFileSize,
  PROFILE_UPLOAD_ACCEPT,
  titleFromFileName,
  uploadContentTypeOf,
} from './files';

const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('uploadContentTypeOf', () => {
  it.each([
    ['cv.pdf', 'application/pdf', 'application/pdf'],
    ['cv.docx', DOCX, DOCX],
    ['notes.txt', 'text/plain', 'text/plain'],
    ['notes.txt', 'text/plain;charset=utf-8', 'text/plain'],
    ['notes', 'TEXT/PLAIN', 'text/plain'],
  ])('takes %s declared as %s', (name, type, expected) => {
    expect(uploadContentTypeOf({ name, type })).toBe(expected);
  });

  it.each([
    ['cv.pdf', 'application/pdf'],
    ['CV.PDF', 'application/pdf'],
    ['cv.final.docx', DOCX],
    ['notes.txt', 'text/plain'],
  ])(
    'goes by the extension of %s when the browser names no type',
    (name, expected) => {
      expect(uploadContentTypeOf({ name, type: '' })).toBe(expected);
    },
  );

  it.each([
    ['photo.png', 'image/png'],
    ['cv.doc', 'application/msword'],
    ['cv.pages', ''],
    ['cv', ''],
    ['.pdf', ''],
    // A picture renamed to .pdf is still a picture to the browser.
    ['scan.pdf', 'image/jpeg'],
  ])('does not take %s declared as "%s"', (name, type) => {
    expect(uploadContentTypeOf({ name, type })).toBeUndefined();
  });
});

describe('file helpers', () => {
  it('offers the three types to the file window, by type and by extension', () => {
    expect(PROFILE_UPLOAD_ACCEPT.split(',')).toEqual([
      'application/pdf',
      DOCX,
      'text/plain',
      '.pdf',
      '.docx',
      '.txt',
    ]);
  });

  it.each([
    [0, '0 B'],
    [549, '549 B'],
    [1024, '1 KB'],
    [188_416, '184 KB'],
    [1024 * 1024 - 1, '1024 KB'],
    [1024 * 1024, '1.0 MB'],
    [14.2 * 1024 * 1024, '14.2 MB'],
  ])('writes %d bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });

  it.each([
    ['maya-okafor-cv.pdf', 'maya-okafor-cv'],
    ['Maya Okafor CV 2026.final.docx', 'Maya Okafor CV 2026.final'],
    ['notes', 'notes'],
    ['.hidden', '.hidden'],
    ['  spaced .txt', 'spaced'],
  ])('proposes a title for %s', (name, expected) => {
    expect(titleFromFileName(name)).toBe(expected);
  });
});
