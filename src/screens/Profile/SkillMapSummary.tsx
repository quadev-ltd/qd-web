import { useTranslation } from 'react-i18next';

import ButtonLink from '@/components/ui/ButtonLink';
import Card from '@/components/ui/Card';
import { SKILL_MAP_KINDS, type SkillMapItem } from '@/core/profile/contract';
import { SKILL_MAP_PATH } from '@/core/profile/paths';

const KIND_KEYS = {
  skill: 'profile.kindSkills',
  experience: 'profile.kindExperience',
  project: 'profile.kindProjects',
  achievement: 'profile.kindAchievements',
  story: 'profile.kindStories',
} as const;

/**
 * What the resources added up to so far: how many items of each kind the skill map has, and
 * the way into it.
 */
export const SkillMapSummary: React.FC<{ items: SkillMapItem[] }> = ({
  items,
}) => {
  const { t } = useTranslation();
  return (
    <Card as="section" elevation="raised" className="gap-3 p-4">
      <div className="flex items-baseline gap-2">
        <h2 className="flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('profile.skillMapTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('profile.skillMapCount', { count: items.length })}
        </p>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(min(96px,100%),1fr))] gap-2">
        {SKILL_MAP_KINDS.map(kind => (
          <div
            key={kind}
            className="flex flex-col-reverse rounded-control bg-background px-3 py-2.5">
            <dt className="text-[13px] leading-normal text-muted">
              {t(KIND_KEYS[kind])}
            </dt>
            <dd className="font-display text-[22px] leading-normal font-semibold text-primary">
              {items.filter(item => item.kind === kind).length}
            </dd>
          </div>
        ))}
      </dl>
      <ButtonLink
        to={SKILL_MAP_PATH}
        variant="secondary"
        size="small"
        className="text-[15px]">
        {t('profile.openSkillMapButton')}
      </ButtonLink>
    </Card>
  );
};

export default SkillMapSummary;
