import {
  interviewQuestionsStateOf,
  type InterviewQuestions,
} from './interviews';

const questions: InterviewQuestions = {
  items: [
    { id: 'q1', text: 'Why us?', kind: 'motivation', why: 'Always asked.' },
  ],
  builtAt: 1,
  interviewRevision: 2,
  applicationRevision: 3,
  profileRevision: 4,
};

describe('interviewQuestionsStateOf', () => {
  it('is none before a list is written', () => {
    expect(interviewQuestionsStateOf({ revision: 2 }, 3, 4)).toEqual({
      kind: 'none',
    });
  });

  it('is ready while nothing it was written from changed', () => {
    expect(interviewQuestionsStateOf({ questions, revision: 2 }, 3, 4)).toEqual(
      { kind: 'ready' },
    );
  });

  it('names what changed: the interview first, then the job, then the profile', () => {
    expect(interviewQuestionsStateOf({ questions, revision: 3 }, 4, 5)).toEqual(
      { kind: 'outOfDate', because: 'interview' },
    );
    expect(interviewQuestionsStateOf({ questions, revision: 2 }, 4, 5)).toEqual(
      { kind: 'outOfDate', because: 'job' },
    );
    expect(interviewQuestionsStateOf({ questions, revision: 2 }, 3, 5)).toEqual(
      { kind: 'outOfDate', because: 'profile' },
    );
  });

  it('says nothing of the profile when its revision could not be read', () => {
    expect(
      interviewQuestionsStateOf({ questions, revision: 2 }, 3, null),
    ).toEqual({ kind: 'ready' });
  });
});
