// Checks what a production build contains. Run it after `yarn build`:
//
//   node scripts/check-bundle.mjs             checks dist/
//   node scripts/check-bundle.mjs <folder>    checks <folder> (relative to the repository root, or absolute)
//
// 1. The preview auth gateway (src/core/auth/previewGateway.ts) is an in-memory fake for
//    local preview and tests. It must never be deployed: the check fails when the output
//    contains its marker string, which would mean the bundler kept the file. The marker is
//    read from the source file, so the two cannot drift apart.
// 2. While the account screens are off (VITE_ACCOUNT_ENABLED is not "true" in the production
//    configuration), the output must contain no Firebase code: the check fails when it
//    finds the addresses the Firebase SDK calls. They are first looked up in the installed
//    SDK, so an SDK that stops using them fails the check instead of passing it unseen.
//    With the account screens on, Firebase is expected and this part is skipped.
//
// Only for production builds (`yarn build`, mode prod). A dev build (`yarn build:dev`,
// .env.dev) is configured with the preview gateway and contains it on purpose, so this
// check fails on it by design.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => arg.startsWith('--'))) {
  console.error('Usage: node scripts/check-bundle.mjs [<build output folder>]');
  process.exit(1);
}
const dist = resolve(root, args[0] ?? 'dist');
// Named relative to the repository when it is inside it (`dist`), in full otherwise.
const distName = relative(root, dist).startsWith('..')
  ? dist
  : relative(root, dist);
const source = join(root, 'src', 'core', 'auth', 'previewGateway.ts');

const markerMatch = /PREVIEW_GATEWAY_MARKER = '([^']+)'/.exec(
  readFileSync(source, 'utf8'),
);
if (!markerMatch) {
  console.error(
    'Bundle check failed: PREVIEW_GATEWAY_MARKER not found in previewGateway.ts.',
  );
  process.exit(1);
}
const marker = markerMatch[1];

if (!existsSync(dist)) {
  console.error(
    `Bundle check failed: ${distName}/ is missing. Run \`yarn build\` first.`,
  );
  process.exit(1);
}

const filesIn = folder =>
  readdirSync(folder).flatMap(name => {
    const file = join(folder, name);
    return statSync(file).isDirectory() ? filesIn(file) : [file];
  });

const textFiles = filesIn(dist).filter(file =>
  /\.(js|mjs|css|html|json|map)$/.test(file),
);
const filesContaining = text =>
  textFiles
    .filter(file => readFileSync(file, 'utf8').includes(text))
    .map(file => join(distName, relative(dist, file)));

const offenders = filesContaining(marker);
if (offenders.length > 0) {
  console.error(
    `Bundle check failed: the preview auth gateway is in the build output:\n- ${offenders.join('\n- ')}`,
  );
  process.exit(1);
}

// The addresses the Firebase SDK calls, each with the package it comes from.
const FIREBASE_ADDRESSES = [
  ['identitytoolkit.googleapis.com', '@firebase/auth'],
  ['securetoken.googleapis.com', '@firebase/auth'],
  ['firestore.googleapis.com', '@firebase/firestore'],
];
// The production configuration, read as the build read it (.env.prod, then the environment).
const accountEnabled =
  loadEnv('prod', root, 'VITE_').VITE_ACCOUNT_ENABLED === 'true';

if (accountEnabled) {
  console.info(
    `Bundle check passed: no preview auth gateway in ${distName}/ (${textFiles.length} files). The account screens are on, so Firebase is expected and was not looked for.`,
  );
  process.exit(0);
}

for (const [address, packageName] of FIREBASE_ADDRESSES) {
  const packageDist = join(root, 'node_modules', packageName, 'dist');
  const inSdk =
    existsSync(packageDist) &&
    filesIn(packageDist).some(
      file =>
        /\.(js|mjs|cjs)$/.test(file) &&
        readFileSync(file, 'utf8').includes(address),
    );
  if (!inSdk) {
    console.error(
      `Bundle check failed: "${address}" is not in ${packageName} any more, so this check cannot recognise Firebase code. Update FIREBASE_ADDRESSES in scripts/check-bundle.mjs.`,
    );
    process.exit(1);
  }
  const found = filesContaining(address);
  if (found.length > 0) {
    console.error(
      `Bundle check failed: the account screens are off (VITE_ACCOUNT_ENABLED), but Firebase code ("${address}") is in the build output:\n- ${found.join('\n- ')}`,
    );
    process.exit(1);
  }
}
console.info(
  `Bundle check passed: no preview auth gateway and no Firebase code in ${distName}/ (${textFiles.length} files).`,
);
