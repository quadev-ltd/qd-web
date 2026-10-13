import { useTranslation } from 'react-i18next';

import { RESOURCE_TYPE_ICONS, RESOURCE_TYPE_KEYS } from './resourceTypes';

import Chip from '@/components/ui/Chip';
import { type ProfileResourceType } from '@/core/profile/contract';

/** "Type: CV", where there is nothing to choose: a link is a link, and "Add your CV" adds a CV. */
export const FixedType: React.FC<{ type: ProfileResourceType }> = ({
  type,
}) => {
  const { t } = useTranslation();
  return (
    <p className="flex items-center gap-2.5 text-sm leading-natural font-medium">
      {t('addResource.typeLabel')}
      <Chip tone="brand" icon={RESOURCE_TYPE_ICONS[type]}>
        {t(RESOURCE_TYPE_KEYS[type])}
      </Chip>
    </p>
  );
};

export default FixedType;
