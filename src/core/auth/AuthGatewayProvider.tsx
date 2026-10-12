import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import { type AuthGateway } from './gateway';
import { selectAuthGateway } from './selectAuthGateway';
import { unavailableGateway } from './unavailableGateway';

/** Without a provider (e.g. in a test), sign-in is unavailable. */
const AuthGatewayContext = createContext<AuthGateway>(unavailableGateway);

export interface AuthGatewayProviderProps {
  /** A specific gateway (tests). By default the one chosen by VITE_AUTH_GATEWAY. */
  gateway?: AuthGateway;
  children: ReactNode;
}

/**
 * Gives the account screens and the session their auth gateway. Mount it once, above
 * SessionProvider. The preview and the Firebase gateways are separate files loaded on
 * demand, so nothing below is rendered until the chosen one has arrived; the default
 * gateway is available at once.
 */
export const AuthGatewayProvider: React.FC<AuthGatewayProviderProps> = ({
  gateway,
  children,
}) => {
  const [selected] = useState(() => gateway ?? selectAuthGateway());
  const [loaded, setLoaded] = useState<AuthGateway | null>(
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
    return null;
  }
  return (
    <AuthGatewayContext.Provider value={current}>
      {children}
    </AuthGatewayContext.Provider>
  );
};

/** The auth gateway: sign in, sign up, sign out and the session. */
export const useAuthGateway = (): AuthGateway => useContext(AuthGatewayContext);

export default AuthGatewayProvider;
