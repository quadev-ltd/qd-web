import { type TFunction } from 'i18next';

import { letterBlocks } from './LetterCopyCard';
import { letterRowMeta, letterSubtitle } from './letterMeta';

import {
  coverLetterLength,
  coverLetterText,
  coverLetterWords,
} from '@/core/profile/coverLetters';
import { coverLetterFixture } from '@/testUtil/coverLetterFixtures';
import {
  cvDetailsFixture,
  writtenVersionFixture,
} from '@/testUtil/cvVersionFixtures';

/** Keys and their values, so the parts can be read. */
const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key}(${JSON.stringify(values)})` : key) as unknown as TFunction;

const CV = writtenVersionFixture({
  id: 'v1',
  createdAt: Date.parse('2026-10-11T09:00:00Z'),
});

describe('letterRowMeta and letterSubtitle', () => {
  it('say what a letter goes with, its length and its size', () => {
    const page = coverLetterFixture();
    expect(letterRowMeta(t, page, [CV])).toBe(
      `letters.goesWith({"date":"11 Oct 2026"}) · letters.lengthPageMeta · letters.aboutWords({"count":${coverLetterWords(coverLetterText(page))}})`,
    );
    const box = coverLetterFixture({
      draft: { text: 'hi', mode: 'polish' },
      length: { kind: 'box', maxChars: 1500 },
    });
    const chars = coverLetterLength(coverLetterText(box));
    expect(letterRowMeta(t, box, [])).toBe(
      `letters.fromDraft · letters.lengthBoxMeta · letters.characters({"count":${chars},"formatted":"${chars}"})`,
    );
    // Removed since, or none
    expect(letterRowMeta(t, coverLetterFixture(), [])).toMatch(
      /^letters.goesWithRemoved · /,
    );
    expect(
      letterRowMeta(
        t,
        coverLetterFixture({ cvVersionId: undefined, status: 'creating' }),
        [],
      ),
    ).toBe('letters.noCv · letters.lengthPageMeta');
  });

  it('says how it was written, under its title', () => {
    expect(
      letterSubtitle(
        t,
        coverLetterFixture({ draft: { text: 'hi', mode: 'rewrite' } }),
        [CV],
      ),
    ).toBe(
      'letters.writtenFromDraftOn({"date":"27 Oct 2026"}) · letters.draftRewritten · letters.lengthPageMeta · letters.goesWithLower({"date":"11 Oct 2026"})',
    );
  });
});

describe('letterBlocks', () => {
  it('lays a one-page letter out as its text says it: the name, the details, then each part', () => {
    const blocks = letterBlocks(
      coverLetterFixture(),
      cvDetailsFixture(),
      new Date(2026, 9, 27),
    );

    expect(blocks.slice(0, 5)).toEqual([
      { kind: 'name', text: 'Maya Okafor' },
      {
        kind: 'contact',
        text: expect.stringContaining('maya.okafor@example.com'),
      },
      { kind: 'paragraph', text: '27 October 2026' },
      { kind: 'paragraph', text: 'Hiring Manager, Northwind Logistics' },
      { kind: 'paragraph', text: 'Senior Backend Engineer (ref. NW-2231)' },
    ]);
    expect(blocks.at(-1)).toEqual({
      kind: 'paragraph',
      text: 'Yours sincerely,\nMaya Okafor',
    });
  });

  it('lays a short letter out from its greeting', () => {
    const blocks = letterBlocks(
      coverLetterFixture({ length: { kind: 'short' } }),
      cvDetailsFixture(),
      new Date(2026, 9, 27),
    );
    expect(blocks[0]).toEqual({
      kind: 'paragraph',
      text: 'Dear Hiring Manager,',
    });
  });
});
