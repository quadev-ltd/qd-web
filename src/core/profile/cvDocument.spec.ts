import {
  CV_SECTION_HEADINGS,
  CV_SECTION_KEYS,
  CV_WORDS_PER_PAGE,
  cvDocumentLines,
  cvDocumentPages,
  cvDocumentText,
  cvDocumentWords,
  cvEntryHeading,
  cvHeaderLines,
  cvLinkLabel,
  cvRightToWorkLine,
  type CvDocument,
  type CvEntry,
  type CvLine,
} from './cvDocument';

// The backend's fixtures (quadev-backend packages/shared/src/cvDocument.test.ts, as of 31b27ad),
// copied as they are: the same inputs give the same text here and there.

const line = (
  id: string,
  text: string,
  extra: Partial<CvLine> = {},
): CvLine => ({
  id,
  text,
  sources: [{ kind: 'item', itemId: `item-${id}` }],
  state: 'written',
  proposed: text,
  ...extra,
});

const entry = (
  id: string,
  fields: Partial<CvEntry>,
  bullets: CvLine[],
): CvEntry => {
  const heading = {
    title: '',
    organisation: '',
    location: '',
    start: '',
    end: '',
    ...fields,
  };
  return {
    id,
    ...heading,
    sources: [{ kind: 'item', itemId: `item-${id}` }],
    state: 'written',
    proposedFields: heading,
    bullets,
    ...fields,
  };
};

const DOCUMENT: CvDocument = {
  summary: [
    line('l1', 'Backend engineer who builds payment systems in Go and Kotlin.'),
    line('l2', 'Mentors engineers and leads migrations across teams.'),
  ],
  experience: [
    entry(
      'e1',
      {
        title: 'Senior Backend Engineer',
        organisation: 'Halvorsen Freight',
        location: 'Tallinn',
        start: '2021',
        end: 'Present',
      },
      [
        line(
          'l3',
          'Led the migration of the tracking service to 6 Go services on Kubernetes.',
        ),
        line('l4', 'Cut p95 latency from 900 ms to 220 ms.'),
      ],
    ),
    entry(
      'e2',
      {
        title: 'Backend Engineer',
        organisation: 'Brightloop Payments',
        start: '2017',
        end: '2021',
      },
      [line('l5', 'Built the card refund API used by 1,200 merchants.')],
    ),
  ],
  projects: [
    entry('e3', { title: 'Open-source rate limiter', start: '2020' }, [
      line('l6', 'Wrote a rate limiter in Go.'),
    ]),
  ],
  skills: [
    line('l7', 'Go, Kotlin, Java', { label: 'Languages' }),
    line('l8', 'Kafka, Kubernetes, PostgreSQL', { label: 'Platforms' }),
  ],
  education: [
    line('l9', 'MSc Computer Science, Northern Institute of Technology, 2015'),
  ],
  certifications: [],
  languages: [line('l10', 'Finnish (native)'), line('l11', 'English (fluent)')],
};

const DETAILS = {
  name: 'Marta Ilveskoski',
  headline: 'Senior Backend Engineer',
  email: 'marta@example.com',
  phone: '+372 5550 0142',
  location: 'Tallinn, Estonia',
  rightToWork: 'EU citizen',
  links: ['github.com/marta', 'linkedin.com/in/marta'],
};

const BODY = [
  'PROFILE',
  'Backend engineer who builds payment systems in Go and Kotlin. Mentors engineers and leads migrations across teams.',
  '',
  'EXPERIENCE',
  'Senior Backend Engineer, Halvorsen Freight, Tallinn | 2021 – Present',
  '- Led the migration of the tracking service to 6 Go services on Kubernetes.',
  '- Cut p95 latency from 900 ms to 220 ms.',
  '',
  'Backend Engineer, Brightloop Payments | 2017 – 2021',
  '- Built the card refund API used by 1,200 merchants.',
  '',
  'PROJECTS',
  'Open-source rate limiter | 2020',
  '- Wrote a rate limiter in Go.',
  '',
  'SKILLS',
  'Languages: Go, Kotlin, Java',
  'Platforms: Kafka, Kubernetes, PostgreSQL',
  '',
  'EDUCATION',
  'MSc Computer Science, Northern Institute of Technology, 2015',
  '',
  'LANGUAGES',
  'Finnish (native)',
  'English (fluent)',
].join('\n');

