// The preview auth gateway (src/core/auth/previewGateway.ts) is an in-memory fake for local
// preview and tests. It must never be deployed.
//
// This check fails when the production build output (dist/) contains its marker string,
// which would mean the bundler kept the file. Run it after `yarn build`:
//
//   node scripts/check-bundle.mjs
//
// The marker is read from the source file, so the two cannot drift apart.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
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
    'Bundle check failed: dist/ is missing. Run `yarn build` first.',
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
      .map(file => relative(root, file))
      .join('\n- ')}`,
  );
  process.exit(1);
}
console.info(
  `Bundle check passed: no preview auth gateway in dist/ (${textFiles.length} files).`,
);
