import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import Card from '@/components/ui/Card';
import FilterChip from '@/components/ui/FilterChip';
import SearchField from '@/components/ui/SearchField';
import {
  type ProfileResource,
  SKILL_MAP_KINDS,
  type SkillMapKind,
} from '@/core/profile/contract';
import { type SkillMapFilter } from '@/core/profile/skillMapFilter';

/** The translation key of each kind of item, for a group of them. */
export const KIND_GROUP_KEYS = {
  skill: 'profile.kindSkills',
  experience: 'profile.kindExperience',
  project: 'profile.kindProjects',
  achievement: 'profile.kindAchievements',
  story: 'profile.kindStories',
} as const satisfies Record<SkillMapKind, string>;

export interface SkillMapFiltersProps {
  filter: SkillMapFilter;
  /** How many items each kind would show with the rest of the filter as it is. */
  counts: Record<SkillMapKind | 'all', number>;
  /** The resources that have items: the choices of "Source". */
  resources: ProfileResource[];
  onChange: (filter: SkillMapFilter) => void;
}

/**
 * The search and the filters of the skill map: a kind, where an item came from, and the
 * starred, edited or hidden ones. A column beside the list on a wide screen; above it on a
 * narrow one, where the kinds become a row of chips that scrolls sideways.
 */
export const SkillMapFilters: React.FC<SkillMapFiltersProps> = ({
  filter,
  counts,
  resources,
  onChange,
}) => {
  const { t } = useTranslation();
  const sourceId = useId();
  const kinds = [
    { value: 'all' as const, label: t('skillMap.kindAll') },
    ...SKILL_MAP_KINDS.map(value => ({
      value,
      label: t(KIND_GROUP_KEYS[value]),
    })),
  ];

  return (
    <Card elevation="raised" className="gap-3 p-4">
      <SearchField
        label={t('skillMap.searchLabel')}
        value={filter.query}
        onChange={query => onChange({ ...filter, query })}
      />
      <div
        role="group"
        aria-label={t('skillMap.kindGroupLabel')}
        className="flex gap-0.5 overflow-x-auto min-[901px]:flex-col min-[901px]:overflow-visible">
        {kinds.map(({ value, label }) => {
          const pressed = filter.kind === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange({ ...filter, kind: value })}
              className={`flex h-11 flex-none cursor-pointer items-center gap-2 rounded-[10px] px-3 text-[15px] leading-natural ${
                pressed
                  ? 'bg-tint font-bold text-primary-dark'
                  : 'font-medium text-text hover:bg-background'
              }`}>
              <span className="flex-1 text-left whitespace-nowrap">
                {label}
              </span>
              <span className="font-normal text-muted">{counts[value]}</span>
            </button>
          );
        })}
      </div>
      <div className="h-px bg-border-faint" />
      <div
        role="group"
        aria-label={t('skillMap.showGroupLabel')}
        className="flex flex-wrap gap-2">
        <FilterChip
          icon="star"
          pressed={filter.starred}
          onClick={() => onChange({ ...filter, starred: !filter.starred })}>
          {t('skillMap.starredFilter')}
        </FilterChip>
        <FilterChip
          pressed={filter.edited}
          onClick={() => onChange({ ...filter, edited: !filter.edited })}>
          {t('skillMap.editedFilter')}
        </FilterChip>
        <FilterChip
          icon="eyeOff"
          pressed={filter.hidden}
          onClick={() => onChange({ ...filter, hidden: !filter.hidden })}>
          {t('skillMap.hiddenFilter')}
        </FilterChip>
      </div>
      {resources.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={sourceId}
            className="text-sm leading-natural font-medium">
            {t('skillMap.sourceLabel')}
          </label>
          <select
            id={sourceId}
            value={filter.resourceId}
            onChange={event =>
              onChange({ ...filter, resourceId: event.target.value })
            }
            className="h-11 min-w-0 cursor-pointer rounded-control border border-border-strong bg-surface px-3 text-[15px] text-text">
            <option value="all">{t('skillMap.sourceAll')}</option>
            {resources.map(resource => (
              <option key={resource.id} value={resource.id}>
                {resource.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </Card>
  );
};

export default SkillMapFilters;