describe('cvHeaderLines', () => {
  it('gives the name, the headline, location · phone · email, the links and the right to work', () => {
    expect(cvHeaderLines(DETAILS)).toEqual([
      'Marta Ilveskoski',
      'Senior Backend Engineer',
      'Tallinn, Estonia · +372 5550 0142 · marta@example.com',
      'github.com/marta · linkedin.com/in/marta',
      'Right to work in the UK: EU citizen',
    ]);
  });

  it('shows the right to work in a uk CV only', () => {
    expect(cvHeaderLines(DETAILS, 'uk').at(-1)).toBe(
      'Right to work in the UK: EU citizen',
    );
    expect(cvHeaderLines(DETAILS, 'us')).toHaveLength(4);
    expect(cvHeaderLines(DETAILS, 'international').at(-1)).toBe(
      'github.com/marta · linkedin.com/in/marta',
    );
    expect(cvDocumentText(DOCUMENT, DETAILS, 'international')).not.toContain(
      'Right to work',
    );
  });

  it('prints the right to work after its label, unless the value already says what it is', () => {
    expect(cvRightToWorkLine('British citizen')).toBe(
      'Right to work in the UK: British citizen',
    );
    expect(cvRightToWorkLine(' Full right to work in the UK ')).toBe(
      'Full right to work in the UK',
    );
    expect(cvRightToWorkLine('Skilled Worker visa until 2028')).toBe(
      'Skilled Worker visa until 2028',
    );
    expect(cvRightToWorkLine('No sponsorship needed')).toBe(
      'No sponsorship needed',
    );
    expect(cvRightToWorkLine('  ')).toBe('');
    expect(cvRightToWorkLine(undefined)).toBe('');
  });

  it('leaves out what is empty, and gives nothing without details', () => {
    expect(
      cvHeaderLines({ name: ' Marta ', email: 'marta@example.com', links: [] }),
    ).toEqual(['Marta', 'marta@example.com']);
    expect(cvHeaderLines(undefined)).toEqual([]);
    expect(cvHeaderLines({})).toEqual([]);
  });
});

describe('cvLinkLabel', () => {
  it.each([
    [
      'https://play.google.com/store/apps/details?id=com.qdmobile&gl=UK',
      'play.google.com/store/apps/details?id=com.qdmobile',
    ],
    ['https://www.linkedin.com/in/gus/', 'linkedin.com/in/gus'],
    ['github.com/gusfran', 'github.com/gusfran'],
    [
      'https://apps.apple.com/gb/app/quadev/id123?mt=8',
      'apps.apple.com/gb/app/quadev/id123',
    ],
    ['HTTPS://WWW.Example.com/', 'Example.com'],
    [
      'play.google.com/store/apps/details?gl=UK',
      'play.google.com/store/apps/details',
    ],
    ['  https://quadev.net/#work ', 'quadev.net'],
  ])('prints %s as %s', (link, label) => {
    expect(cvLinkLabel(link)).toBe(label);
  });

  it('shortens the links of the header', () => {
    expect(
      cvHeaderLines({
        links: [
          'https://github.com/quadev-ltd',
          'https://www.linkedin.com/in/gus/',
        ],
      }),
    ).toEqual(['github.com/quadev-ltd · linkedin.com/in/gus']);
  });
});

