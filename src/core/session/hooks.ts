// Mirrors qd-mobile src/core/session/hooks.ts.
import { useAppSelector } from '@/core/state/hooks';
import {
  selectClaims,
  selectProfile,
  selectSessionStatus,
  selectSessionUser,
} from '@/core/state/selectors/session';

export const useSessionStatus = () => useAppSelector(selectSessionStatus);
export const useSessionUser = () => useAppSelector(selectSessionUser);
export const useProfile = () => useAppSelector(selectProfile);

/**
 * Whether the user has paid features (the `paid` custom claim). Nothing is gated on it yet.
 */
export const usePaidFeatures = () => useAppSelector(selectClaims).paid;
