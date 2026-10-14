import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ITEMS_SHOWN, WhatWeRead } from './WhatWeRead';

import { type SkillMapItem } from '@/core/profile/contract';
import { itemFixture } from '@/testUtil/profileFixtures';

const many = (kind: SkillMapItem['kind'], count: number) =>
  Array.from({ length: count }, (_, index) =>
    itemFixture({
      id: `${kind}-${index}`,
      kind,
      text: `${kind} ${index}`,
      createdAt: index,
    }),
  );

const block = (name: string) => screen.getByRole('region', { name });

describe('WhatWeRead', () => {
  it('has its heading, the total, and what the items are for', () => {
    render(<WhatWeRead items={many('skill', 2)} />);

    const card = screen.getByRole('region', { name: 'resource.readTitle' });
    expect(
      within(card).getByRole('heading', {
        level: 2,
        name: 'resource.readTitle',
      }),
    ).toBeInTheDocument();
    expect(card).toHaveTextContent('resource.readCount');
    expect(card).toHaveTextContent('resource.readDescription');
  });

  it('groups the items by kind, in the order of the profile, and leaves out the kinds it has none of', () => {
    render(
      <WhatWeRead
        items={[
          ...many('story', 1),
          ...many('achievement', 2),
          ...many('skill', 2),
          ...many('experience', 1),
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map(heading => heading.textContent),
    ).toEqual([
      'profile.kindSkills',
      'profile.kindExperience',
      'profile.kindAchievements',
      'profile.kindStories',
    ]);
    expect(block('profile.kindAchievements')).toHaveTextContent('2');
  });

  it('shows the skills as tags, every one of them, with nothing to open', () => {
    render(<WhatWeRead items={many('skill', 12)} />);

    const skills = block('profile.kindSkills');
    expect(within(skills).getAllByRole('listitem')).toHaveLength(12);
    expect(within(skills).queryByRole('button')).not.toBeInTheDocument();
  });

  it(`shows ${ITEMS_SHOWN} items of a kind, and the rest on "Show all"`, async () => {
    render(<WhatWeRead items={many('project', 6)} />);

    const projects = block('profile.kindProjects');
    expect(within(projects).getAllByRole('listitem')).toHaveLength(ITEMS_SHOWN);

    await userEvent.click(
      within(projects).getByRole('button', {
        name: 'resource.showAllButton',
      }),
    );

    expect(within(projects).getAllByRole('listitem')).toHaveLength(6);
    expect(
      within(projects).queryByRole('button', {
        name: 'resource.showAllButton',
      }),
    ).not.toBeInTheDocument();
  });

  it(`does not offer "Show all" for ${ITEMS_SHOWN} items or fewer`, () => {
    render(<WhatWeRead items={many('experience', ITEMS_SHOWN)} />);

    expect(
      screen.queryByRole('button', { name: 'resource.showAllButton' }),
    ).not.toBeInTheDocument();
  });

  it('opens an item to show the passage it was read from, and closes it again', async () => {
    render(
      <WhatWeRead
        items={[
          itemFixture({
            kind: 'achievement',
            text: 'Cut payment incidents by 40%.',
            evidence: 'Reduced Sev-1 and Sev-2 payment incidents 40%.',
          }),
        ]}
      />,
    );

    const row = screen.getByRole('button', {
      name: 'Cut payment incidents by 40%.',
    });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('Reduced Sev-1 and Sev-2 payment incidents 40%.'),
    ).not.toBeVisible();

    await userEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'true');
    const passage = document.getElementById(
      row.getAttribute('aria-controls') ?? '',
    ) as HTMLElement;
    expect(passage).toBeVisible();
    expect(passage).toHaveTextContent('resource.passageLabel');
    expect(passage).toHaveTextContent(
      'Reduced Sev-1 and Sev-2 payment incidents 40%.',
    );

    await userEvent.click(row);

    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(passage).not.toBeVisible();
  });

  it('shows an item without a passage as plain text, with nothing to open', () => {
    render(
      <WhatWeRead
        items={[itemFixture({ kind: 'story', text: 'A story', evidence: '' })]}
      />,
    );

    expect(screen.getByText('A story')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
