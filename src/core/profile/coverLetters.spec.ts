// The backend's fixtures for the text of a letter (quadev-backend packages/shared/src/coverLetter.test.ts, as
// of e15940b), so the website's copy gives the same text, counts and marks.
import {
  type CoverLetter,
  coverLetterBody,
  coverLetterDate,
  coverLetterGreeting,
  coverLetterLength,
  type CoverLetterParagraph,
  CoverLetterSchema,
  type CoverLetterSentence,
  coverLettersPath,
  coverLetterText,
  coverLetterWords,
  openLetterQuestions,
} from './coverLetters';

type TextLetter = Parameters<typeof coverLetterText>[0];

const fact = (
  id: string,
  text: string,
  extra: Partial<CoverLetterSentence> = {},
): CoverLetterSentence => ({
  id,
  text,
  kind: 'fact',
  sources: [{ kind: 'item', itemId: `item-${id}` }],
  state: 'written',
  proposed: text,
  ...extra,
});

const frame = (id: string, text: string): CoverLetterSentence => ({
  id,
  text,
  kind: 'frame',
  sources: [],
  state: 'written',
  proposed: text,
});

const NOTICE = 'My notice period is four weeks, so I can start in January.';
const PARAGRAPHS: CoverLetterParagraph[] = [
  {
    sentences: [
      frame('s1', "I'd like to apply for the Senior Backend Engineer role."),
      fact(
        's2',
        'Since 2018 I have built and run payment systems at Fenwick Pay.',
        { sources: [{ kind: 'item', itemId: 'item-1' }, { kind: 'cv' }] },
      ),
    ],
  },
  {
    sentences: [
      fact(
        's3',
        'I moved the payments ledger to event sourcing, and Sev-1 incidents fell by 40%.',
      ),
      fact('s4', 'A sentence the candidate took out.', { state: 'removed' }),
      fact('s5', 'I led the on-call redesign for 9 engineers.', {
        state: 'edited',
        text: 'I redesigned on-call for a team of 9.',
      }),
    ],
  },
  {
    sentences: [
      fact('s6', NOTICE, {
        sources: [{ kind: 'statement', id: 'D7' }],
        draftOnly: [{ text: 'four weeks', at: 20 }],
        proposedDraftOnly: [{ text: 'four weeks', at: 20 }],
      }),
    ],
  },
  {
    sentences: [
      fact('s7', 'Removed, and the only sentence of its paragraph.', {
        state: 'removed',
      }),
    ],
  },
  {
    sentences: [
      frame('s8', 'I would welcome the chance to talk about the role.'),
    ],
  },
];

const PAGE_LETTER: TextLetter = {
  convention: 'uk',
  length: { kind: 'page' },
  addressee: 'Priya Shah, Engineering Manager',
  job: {
    role: 'Senior Backend Engineer',
    company: 'Northwind Logistics',
    reference: 'NW-2231',
  },
  paragraphs: PARAGRAPHS,
};

const DETAILS = {
  name: 'Maya Okafor',
  location: 'London, UK',
  email: 'maya.okafor@example.com',
  phone: '07700 900123',
};

const BODY = [
  "I'd like to apply for the Senior Backend Engineer role. Since 2018 I have built and run payment systems at Fenwick Pay.",
  'I moved the payments ledger to event sourcing, and Sev-1 incidents fell by 40%. I redesigned on-call for a team of 9.',
  NOTICE,
  'I would welcome the chance to talk about the role.',
].join('\n\n');

