import { type TFunction } from 'i18next';

import { aboutPages, isLongerThanAsked, sourceLine } from './writtenMeta';

import { writtenDocumentFixture } from '@/testUtil/cvVersionFixtures';
import { itemFixture, resourceFixture } from '@/testUtil/profileFixtures';

/** Says the key with what it was given, so the specs see the words put in. */
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key} ${JSON.stringify(options)}` : key) as unknown as TFunction;

const context = {
  items: new Map([
    ['i1', itemFixture({ id: 'i1', resourceId: 'r1' })],
    ['i2', itemFixture({ id: 'i2', resourceId: 'r2' })],
    ['i3', itemFixture({ id: 'i3', resourceId: 'r1' })],
  ]),
  resources: [
    resourceFixture(),
    resourceFixture({ id: 'r2', title: 'Performance review 2025' }),
  ],
  statements: [
    { id: 'A1', kind: 'answer' as const, question: 'How many?', text: 'Nine.' },
    { id: 'A2', kind: 'edit' as const, text: 'Led the team.' },
    { id: 'N1', kind: 'note' as const, text: 'Also: ran the hiring loop.' },
  ],
  writtenAgainDay: '15 Oct 2026',
};

describe('sourceLine', () => {
  it('names each resource once, in the order the line cites them', () => {
    expect(
      sourceLine(
        t,
        {
          state: 'written',
          sources: [
            { kind: 'item', itemId: 'i1' },
            { kind: 'item', itemId: 'i2' },
            { kind: 'item', itemId: 'i3' },
          ],
        },
        context,
      ),
    ).toBe(
      'cv.sourceFrom {"sources":"Maya Okafor CV 2026 · Performance review 2025"}',
    );
  });

  it('says a line from what the candidate asked of the CV (D97)', () => {
    expect(
      sourceLine(
        t,
        { state: 'written', sources: [{ kind: 'statement', id: 'N1' }] },
        context,
      ),
    ).toBe('cv.sourceFrom {"sources":"cv.sourceAsked"}');
  });

  it('says an answer with the day of the version it was written again from, and the candidate’s words', () => {
    expect(
      sourceLine(
        t,
        {
          state: 'written',
          sources: [
            { kind: 'statement', id: 'A1' },
            { kind: 'statement', id: 'A2' },
          ],
        },
        context,
      ),
    ).toBe(
      'cv.sourceFrom {"sources":"cv.sourceAnswerOf {\\"date\\":\\"15 Oct 2026\\"} · cv.sourceYourWords"}',
    );
  });

  it('says a cited item is no longer in the profile, and an edited line is the candidate’s', () => {
    expect(
      sourceLine(
        t,
        { state: 'written', sources: [{ kind: 'item', itemId: 'gone' }] },
        context,
      ),
    ).toBe('cv.sourceFrom {"sources":"cv.sourceGone"}');
    expect(
      sourceLine(
        t,
        { state: 'edited', sources: [{ kind: 'item', itemId: 'i1' }] },
        context,
      ),
    ).toBe('cv.sourceEditedByYou');
  });

  it('says nothing while the items are read', () => {
    expect(
      sourceLine(
        t,
        { state: 'written', sources: [{ kind: 'item', itemId: 'i1' }] },
        { ...context, items: null },
      ),
    ).toBe('');
  });
});

describe('the length of a written CV', () => {
  it('rounds the estimate to half a page, never under half', () => {
    const document = writtenDocumentFixture();
    expect(aboutPages(t, document)).toBe('cv.aboutHalfPage');
    document.summary[0]!.text = 'word '.repeat(700).trim();
    expect(aboutPages(t, document)).toBe('cv.aboutPagesAndHalf {"whole":1}');
    document.summary[0]!.text = 'word '.repeat(960).trim();
    expect(aboutPages(t, document)).toBe('cv.aboutPages {"count":2}');
  });

  it('is longer than asked by half a page or more', () => {
    const document = writtenDocumentFixture();
    document.summary[0]!.text = 'word '.repeat(700).trim();
    expect(isLongerThanAsked(document, 1)).toBe(true);
    expect(isLongerThanAsked(document, 2)).toBe(false);
  });
});
