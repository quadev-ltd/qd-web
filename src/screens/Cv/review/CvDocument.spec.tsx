import { render, screen } from '@testing-library/react';

import { CvDocument } from './CvDocument';

import { type CvChange, cvVersionText } from '@/core/profile/cvVersions';
import { cvVersionFixture } from '@/testUtil/cvVersionFixtures';

/** A CV read from a PDF keeps the PDF's line breaks, so a sentence can run over two lines. */
const CV =
  'Maya Okafor\nExperience\n- Led the payments team, shipping\nfeatures across TypeScript and Go.\n- Ran the on-call rota.';

const PASSAGE =
  'Led the payments team, shipping\nfeatures across TypeScript and Go.';

const version = (change: Partial<CvChange>) =>
  cvVersionFixture({
    cv: CV,
    questions: [],
    changes: [
      {
        id: 'c1',
        action: 'rewrite',
        original: PASSAGE,
        after: '',
        proposed: 'Led the payments platform team of six.',
        reason: 'Says what the role was.',
        sources: [{ kind: 'cv' }],
        decision: 'open',
        ...change,
      },
    ],
  });

const cv = () => screen.getByRole('article', { name: 'cv.yourCvTitle' });

describe('CvDocument', () => {
  it('marks a passage that runs over two lines once, with both its lines', () => {
    render(<CvDocument version={version({})} marks />);

    expect(screen.getAllByText('cv.markChange')).toHaveLength(1);
    expect(
      screen.getByText(/features across TypeScript and Go\./),
    ).toHaveTextContent(/Led the payments team, shipping\s+features across/);
  });

  it('shows an accepted change over two lines without the line it replaced, as the text has it', () => {
    const accepted = version({ decision: 'accepted' });
    render(<CvDocument version={accepted} marks />);

    expect(cv()).not.toHaveTextContent('features across TypeScript');
    expect(cv()).toHaveTextContent('Led the payments platform team of six.');
    expect(cvVersionText(accepted)).not.toContain('features across');
  });

  it('leaves out a removed passage over two lines whole', () => {
    render(
      <CvDocument
        version={version({
          action: 'remove',
          proposed: '',
          decision: 'accepted',
        })}
        marks
      />,
    );

    expect(cv()).not.toHaveTextContent('Led the payments team');
    expect(cv()).not.toHaveTextContent('features across TypeScript');
    expect(cv()).toHaveTextContent('Ran the on-call rota.');
  });

  it('keeps both lines of a passage the candidate kept', () => {
    render(<CvDocument version={version({ decision: 'kept' })} marks />);

    expect(cv()).toHaveTextContent(
      /Led the payments team, shipping\s*features across TypeScript and Go\./,
    );
  });
});
