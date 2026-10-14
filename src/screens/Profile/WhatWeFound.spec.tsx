import { render, screen } from '@testing-library/react';

import { WhatWeFound } from './WhatWeFound';

import { itemFixture } from '@/testUtil/profileFixtures';

const count = (label: string) =>
  screen.getByText(label).parentElement?.querySelector('dd')?.textContent;

describe('WhatWeFound', () => {
  it('counts the items of each kind, hidden ones included', () => {
    render(
      <WhatWeFound
        items={[
          itemFixture({ id: '1', kind: 'skill' }),
          itemFixture({ id: '2', kind: 'skill', hidden: true }),
          itemFixture({ id: '3', kind: 'skill' }),
          itemFixture({ id: '4', kind: 'experience' }),
          itemFixture({ id: '5', kind: 'achievement' }),
          itemFixture({ id: '6', kind: 'achievement' }),
          itemFixture({ id: '7', kind: 'story' }),
        ]}
      />,
    );

    expect(count('profile.kindSkills')).toBe('3');
    expect(count('profile.kindExperience')).toBe('1');
    expect(count('profile.kindProjects')).toBe('0');
    expect(count('profile.kindAchievements')).toBe('2');
    expect(count('profile.kindStories')).toBe('1');
  });

  it('lists the five kinds in the same order as a resource’s page, also when nothing was found', () => {
    render(<WhatWeFound items={[]} />);

    expect(screen.getAllByRole('term').map(term => term.textContent)).toEqual([
      'profile.kindSkills',
      'profile.kindExperience',
      'profile.kindProjects',
      'profile.kindAchievements',
      'profile.kindStories',
    ]);
    expect(
      screen.getAllByRole('definition').map(value => value.textContent),
    ).toEqual(['0', '0', '0', '0', '0']);
  });

  it('has its heading, the total, and where to see the items: it is not a link', () => {
    render(<WhatWeFound items={[itemFixture()]} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'profile.foundTitle' }),
    ).toBeInTheDocument();
    expect(screen.getByText('profile.foundCount')).toBeInTheDocument();
    expect(screen.getByText('profile.foundDescription')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
