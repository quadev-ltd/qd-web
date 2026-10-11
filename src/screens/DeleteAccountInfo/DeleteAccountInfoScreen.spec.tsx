import { screen } from '@testing-library/react';

import { DeleteAccountInfoScreen } from './DeleteAccountInfoScreen';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('DeleteAccountInfoScreen', () => {
  it('shows the title and the introduction', () => {
    renderWithProviders(<DeleteAccountInfoScreen />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'deleteAccountInfo.title',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('deleteAccountInfo.description'),
    ).toBeInTheDocument();
  });

  it('lists the steps in the mobile app, in order', () => {
    renderWithProviders(<DeleteAccountInfoScreen />);

    expect(
      screen.getByRole('region', { name: 'deleteAccountInfo.stepsTitle' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map(item => item.textContent),
    ).toEqual([
      'deleteAccountInfo.stepOpenMenu',
      'deleteAccountInfo.stepChooseDelete',
      'deleteAccountInfo.stepConfirm',
    ]);
  });

  it('explains what is erased and that it is permanent', () => {
    renderWithProviders(<DeleteAccountInfoScreen />);

    expect(
      screen.getByRole('region', { name: 'deleteAccountInfo.erasedTitle' }),
    ).toHaveTextContent('deleteAccountInfo.erasedDescription');
    expect(
      screen.getByRole('region', { name: 'deleteAccountInfo.permanentTitle' }),
    ).toHaveTextContent('deleteAccountInfo.permanentDescription');
  });

  it('offers deletion by email to the support address', () => {
    renderWithProviders(<DeleteAccountInfoScreen />);

    const section = screen.getByRole('region', {
      name: 'deleteAccountInfo.emailTitle',
    });
    expect(section).toHaveTextContent('deleteAccountInfo.emailDescription');
    // The footer has the same link, so both are checked.
    const links = screen.getAllByRole('link', { name: 'support@quadev.net' });
    expect(links).toHaveLength(2);
    links.forEach(link =>
      expect(link).toHaveAttribute('href', 'mailto:support@quadev.net'),
    );
    expect(section).toContainElement(links[0]);
  });
});
