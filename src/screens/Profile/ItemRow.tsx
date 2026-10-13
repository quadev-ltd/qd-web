import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Chip from '@/components/ui/Chip';
import { type SkillMapItem, type SkillMapKind } from '@/core/profile/contract';

/** The translation key of the name of each kind of item, for one item. */
export const ITEM_KIND_KEYS = {
  skill: 'resource.kindSkill',
  experience: 'resource.kindExperience',
  project: 'resource.kindProject',
  achievement: 'resource.kindAchievement',
  story: 'resource.kindStory',
} as const satisfies Record<SkillMapKind, string>;

export interface ItemRowProps {
  item: SkillMapItem;
  /** The title of the resource the item came from. */
  source: string;
  /** Says what kind of item it is, where the list mixes kinds. */
  showKind?: boolean;
}

/**
 * One item of the skill map in a list: whether it is starred or hidden, what it says, where
 * it came from, and whether the candidate changed it.
 */
export const ItemRow: React.FC<ItemRowProps> = ({
  item,
  source,
  showKind = false,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-3 py-3">
      <span
        className={`flex pt-0.5 ${
          item.starred && !item.hidden ? 'text-primary' : 'text-border-strong'
        }`}>
        {item.hidden ? (
          <span className="flex text-muted">
            <Icon
              name="eyeOff"
              label={t('resource.hiddenAccessibilityLabel')}
            />
          </span>
        ) : (
          <Icon
            name="star"
            filled={item.starred}
            label={
              item.starred ? t('resource.starredAccessibilityLabel') : undefined
            }
          />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p
          className={`text-[15px] leading-normal wrap-anywhere ${
            item.hidden ? 'text-muted' : ''
          }`}>
          {item.text}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[13px] leading-normal text-muted wrap-anywhere">
            {t('resource.itemSource', { title: source })}
          </p>
          {showKind && <Chip tone="brand">{t(ITEM_KIND_KEYS[item.kind])}</Chip>}
          {item.edited && (
            <Chip tone="neutral">{t('resource.editedChip')}</Chip>
          )}
          {item.hidden && (
            <Chip tone="neutral">{t('resource.hiddenChip')}</Chip>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemRow;
