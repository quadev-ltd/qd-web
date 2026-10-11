import { useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import { RouterProvider } from 'react-router';

import { createRouter } from './routes';

import { env } from '@/core/env';
import { i18n } from '@/core/i18n/i18n';
import { setUpLogger } from '@/core/logger';

setUpLogger(env.APPLICATION_ENVIRONMENT);

export const App: React.FC = () => {
  const [router] = useState(createRouter);
  return (
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>
  );
};

export default App;
