// What the preview gateway's fake writes for a cover letter (D98): a letter that shows every kind of
// source the real one can cite, as the backend's offline writer does. It opens with the role (a
// frame), gives the candidate's reason in their words, two facts of the profile, a passage of the
// posting, a sentence of the draft with a number only the draft gives (marked), and closes with a
// frame. Test and preview only.
import { type JobApplication } from './applications';
import { type SkillMapItem } from './contract';
import {
  type CoverLetter,
  type CoverLetterOutcome,
  type CoverLetterParagraph,
  type CoverLetterSentence,
  type CoverLetterStatement,
} from './coverLetters';

/** The sentences of a text, split after . ! ? and at line breaks. */
const sentencesOf = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

const capitalised = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** The candidate's words as sources: W1 for the reason, N… for what was asked, D… for the draft. */
const statementsOf = (
  letter: Pick<CoverLetter, 'why' | 'asked' | 'draft'>,
): CoverLetterStatement[] => [
  ...(letter.why ? [{ id: 'W1', kind: 'why' as const, text: letter.why }] : []),
  ...(letter.asked ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `N${index + 1}`,
      kind: 'note' as const,
      text,
    })),
  ...sentencesOf(letter.draft?.text ?? '').map((text, index) => ({
    id: `D${index + 1}`,
    kind: 'draft' as const,
    text,
  })),
];

type Written = Pick<
  CoverLetter,
  'plan' | 'paragraphs' | 'notes' | 'outcomes' | 'questions' | 'statements'
>;

export const previewLetterFor = (
  letter: Pick<
    CoverLetter,
    'why' | 'asked' | 'draft' | 'addressee' | 'cvVersionId' | 'job'
  >,
  items: SkillMapItem[],
  application: Pick<JobApplication, 'jobDescription' | 'brief'> | undefined,
): Written => {
  const statements = statementsOf(letter);
  let next = 0;
  const id = () => {
    next += 1;
    return `s${next}`;
  };
  const sentence = (
    text: string,
    sources: CoverLetterSentence['sources'],
    extra: Partial<CoverLetterSentence> = {},
  ): CoverLetterSentence => ({
    id: id(),
    text,
    kind: sources.length > 0 ? 'fact' : 'frame',
    sources,
    state: 'written',
    proposed: text,
    ...extra,
  });

  const role = letter.job.role ?? 'this';
  const opening: CoverLetterSentence[] = [
    sentence(
      `I’d like to apply for the ${role} role${letter.job.company ? ` at ${letter.job.company}` : ''}.`,
      [],
    ),
  ];
  const why = statements.find(({ kind }) => kind === 'why');
  if (why) {
    opening.push(
      sentence(capitalised(sentencesOf(why.text)[0] ?? why.text), [
        { kind: 'statement', id: why.id },
      ]),
    );
  }

  const facts = items
    .filter(({ hidden }) => !hidden)
    .sort((a, b) => Number(b.starred) - Number(a.starred))
    .slice(0, 2)
    .map(item =>
      sentence(item.text, [
        { kind: 'item', itemId: item.id },
        ...(letter.cvVersionId ? [{ kind: 'cv' as const }] : []),
      ]),
    );

  const posting = sentencesOf(application?.jobDescription ?? '')[0];
  const job = posting
    ? [sentence(posting, [{ kind: 'job', quote: posting }])]
    : [];

  // A sentence of the draft with a number in it: no profile item has it, so it is marked.
  const outcomes: CoverLetterOutcome[] = [];
  const fromDraft: CoverLetterSentence[] = [];
  const numbered = statements.find(
    ({ kind, text }) => kind === 'draft' && /\d/.test(text),
  );
  if (letter.draft) {
    outcomes.push({
      about: 'draft',
      outcome: 'done',
      text: 'Kept your points in your order.',
    });
  }
  if (numbered) {
    const text = capitalised(numbered.text.replace(/[.!?]*$/, '.'));
    const number = /\d+(?:[.,]\d+)?(?:\s*\w+)?/.exec(text);
    const marks = number ? [{ text: number[0], at: number.index }] : [];
    fromDraft.push(
      sentence(text, [{ kind: 'statement', id: numbered.id }], {
        ...(marks.length > 0
          ? { draftOnly: marks, proposedDraftOnly: marks }
          : {}),
      }),
    );
    if (number) {
      outcomes.push({
        about: 'draft',
        outcome: 'changed',
        text: `“${number[0]}” is only in your draft, not in your profile. It’s marked in the letter: check it before you send.`,
      });
    }
  }
  for (const note of statements.filter(({ kind }) => kind === 'note')) {
    outcomes.push({
      about: 'asked',
      outcome: 'done',
      text: `Followed “${note.text}”.`,
    });
  }

  const paragraphs: CoverLetterParagraph[] = [
    { sentences: opening },
    ...(facts.length > 0 ? [{ sentences: facts }] : []),
    ...(job.length > 0 || fromDraft.length > 0
      ? [{ sentences: [...job, ...fromDraft] }]
      : []),
    {
      sentences: [
        sentence('I would welcome the chance to talk about the role.', []),
      ],
    },
  ];

  return {
    plan: {
      requirements: (application?.brief?.requirements ?? [])
        .slice(0, 3)
        .map(({ text }) => text),
      story: facts[0]?.text ?? '',
    },
    paragraphs,
    notes: [
      ...(facts.length > 0
        ? ['Led with what your profile shows best for this job.']
        : []),
      ...(why ? ['Gave your reason in your words.'] : []),
      ...(letter.addressee
        ? []
        : ['Wrote “Dear Hiring Manager”: no one is named. Question 1 asks.']),
    ],
    outcomes,
    questions: letter.addressee
      ? []
      : [{ id: 'q1', text: 'Do you know who will read it?', status: 'open' }],
    statements,
  };
};
