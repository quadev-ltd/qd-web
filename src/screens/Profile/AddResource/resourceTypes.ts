import { type ProfileResourceType } from '@/core/profile/contract';

/** The translation key of the name of each type of resource. */
export const RESOURCE_TYPE_KEYS = {
  cv: 'profile.typeCv',
  document: 'profile.typeDocument',
  note: 'profile.typeNote',
  link: 'profile.typeLink',
} as const satisfies Record<ProfileResourceType, string>;

/** The icon of each type of resource. */
export const RESOURCE_TYPE_ICONS = {
  cv: 'file',
  document: 'file',
  note: 'text',
  link: 'link',
} as const satisfies Record<ProfileResourceType, string>;
