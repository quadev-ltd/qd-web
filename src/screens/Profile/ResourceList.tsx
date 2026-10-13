import { useTranslation } from 'react-i18next';

import {
  RESOURCE_TYPE_ICONS,
  RESOURCE_TYPE_KEYS,
} from './AddResource/resourceTypes';
import ResourceStatus from './ResourceStatus';

import Icon from '@/components/Icon';
import Card from '@/components/ui/Card';
import {
  PROFILE_MAX_RESOURCES,
  type ProfileResource,
} from '@/core/profile/contract';

/** The resources of the profile, newest first, each with where it is. */
export const ResourceList: React.FC<{ resources: ProfileResource[] }> = ({
  resources,
}) => {
  const { t } = useTranslation();
  return (
    <Card as="section" elevation="raised" className="p-5">
      <h2 className="font-display text-[18px] leading-tight font-semibold">
        {t('profile.resourcesTitle', {
          count: resources.length,
          max: PROFILE_MAX_RESOURCES,
        })}
      </h2>
      <ul className="flex flex-col">
        {resources.map(resource => (
          <li
            key={resource.id}
            className="flex items-center gap-3 border-border-faint py-3 not-first:border-t">
            <span
              aria-hidden="true"
              className="flex size-10 flex-none items-center justify-center rounded-full bg-tint text-primary">
              <Icon name={RESOURCE_TYPE_ICONS[resource.type]} size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-[13px] leading-normal text-muted">
                {t(RESOURCE_TYPE_KEYS[resource.type])}
              </p>
              <p className="text-base leading-normal font-medium wrap-anywhere">
                {resource.title}
              </p>
              <ResourceStatus resource={resource} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
};

export default ResourceList;
