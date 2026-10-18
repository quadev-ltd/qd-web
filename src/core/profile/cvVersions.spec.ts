// The cases of quadev-backend's packages/shared/src/cvVersion.test.ts, so this copy of
// cvVersionText says what the backend's says.
import {
  type CvChange,
  type CvQuestion,
  CvVersionSchema,
  cvVersionsPath,
  cvVersionText,
  isCreating,
  CV_CREATING_STALE_MS,
  openReviews,
} from './cvVersions';

const cv =
  'Maya Okafor\nExperience\n- Built the booking API\n- Ran the on-call rota for two years\nEducation\nBSc, Leeds';

const change = (more: Partial<CvChange>): CvChange => ({
  id: 'c1',
  action: 'rewrite',
  original: '',
  after: '',
  proposed: '',
  reason: 'x',
  sources: [{ kind: 'cv' }],
  decision: 'accepted',
  ...more,
});

const text = (changes: CvChange[], questions: CvQuestion[] = []) =>
  cvVersionText({ cv, changes, questions });

describe('cvVersionsPath', () => {
  it('names the collection and one version', () => {
    expect(cvVersionsPath('u1')).toBe('users/u1/cvVersions');
    expect(cvVersionsPath('u1', 'v1')).toBe('users/u1/cvVersions/v1');
  });
});

describe('cvVersionText', () => {
  it('is the CV as it was while nothing is accepted', () => {
    const open = change({
      original: 'Built the booking API',
      proposed: 'Built it',
      decision: 'open',
    });
    const kept = change({
      original: 'Built the booking API',
      proposed: 'Built it',
      decision: 'kept',
    });
    expect(text([open, kept])).toBe(cv);
  });

  it('rewrites a passage, with the candidate’s own text when they edited it', () => {
    expect(
      text([
        change({
          original: 'Built the booking API',
          proposed: 'Built the booking API for 40 depots',
        }),
      ]),
    ).toContain('- Built the booking API for 40 depots\n');
    const edited = change({
      original: 'Built the booking API',
      proposed: 'Built it',
      decision: 'edited',
      text: 'Wrote it',
    });
    expect(text([edited])).toContain('\n- Wrote it\n');
  });

  it('adds a line after the line it names, with that line’s list mark', () => {
    const added = change({
      action: 'add',
      after: 'Built the booking API',
      proposed: 'Cut refunds to one day',
    });
    expect(text([added])).toContain(
      '- Built the booking API\n- Cut refunds to one day\n- Ran the on-call',
    );
  });

  it('removes a whole line with its line break, or a part of a line', () => {
    expect(
      text([
        change({
          action: 'remove',
          original: 'Ran the on-call rota for two years',
        }),
      ]),
    ).toBe(
      'Maya Okafor\nExperience\n- Built the booking API\nEducation\nBSc, Leeds',
    );
    expect(text([change({ action: 'remove', original: 'BSc, Leeds' })])).toBe(
      'Maya Okafor\nExperience\n- Built the booking API\n- Ran the on-call rota for two years\nEducation',
    );
    expect(
      text([change({ action: 'remove', original: 'for two years' })]),
    ).toContain('\n- Ran the on-call rota\n');
  });

  it('leaves out a change whose passage an earlier one took', () => {
    const first = change({
      original: 'Built the booking API',
      proposed: 'Built the API',
    });
    const second = change({
      id: 'c2',
      original: 'Built the booking API',
      proposed: 'Made the booking API',
    });
    expect(text([first, second])).toContain('- Built the API\n');
  });

  it('puts an answer on its own line after its passage, or at the end', () => {
    const questions: CvQuestion[] = [
      {
        id: 'q1',
        passage: 'Built the booking API',
        text: 'How many?',
        status: 'answered',
        answer: ' 40 depots used it ',
      },
      {
        id: 'q2',
        passage: '',
        text: 'Languages?',
        status: 'answered',
        answer: 'Fluent in Yoruba',
      },
      { id: 'q3', passage: '', text: 'Awards?', status: 'skipped' },
    ];
    expect(text([], questions)).toBe(
      'Maya Okafor\nExperience\n- Built the booking API\n- 40 depots used it\n- Ran the on-call rota for two years\nEducation\nBSc, Leeds\nFluent in Yoruba',
    );
  });
});

describe('openReviews', () => {
  it('counts the changes and the questions not decided yet', () => {
    expect(
      openReviews({
        changes: [change({ decision: 'open' }), change({ decision: 'kept' })],
        questions: [{ id: 'q1', passage: '', text: 'x', status: 'open' }],
      }),
    ).toBe(2);
  });
});

describe('isCreating', () => {
  it('is being made until the backend says how it ended, or it was lost', () => {
    const NOW = 10_000_000;
    expect(isCreating({ status: 'creating', createdAt: NOW - 1000 }, NOW)).toBe(
      true,
    );
    expect(
      isCreating(
        { status: 'creating', createdAt: NOW - CV_CREATING_STALE_MS },
        NOW,
      ),
    ).toBe(false);
    expect(isCreating({ status: 'ready', createdAt: NOW }, NOW)).toBe(false);
  });
});

describe('CvVersionSchema', () => {
  it('reads a version, and leaves out what it does not understand rather than fail', () => {
    const parsed = CvVersionSchema.parse({
      id: 'v1',
      target: { kind: 'general' },
      resourceId: 'r1',
      convention: 'uk',
      length: 'half-page',
      status: 'ready',
      cv,
      findings: 'many',
      changes: [],
      questions: [],
      unsupportedJobTerms: [],
      profileRevision: 3,
      createdAt: 1,
      updatedAt: 2,
    });
    expect(parsed).toMatchObject({ length: 'same', findings: [] });
  });
});
