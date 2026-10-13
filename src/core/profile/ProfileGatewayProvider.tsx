import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { type ProfileGateway } from './gateway';
import { selectProfileGateway } from './selectProfileGateway';
import { unavailableProfileGateway } from './unavailableProfileGateway';

/** Without a provider (e.g. in a test), the profile is unavailable. */
const ProfileGatewayContext = createContext<ProfileGateway>(
  unavailableProfileGateway,
);

export interface ProfileGatewayProviderProps {
  /** A specific gateway (tests). By default the one chosen by VITE_AUTH_GATEWAY. */
  gateway?: ProfileGateway;
  /** Shown while the chosen gateway is being loaded. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Gives the profile screens their gateway. It is mounted around those screens only, not
 * around the application: the preview and the Firebase gateways are separate files, and
 * the Firebase one brings the Functions, App Check and Storage parts of the SDK, which no
 * other page needs. Until the chosen one has arrived, `fallback` is shown.
 */
export const ProfileGatewayProvider: React.FC<ProfileGatewayProviderProps> = ({
  gateway,
  fallback = null,
  children,
}) => {
  const [selected] = useState(() => gateway ?? selectProfileGateway());
  const [loaded, setLoaded] = useState<ProfileGateway | null>(
    selected instanceof Promise ? null : selected,
  );

  useEffect(() => {
    if (!(selected instanceof Promise)) {
      return undefined;
    }
    let active = true;
    selected.then(value => {
      if (active) {
        setLoaded(value);
      }
    });
    return () => {
      active = false;
    };
  }, [selected]);

  const current = gateway ?? loaded;
  if (!current) {
    return fallback;
  }
  return (
    <ProfileGatewayContext.Provider value={current}>
      {children}
    </ProfileGatewayContext.Provider>
  );
};

/** The profile gateway: the resources, the skill map and the changes to them. */
export const useProfileGateway = (): ProfileGateway =>
  useContext(ProfileGatewayContext);

export default ProfileGatewayProvider;
