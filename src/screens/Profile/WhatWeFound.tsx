import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { KIND_TITLE_KEYS } from './kinds';

import Card from '@/components/ui/Card';
import { SKILL_MAP_KINDS, type SkillMapItem } from '@/core/profile/contract';

/**
 * What the resources added up to so far: how many items of each kind were read. Not a link:
 * each resource shows what was read from it (D68: no skill map page for now).
 */
export const WhatWeFound: React.FC<{ items: SkillMapItem[] }> = ({ items }) => {
  const { t } = useTranslation();
  const headingId = useId();
  return (
    <Card
      as="section"
      elevation="raised"
      aria-labelledby={headingId}
      className="gap-3 p-4">
      <div className="flex items-baseline gap-2">
        <h2
          id={headingId}
          className="flex-1 font-display text-[18px] leading-tight font-semibold">
          {t('profile.foundTitle')}
        </h2>
        <p className="text-sm leading-normal text-muted">
          {t('profile.foundCount', { count: items.length })}
        </p>
      </div>
      <dl className="flex flex-col">
        {SKILL_MAP_KINDS.map(kind => (
          <div
            key={kind}
            className="flex items-baseline gap-3 border-border-faint py-2 not-first:border-t">
            <dt className="flex-1 text-[15px] leading-normal">
              {t(KIND_TITLE_KEYS[kind])}
            </dt>
            <dd className="font-display text-[17px] leading-normal font-semibold text-primary">
              {items.filter(item => item.kind === kind).length}
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-sm leading-normal text-muted">
        {t('profile.foundDescription')}
      </p>
    </Card>
  );
};

export default WhatWeFound;
