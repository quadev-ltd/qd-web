import { type SkillMapKind } from '@/core/profile/contract';

/** The translation key of the name of each kind of item, as a heading over several. */
export const KIND_TITLE_KEYS = {
  skill: 'profile.kindSkills',
  experience: 'profile.kindExperience',
  project: 'profile.kindProjects',
  achievement: 'profile.kindAchievements',
  story: 'profile.kindStories',
} as const satisfies Record<SkillMapKind, string>;
