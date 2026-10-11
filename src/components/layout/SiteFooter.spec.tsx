import { screen, within } from '@testing-library/react';

import { SiteFooter } from './SiteFooter';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

describe('SiteFooter', () => {
  it('shows the copyright line', () => {
    renderWithProviders(<SiteFooter />);

    expect(screen.getByText('footer.copyright')).toBeInTheDocument();
  });

  it('opens an email to the support address', () => {
    renderWithProviders(<SiteFooter />);

    expect(
      screen.getByRole('link', { name: 'support@quadev.net' }),
    ).toHaveAttribute('href', 'mailto:support@quadev.net');
  });

  it('links to the legal pages and to the delete-account page', () => {
    renderWithProviders(<SiteFooter />);

    const nav = screen.getByRole('navigation', {
      name: 'footer.navAccessibilityLabel',
    });
    expect(
      within(nav).getByRole('link', { name: 'footer.privacyPolicy' }),
    ).toHaveAttribute('href', '/privacy-policy');
    expect(
      within(nav).getByRole('link', { name: 'footer.termsAndConditions' }),
    ).toHaveAttribute('href', '/terms-and-conditions');
    expect(
      within(nav).getByRole('link', { name: 'footer.deleteAccount' }),
    ).toHaveAttribute('href', '/delete-account');
  });

  it('shows no postal address and no phone number', () => {
    renderWithProviders(<SiteFooter />);

    expect(screen.queryByText(/address/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/phone/i)).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link')
        .filter(link => link.getAttribute('href')?.startsWith('tel:')),
    ).toHaveLength(0);
  });
});
