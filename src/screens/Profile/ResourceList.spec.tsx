import { screen, within } from '@testing-library/react';

import { ResourceList } from './ResourceList';

import { resourceFixture } from '@/testUtil/profileFixtures';
import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('ResourceList', () => {
  it('lists the resources in the order given, each with its type, title and state', () => {
    renderWithProviders(
      <ResourceList
        resources={[
          resourceFixture({
            id: 'a',
            type: 'cv',
            title: 'Maya Okafor CV 2026',
          }),
          resourceFixture({
            id: 'b',
            type: 'note',
            title: 'Stories for interviews',
            status: 'processing',
            itemCount: 0,
          }),
          resourceFixture({
            id: 'c',
            type: 'link',
            title: 'Conference talk',
            status: 'failed',
            failure: 'link-unreadable',
            itemCount: 0,
          }),
          resourceFixture({ id: 'd', type: 'document', title: 'Review 2025' }),
        ]}
      />,
    );

    const rows = screen.getAllByRole('listitem');
    expect(rows.map(row => row.textContent)).toEqual([
      'profile.typeCvMaya Okafor CV 2026profile.statusReady',
      'profile.typeNoteStories for interviewsprofile.statusProcessing',
      'profile.typeLinkConference talkprofile.failedLinkUnreadable',
      'profile.typeDocumentReview 2025profile.statusReady',
    ]);
    expect(
      within(rows[0]).getByText('Maya Okafor CV 2026'),
    ).toBeInTheDocument();
  });

  it('leads from each resource to its page', () => {
    renderWithProviders(
      <ResourceList
        resources={[
          resourceFixture({ id: 'TuZHzAder2S8', title: 'Maya Okafor CV 2026' }),
          resourceFixture({ id: 'b', title: 'Review 2025' }),
        ]}
      />,
    );

    expect(
      screen.getAllByRole('link').map(link => link.getAttribute('href')),
    ).toEqual(['/profile/resources/TuZHzAder2S8', '/profile/resources/b']);
    expect(
      screen.getByRole('link', { name: /Maya Okafor CV 2026/ }),
    ).toHaveAttribute('href', '/profile/resources/TuZHzAder2S8');
  });

  it('has a heading that counts them against the limit', () => {
    renderWithProviders(<ResourceList resources={[resourceFixture()]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'profile.resourcesTitle' }),
    ).toBeInTheDocument();
  });

  it('lets a long title wrap instead of widening the page', () => {
    renderWithProviders(
      <ResourceList
        resources={[resourceFixture({ title: 'a'.repeat(100) })]}
      />,
    );

    expect(screen.getByText('a'.repeat(100))).toHaveClass('wrap-anywhere');
  });
});
