import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// The variables src/core/env.ts cannot start without. A build with one missing
// would deploy a blank page, so the build fails instead.
const REQUIRED_ENV = ['VITE_APPLICATION_NAME', 'VITE_APPLICATION_ENVIRONMENT'];
// Also required when VITE_AUTH_GATEWAY=firebase (the same list as FIREBASE_SETTINGS in
// src/core/env.ts).
const REQUIRED_FIREBASE_ENV = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
];

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    const fileEnv = loadEnv(mode, process.cwd(), 'VITE_');
    const missing = [
      ...REQUIRED_ENV,
      ...(fileEnv.VITE_AUTH_GATEWAY === 'firebase'
        ? REQUIRED_FIREBASE_ENV
        : []),
    ].filter(key => !fileEnv[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing ${missing.join(', ')} for mode "${mode}". Build with \`yarn build\` (mode prod, .env.prod); see .env.example.`,
      );
    }
    // The preview auth gateway is an in-memory fake for local preview and tests. It must
    // never be deployed: a production build that asks for it fails here.
    const isProduction =
      mode === 'prod' || fileEnv.VITE_APPLICATION_ENVIRONMENT === 'prod';
    if (isProduction && fileEnv.VITE_AUTH_GATEWAY === 'preview') {
      throw new Error(
        'VITE_AUTH_GATEWAY=preview is not allowed in a production build. Use "unavailable" or "firebase" (see .env.prod).',
      );
    }
    // The emulators are local test doubles of Firebase: a production build never uses them.
    if (isProduction && fileEnv.VITE_USE_FIREBASE_EMULATORS === 'true') {
      throw new Error(
        'VITE_USE_FIREBASE_EMULATORS=true is not allowed in a production build.',
      );
    }
  }

  return {
    plugins: [react(), tailwindcss()],
    // The App Check debug token is a secret that stands in for reCAPTCHA on a developer's
    // machine (src/core/firebase/appCheck.ts). Vite would copy it into the JavaScript of a
    // build, where any visitor could read it, so every build gets an empty value instead:
    // only the development server (`yarn start:dev`) passes it on.
    define:
      command === 'build'
        ? { 'import.meta.env.VITE_APPCHECK_DEBUG_TOKEN': JSON.stringify('') }
        : {},
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3000,
    },
    build: {
      // Deployed by .github/workflows/main.yml (SOURCE_DIR) and by Firebase Hosting
      // (firebase.json, `public`).
      outDir: 'dist',
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      include: ['src/**/*.spec.{ts,tsx}'],
    },
  };
});
