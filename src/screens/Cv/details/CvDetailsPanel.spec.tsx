import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CvDetailsPanel } from './CvDetailsPanel';

import { type CvDetails } from '@/core/profile/cvDetails';
import { ProfileError, ProfileErrorCode } from '@/core/profile/errors';
import { cvDetailsFixture } from '@/testUtil/cvVersionFixtures';
import { createMockProfileGateway } from '@/testUtil/mockProfileGateway';
import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderCvPage } from '@/testUtil/renderCvPage';

vi.mock('@/core/logger', () => ({
  default: vi.fn(() => ({ logError: vi.fn(), logMessage: vi.fn() })),
}));

const setUp = (details: CvDetails | null = cvDetailsFixture()) => {
  const gateway = createMockProfileGateway();
  gateway.getCvDetails.mockResolvedValue(details);
  const onClose = vi.fn();
  renderCvPage(<CvDetailsPanel onClose={onClose} />, {
    gateway,
    interviewProfile: {
      uid: 'uid-1',
      status: 'loaded',
      resources: [resourceFixture()],
    },
    cvVersions: { uid: 'uid-1', detailsStatus: 'loaded', details },
  });
  return { gateway, onClose };
};

const field = (name: string) => screen.getByRole('textbox', { name });

describe('CvDetailsPanel', () => {
  it('shows the details as the CV filled them, and says where they came from', () => {
    setUp();

    expect(
      screen.getByRole('dialog', { name: 'cv.detailsTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cv\.detailsFilledFrom cv\.detailsKept/),
    ).toBeInTheDocument();
    expect(field('cv.detailsField_name')).toHaveValue('Maya Okafor');
    expect(field('cv.detailsField_rightToWork')).toHaveValue('British citizen');
    expect(
      screen
        .getAllByRole('textbox', { name: 'cv.detailsLinkLabel' })
        .map(input => (input as HTMLInputElement).value),
    ).toEqual([
      'linkedin.com/in/maya-okafor-example',
      'github.com/maya-okafor-example',
    ]);
  });

  it('saves only the fields the candidate changed, so the others still fill from a CV', async () => {
    const { gateway, onClose } = setUp();

    await userEvent.clear(field('cv.detailsField_phone'));
    await userEvent.type(field('cv.detailsField_phone'), '07700 900999');
    await userEvent.click(
      screen.getAllByRole('button', { name: 'cv.detailsRemoveLink' })[0],
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsAddLink' }),
    );
    const links = screen.getAllByRole('textbox', {
      name: 'cv.detailsLinkLabel',
    });
    await userEvent.type(links[1], '  maya.example  ');
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsSaveButton' }),
    );

    expect(gateway.updateCvDetails).toHaveBeenCalledExactlyOnceWith({
      phone: '07700 900999',
      links: ['github.com/maya-okafor-example', 'maya.example'],
    });
    // Read again for the card, then closed.
    expect(gateway.getCvDetails).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('sends a cleared field as empty, and leaves out a link left empty', async () => {
    const { gateway } = setUp();

    await userEvent.clear(field('cv.detailsField_rightToWork'));
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsAddLink' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsSaveButton' }),
    );

    expect(gateway.updateCvDetails).toHaveBeenCalledExactlyOnceWith({
      rightToWork: '',
    });
  });

  it('closes without a call when nothing changed', async () => {
    const { gateway, onClose } = setUp();

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsSaveButton' }),
    );

    expect(gateway.updateCvDetails).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('says when nothing was found yet, and saves what the candidate types', async () => {
    const { gateway } = setUp(null);

    expect(screen.getByText('cv.detailsEmpty')).toBeInTheDocument();
    await userEvent.type(field('cv.detailsField_name'), 'Maya Okafor');
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsSaveButton' }),
    );

    expect(gateway.updateCvDetails).toHaveBeenCalledExactlyOnceWith({
      name: 'Maya Okafor',
    });
  });

  it('offers no fifth link', async () => {
    setUp(
      cvDetailsFixture({
        links: ['a.example', 'b.example', 'c.example'],
      }),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsAddLink' }),
    );

    expect(
      screen.getAllByRole('textbox', { name: 'cv.detailsLinkLabel' }),
    ).toHaveLength(4);
    expect(
      screen.queryByRole('button', { name: 'cv.detailsAddLink' }),
    ).not.toBeInTheDocument();
  });

  it('says when the details could not be saved, and stays open', async () => {
    const { gateway, onClose } = setUp();
    gateway.updateCvDetails.mockRejectedValue(
      new ProfileError(ProfileErrorCode.Unknown),
    );

    await userEvent.type(field('cv.detailsField_headline'), ', payments');
    await userEvent.click(
      screen.getByRole('button', { name: 'cv.detailsSaveButton' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'cv.detailsSaveFailedMessage',
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
