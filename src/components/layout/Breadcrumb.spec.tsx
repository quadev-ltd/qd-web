import { screen, within } from '@testing-library/react';

import Breadcrumb from './Breadcrumb';

import { renderWithProviders } from '@/testUtil/renderWithProviders';

const steps = [
  { label: 'Applications', to: '/applications' },
  { label: 'Senior Backend Engineer', to: '/applications/a1' },
  { label: 'CV', to: '/applications/a1/cv' },
];

describe('Breadcrumb', () => {
  it('lists the way there, each step a link, with the separators hidden from screen readers', () => {
    renderWithProviders(<Breadcrumb steps={steps} />);

    const way = screen.getByRole('navigation', { name: 'breadcrumb.label' });
    const items = within(way).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(
      within(way)
        .getAllByRole('link')
        .map(link => [link.textContent, link.getAttribute('href')]),
    ).toEqual(steps.map(({ label, to }) => [label, to]));
    // The separators: one before every step but the first, hidden.
    expect(way.querySelectorAll('span[aria-hidden="true"]')).toHaveLength(2);
    // Hidden at 720 px and below.
    expect(way).toHaveClass('max-[720px]:hidden');
  });

  it('has one link back to the page before for a phone, named as given', () => {
    renderWithProviders(
      <Breadcrumb steps={steps} backLabel="Senior Backend Engineer · CV" />,
    );

    const back = screen.getByRole('link', {
      name: 'Senior Backend Engineer · CV',
    });
    expect(back).toHaveAttribute('href', '/applications/a1/cv');
    expect(back).toHaveClass('hidden', 'max-[720px]:flex');
  });

  it('names the phone’s link after the last step when nothing else is given', () => {
    renderWithProviders(<Breadcrumb steps={steps} />);

    const links = screen.getAllByRole('link', { name: 'CV' });
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveAttribute('href', '/applications/a1/cv');
  });
});
