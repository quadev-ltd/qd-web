// Key points as text practice shows them (D94), and a mock interview's hints (slice H2): each
// point, with the profile item it states and where that item came from, or "Advice" when it is
// advice. A point whose item was removed since keeps its text without a source.
import { useTranslation } from 'react-i18next';

import Icon from '@/components/Icon';
import Chip from '@/components/ui/Chip';
import { type ProfileResource } from '@/core/profile/contract';
import { type PracticeKeyPoint } from '@/core/profile/practice';
import { ITEM_KIND_KEYS } from '@/screens/Applications/BriefCards';
import useItems from '@/screens/Cv/review/useItems';

export const KeyPointList: React.FC<{
  keyPoints: PracticeKeyPoint[];
  resources: ProfileResource[];
}> = ({ keyPoints, resources }) => {
  const { t } = useTranslation();
  const items = useItems(keyPoints.some(({ itemId }) => itemId));
  return (
    <ul className="flex flex-col gap-3">
      {keyPoints.map((point, index) => {
        const item = point.itemId ? items?.get(point.itemId) : undefined;
        const source = item
          ? resources.find(({ id }) => id === item.resourceId)
          : undefined;
        return (
          <li
            key={`${index}-${point.text}`}
            className="flex flex-col gap-1 border-t border-border-faint pt-3 first:border-t-0 first:pt-0">
            <p className="text-[15px] leading-normal wrap-anywhere">
              {point.text}
            </p>
            {item ? (
              <p className="flex items-center gap-1.5 text-[13px] leading-normal text-muted">
                <Icon name="file" size={14} />
                {source
                  ? t('applications.itemSource', {
                      kind: t(ITEM_KIND_KEYS[item.kind]),
                      title: source.title,
                    })
                  : t(ITEM_KIND_KEYS[item.kind])}
              </p>
            ) : (
              // An item removed since keeps its text without a source (choice 7).
              !point.itemId && (
                <span className="flex">
                  <Chip tone="neutral">{t('applications.adviceChip')}</Chip>
                </span>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default KeyPointList;