describe('the text of a letter (the backend’s fixtures)', () => {
  it('gives the body without removed sentences or empty paragraphs, edits in the candidate’s words', () => {
    expect(coverLetterBody(PARAGRAPHS)).toBe(BODY);
    expect(coverLetterBody([])).toBe('');
  });

  it('marks a number only the draft gives where the sentence has it, and nowhere in the text', () => {
    const [mark] = PARAGRAPHS[2].sentences[0].draftOnly ?? [];
    expect(NOTICE.slice(mark.at, mark.at + mark.text.length)).toBe(
      'four weeks',
    );
    expect(coverLetterText(PAGE_LETTER, DETAILS)).toContain(NOTICE);
  });

  it('writes a one-page letter with its heading, the date, the greeting, the body and the sign-off', () => {
    expect(
      coverLetterText(PAGE_LETTER, DETAILS, { date: new Date(2026, 9, 27) }),
    ).toBe(
      [
        'Maya Okafor · London, UK · maya.okafor@example.com · 07700 900123',
        '27 October 2026',
        'Priya Shah, Engineering Manager, Northwind Logistics',
        'Senior Backend Engineer (ref. NW-2231)',
        '',
        'Dear Priya Shah,',
        '',
        BODY,
        '',
        'Yours sincerely,',
        'Maya Okafor',
      ].join('\n'),
    );
  });

  it('writes a letter to nobody named, with no date, details or reference, as an international letter', () => {
    const letter: TextLetter = {
      ...PAGE_LETTER,
      convention: 'international',
      addressee: undefined,
      job: { role: 'Engineer' },
    };
    expect(coverLetterText(letter)).toBe(
      [
        'Hiring Manager',
        'Engineer',
        '',
        'Dear Hiring Manager,',
        '',
        BODY,
        '',
        'Kind regards,',
      ].join('\n'),
    );
    expect(
      coverLetterText(
        { ...PAGE_LETTER, job: { reference: 'NW-2231' } },
        DETAILS,
      ).split('\n')[2],
    ).toBe('Ref. NW-2231');
  });

  it("writes a form's box as plain text with no heading, and counts it as the form does", () => {
    const box: TextLetter = {
      ...PAGE_LETTER,
      length: { kind: 'box', maxChars: 1_500 },
      addressee: undefined,
      paragraphs: [PARAGRAPHS[0], PARAGRAPHS[4]],
    };
    const text = coverLetterText(box, DETAILS);
    expect(text).toBe(
      [
        'Dear Hiring Manager,',
        '',
        "I'd like to apply for the Senior Backend Engineer role. Since 2018 I have built and run payment systems at Fenwick Pay.",
        '',
        'I would welcome the chance to talk about the role.',
        '',
        'Yours sincerely,',
        'Maya Okafor',
      ].join('\n'),
    );
    expect(coverLetterLength(text)).toBe(223);
    expect(coverLetterWords(text)).toBe(39);
  });

  it('writes a short US letter for an email: no heading, the US sign-off', () => {
    const short: TextLetter = {
      ...PAGE_LETTER,
      convention: 'us',
      length: { kind: 'short' },
    };
    const text = coverLetterText(short, DETAILS, {
      date: new Date(2026, 9, 27),
    });
    expect(text.startsWith('Dear Priya Shah,\n\n')).toBe(true);
    expect(text.endsWith('\n\nSincerely,\nMaya Okafor')).toBe(true);
    expect(text).not.toContain('2026\n');
  });

  it('dates and greets as each convention does, and never guesses a title', () => {
    expect(coverLetterDate(new Date(2026, 0, 5), 'uk')).toBe('5 January 2026');
    expect(coverLetterDate(new Date(2026, 0, 5), 'us')).toBe('January 5, 2026');
    expect(coverLetterGreeting('  Priya   Shah , Engineering Manager')).toBe(
      'Dear Priya Shah,',
    );
    expect(coverLetterGreeting(' ')).toBe('Dear Hiring Manager,');
    expect(coverLetterGreeting(undefined)).toBe('Dear Hiring Manager,');
  });

  it('counts UTF-16 code units, with a line break as one', () => {
    expect(coverLetterLength('a\r\nb')).toBe(3);
    expect(coverLetterLength('café 🚚')).toBe(7);
    expect(coverLetterWords('1,200 merchants at p95, event-driven.')).toBe(5);
  });

  it('counts the questions still open, and names the documents', () => {
    expect(
      openLetterQuestions({
        questions: [
          { id: 'q1', text: 'What draws you to Northwind?', status: 'open' },
          { id: 'q2', text: 'Who will read it?', status: 'skipped' },
        ],
      }),
    ).toBe(1);
    expect(coverLettersPath('alice')).toBe('users/alice/coverLetters');
    expect(coverLettersPath('alice', 'l1')).toBe('users/alice/coverLetters/l1');
  });
});

describe('reading a letter', () => {
  it('reads past what it doesn’t know: a source, a mark or a question it can’t read is left out', () => {
    const letter: CoverLetter = CoverLetterSchema.parse({
      id: 'l1',
      applicationId: 'a1',
      convention: 'medieval',
      length: { kind: 'scroll' },
      job: { role: 'Engineer' },
      status: 'ready',
      paragraphs: [
        {
          sentences: [
            {
              id: 's1',
              text: 'I can start in four weeks.',
              kind: 'fact',
              sources: [
                { kind: 'job', quote: 'Two million parcels a day.' },
                { kind: 'rumour' },
                { kind: 'statement', id: 'D1' },
              ],
              state: 'written',
              proposed: 'I can start in four weeks.',
              draftOnly: [{ text: 'four weeks', at: 15 }, { text: '' }],
            },
          ],
        },
      ],
      notes: ['Led with your ledger move.'],
      outcomes: [{ about: 'draft', outcome: 'done', text: 'Kept it.' }, {}],
      questions: [{ id: 'q1', text: 'Who reads it?' }],
      statements: [{ id: 'D1', kind: 'draft', text: 'can start in 4 weeks' }],
      createdAt: 1,
      updatedAt: 2,
    });

    expect(letter.convention).toBe('international');
    expect(letter.length).toEqual({ kind: 'page' });
    const [sentence] = letter.paragraphs?.[0].sentences ?? [];
    expect(sentence.sources).toEqual([
      { kind: 'job', quote: 'Two million parcels a day.' },
      { kind: 'statement', id: 'D1' },
    ]);
    expect(sentence.draftOnly).toEqual([{ text: 'four weeks', at: 15 }]);
    expect(letter.outcomes).toHaveLength(1);
    expect(letter.questions).toEqual([
      { id: 'q1', text: 'Who reads it?', status: 'open' },
    ]);
  });
});
