import { render, screen } from '@testing-library/react';

import { ItemRow } from './ItemRow';

import { type SkillMapKind } from '@/core/profile/contract';
import { itemFixture } from '@/testUtil/profileFixtures';

describe('ItemRow', () => {
  it('shows what the item says and where it came from', () => {
    render(
      <ItemRow
        item={itemFixture({ text: 'Go and PostgreSQL in production.' })}
        source="Maya Okafor CV 2026"
      />,
    );

    expect(
      screen.getByText('Go and PostgreSQL in production.'),
    ).toBeInTheDocument();
    expect(screen.getByText('resource.itemSource')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('marks a starred item with a star that says so', () => {
    render(<ItemRow item={itemFixture({ starred: true })} source="CV" />);

    expect(
      screen.getByRole('img', { name: 'resource.starredAccessibilityLabel' }),
    ).toHaveAttribute('fill', 'currentColor');
  });

  it('marks an edited item', () => {
    render(<ItemRow item={itemFixture({ edited: true })} source="CV" />);

    expect(screen.getByText('resource.editedChip')).toBeInTheDocument();
  });

  it('marks a hidden item, greyed out, in place of the star', () => {
    render(
      <ItemRow
        item={itemFixture({ hidden: true, starred: true, text: 'Hidden fact' })}
        source="CV"
      />,
    );

    expect(
      screen.getByRole('img', { name: 'resource.hiddenAccessibilityLabel' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('img', { name: 'resource.starredAccessibilityLabel' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('resource.hiddenChip')).toBeInTheDocument();
    expect(screen.getByText('Hidden fact')).toHaveClass('text-muted');
  });

  it.each([
    ['skill', 'resource.kindSkill'],
    ['experience', 'resource.kindExperience'],
    ['project', 'resource.kindProject'],
    ['achievement', 'resource.kindAchievement'],
    ['story', 'resource.kindStory'],
  ] as [SkillMapKind, string][])(
    'says it is a %s when asked to',
    (kind, key) => {
      render(<ItemRow item={itemFixture({ kind })} source="CV" showKind />);

      expect(screen.getByText(key)).toBeInTheDocument();
    },
  );

  it('does not say the kind by default: a list by kind already does', () => {
    render(<ItemRow item={itemFixture({ kind: 'story' })} source="CV" />);

    expect(screen.queryByText('resource.kindStory')).not.toBeInTheDocument();
  });
});
