// The preview auth gateway (src/core/auth/previewGateway.ts) is an in-memory fake for local
// preview and tests. It must never be deployed.
//
// This check fails when the production build output contains its marker string, which
// would mean the bundler kept the file. Run it after `yarn build`:
//
//   node scripts/check-bundle.mjs             checks dist/
//   node scripts/check-bundle.mjs <folder>    checks <folder> (relative to the repository root, or absolute)
//
// Only for production builds (`yarn build`, mode prod). A dev build (`yarn build:dev`,
// .env.dev) is configured with the preview gateway and contains it on purpose, so this
// check fails on it by design.
//
// The marker is read from the source file, so the two cannot drift apart.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const offenders = textFiles.filter(file =>
  readFileSync(file, 'utf8').includes(marker),
);

if (offenders.length > 0) {
  console.error(
    `Bundle check failed: the preview auth gateway is in the build output:\n- ${offenders
      .map(file => join(distName, relative(dist, file)))
      .join('\n- ')}`,
  );
  process.exit(1);
}
console.info(
  `Bundle check passed: no preview auth gateway in ${distName}/ (${textFiles.length} files).`,
);
