import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SkillMapFilters, type SkillMapFiltersProps } from './SkillMapFilters';

import { NO_FILTER } from '@/core/profile/skillMapFilter';
import { resourceFixture } from '@/testUtil/profileFixtures';

const counts = {
  all: 42,
  skill: 14,
  experience: 9,
  project: 7,
  achievement: 8,
  story: 4,
};
const resources = [
  resourceFixture({ id: 'r1', title: 'Maya Okafor CV 2026' }),
  resourceFixture({ id: 'r2', title: 'Performance review 2025' }),
];

const renderFilters = (props: Partial<SkillMapFiltersProps> = {}) => {
  const onChange = vi.fn();
  render(
    <SkillMapFilters
      filter={NO_FILTER}
      counts={counts}
      resources={resources}
      onChange={onChange}
      {...props}
    />,
  );
  return { onChange };
};

const kinds = () =>
  screen.getByRole('group', { name: 'skillMap.kindGroupLabel' });

describe('SkillMapFilters', () => {
  it('lists the kinds with how many items each would show, "All" first and pressed', () => {
    renderFilters();

    const buttons = within(kinds()).getAllByRole('button');
    expect(buttons.map(button => button.textContent)).toEqual([
      'skillMap.kindAll42',
      'profile.kindSkills14',
      'profile.kindExperience9',
      'profile.kindProjects7',
      'profile.kindAchievements8',
      'profile.kindStories4',
    ]);
    expect(buttons.map(button => button.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
      'false',
      'false',
      'false',
    ]);
  });

  it('chooses a kind, keeping the rest of the filter', async () => {
    const { onChange } = renderFilters({
      filter: { ...NO_FILTER, starred: true },
    });

    await userEvent.click(
      within(kinds()).getByRole('button', { name: /profile\.kindStories/ }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...NO_FILTER,
      starred: true,
      kind: 'story',
    });
  });

  it.each([
    ['skillMap.starredFilter', 'starred'],
    ['skillMap.editedFilter', 'edited'],
    ['skillMap.hiddenFilter', 'hidden'],
  ] as const)('turns %s on and off', async (name, key) => {
    const { onChange } = renderFilters();
    const chip = screen.getByRole('button', { name });
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(chip);

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...NO_FILTER,
      [key]: true,
    });
  });

  it('shows which filters are on', () => {
    renderFilters({
      filter: { ...NO_FILTER, kind: 'skill', hidden: true },
    });

    expect(
      screen.getByRole('button', { name: 'skillMap.hiddenFilter' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(kinds()).getByRole('button', { name: /profile\.kindSkills/ }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      within(kinds()).getByRole('button', { name: /skillMap\.kindAll/ }),
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('searches as the visitor types', async () => {
    const { onChange } = renderFilters();

    await userEvent.type(
      screen.getByRole('searchbox', { name: 'skillMap.searchLabel' }),
      'g',
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...NO_FILTER,
      query: 'g',
    });
  });

  it('narrows to the items of one resource', async () => {
    const { onChange } = renderFilters();
    const source = screen.getByLabelText('skillMap.sourceLabel');
    expect(
      within(source)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual([
      'skillMap.sourceAll',
      'Maya Okafor CV 2026',
      'Performance review 2025',
    ]);

    await userEvent.selectOptions(source, 'Performance review 2025');

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...NO_FILTER,
      resourceId: 'r2',
    });
  });

  it('has no "Source" when everything came from one resource', () => {
    renderFilters({ resources: resources.slice(0, 1) });

    expect(
      screen.queryByLabelText('skillMap.sourceLabel'),
    ).not.toBeInTheDocument();
  });
});