describe('cvDocumentText', () => {
  it('prints the header, then each section with its heading, in the fixed order', () => {
    expect(cvDocumentText(DOCUMENT, DETAILS)).toBe(
      [
        'Marta Ilveskoski',
        'Senior Backend Engineer',
        'Tallinn, Estonia · +372 5550 0142 · marta@example.com',
        'github.com/marta · linkedin.com/in/marta',
        'Right to work in the UK: EU citizen',
        '',
        BODY,
      ].join('\n'),
    );
  });

  it('starts with the profile when there are no details', () => {
    expect(cvDocumentText(DOCUMENT)).toBe(BODY);
  });

  it('leaves out removed lines and roles and empty sections, and prints edits in the candidate’s words', () => {
    const revised: CvDocument = {
      ...DOCUMENT,
      summary: [
        DOCUMENT.summary[0]!,
        { ...DOCUMENT.summary[1]!, state: 'removed' },
      ],
      experience: [
        {
          ...DOCUMENT.experience[0]!,
          title: 'Lead Backend Engineer',
          state: 'edited',
          bullets: [
            {
              ...DOCUMENT.experience[0]!.bullets[0]!,
              text: 'Moved tracking to 6 Go services.',
              state: 'edited',
            },
            { ...DOCUMENT.experience[0]!.bullets[1]!, state: 'removed' },
          ],
        },
        { ...DOCUMENT.experience[1]!, state: 'removed' },
      ],
      projects: [],
      skills: [],
      languages: DOCUMENT.languages.map(language => ({
        ...language,
        state: 'removed',
      })),
    };
    expect(cvDocumentText(revised, { name: 'Marta Ilveskoski' })).toBe(
      [
        'Marta Ilveskoski',
        '',
        'PROFILE',
        'Backend engineer who builds payment systems in Go and Kotlin.',
        '',
        'EXPERIENCE',
        'Lead Backend Engineer, Halvorsen Freight, Tallinn | 2021 – Present',
        '- Moved tracking to 6 Go services.',
        '',
        'EDUCATION',
        'MSc Computer Science, Northern Institute of Technology, 2015',
      ].join('\n'),
    );
  });

  it('prints a heading with only the fields it has', () => {
    const fields = {
      title: '',
      organisation: '',
      location: '',
      start: '',
      end: '',
    };
    expect(cvEntryHeading({ ...fields, title: 'Tallyboard' })).toBe(
      'Tallyboard',
    );
    expect(
      cvEntryHeading({
        ...fields,
        organisation: 'Lumen Health',
        end: 'February 2022',
      }),
    ).toBe('Lumen Health | February 2022');
    expect(cvEntryHeading(fields)).toBe('');
  });
});

describe('the length and the lines of a document', () => {
  it('counts the printed words, header aside, and the pages at CV_WORDS_PER_PAGE', () => {
    expect(CV_WORDS_PER_PAGE).toBe(500);
    expect(cvDocumentWords(DOCUMENT)).toBe(98);
    expect(cvDocumentPages(DOCUMENT)).toBe(0.2);
    const long = {
      ...DOCUMENT,
      summary: [line('l1', 'word '.repeat(700).trim())],
    };
    expect(cvDocumentPages(long)).toBe(1.6);
  });

  it('lists every line in order, bullets with their role', () => {
    const lines = cvDocumentLines(DOCUMENT);
    expect(lines.map(({ line: { id } }) => id)).toEqual([
      'l1',
      'l2',
      'l3',
      'l4',
      'l5',
      'l6',
      'l7',
      'l8',
      'l9',
      'l10',
      'l11',
    ]);
    expect(lines[2]!.entry?.id).toBe('e1');
    expect(lines[0]!.entry).toBeUndefined();
  });

  it('names the sections in the order of a British CV', () => {
    expect(CV_SECTION_KEYS.map(key => CV_SECTION_HEADINGS[key])).toEqual([
      'Profile',
      'Experience',
      'Projects',
      'Skills',
      'Education',
      'Certifications',
      'Languages',
    ]);
  });
});
