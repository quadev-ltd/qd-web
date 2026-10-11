import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { createRouter } from './routes';

import { AuthGatewayProvider } from '@/core/auth/AuthGatewayProvider';
import { env } from '@/core/env';
import { FlagsProvider } from '@/core/flags/FlagsProvider';
import { i18n } from '@/core/i18n/i18n';
import { setUpLogger } from '@/core/logger';
import { SessionProvider } from '@/core/session/SessionProvider';
import { createStore } from '@/core/state/store';

setUpLogger(env.APPLICATION_ENVIRONMENT);

// The same provider order as the mobile app (qd-mobile src/App.tsx), with the auth gateway
// where the app has its Firebase service modules.
export const App: React.FC = () => {
  const [store] = useState(createStore);
  const [router] = useState(createRouter);
  return (
    <I18nextProvider i18n={i18n}>
      <Provider store={store}>
        <AuthGatewayProvider>
          <SessionProvider>
            <FlagsProvider>
              <RouterProvider router={router} />
            </FlagsProvider>
          </SessionProvider>
        </AuthGatewayProvider>
      </Provider>
    </I18nextProvider>
  );
};

export default App;
