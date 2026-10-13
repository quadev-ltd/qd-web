// The feature flags as Remote Config has them for everyone: the second layer of the
// backend's order (the user's override, then Remote Config, then the code default). The
// owner sets them with quadev-backend's `set-global-flag`, which writes the client template
// this reads and the server template the functions read (docs/operations/releases.md there).
//
// A file of its own, loaded on demand (./flags.ts): the Remote Config part of the SDK is
// only needed once somebody is signed in.
import {
  fetchAndActivate,
  getRemoteConfig,
  getValue,
} from 'firebase/remote-config';

import { app } from './app';

import { env } from '@/core/env';
import {
  DEFAULT_FLAGS,
  FLAG_KEYS,
  type FlagValues,
} from '@/core/flags/registry';

/**
 * How long a fetched template is trusted. A release, or a flag switched off for everyone,
 * reaches an open browser within the hour; the functions follow within a minute, and they
 * have the last word.
 */
export const REMOTE_FLAGS_MAX_AGE_MS = 60 * 60 * 1000;
/** A page that waits for its flags must not wait long for a slow network. */
export const REMOTE_FLAGS_TIMEOUT_MS = 5000;

/**
 * The flags Remote Config sets, and only those: a flag the template does not mention is
 * left out, so the code default decides. Against the local emulators there is no Remote
 * Config (the backend skips it there too), so nothing is set.
 */
export const getRemoteFlags = async (): Promise<FlagValues> => {
  if (env.USE_FIREBASE_EMULATORS) {
    return {};
  }
  const remoteConfig = getRemoteConfig(app());
  remoteConfig.settings.minimumFetchIntervalMillis = REMOTE_FLAGS_MAX_AGE_MS;
  remoteConfig.settings.fetchTimeoutMillis = REMOTE_FLAGS_TIMEOUT_MS;
  remoteConfig.defaultConfig = DEFAULT_FLAGS;
  await fetchAndActivate(remoteConfig);

  const flags: FlagValues = {};
  for (const key of FLAG_KEYS) {
    const value = getValue(remoteConfig, key);
    if (value.getSource() === 'remote') {
      flags[key] = value.asBoolean();
    }
  }
  return flags;
};
