// The app-link files under public/.well-known tie quadev.net to the mobile apps
// (Android App Links, iOS Universal Links). They must be deployed byte for byte.
//
// This check fails when a source file differs from its pinned SHA-256, or when the
// build output does not contain an identical copy.
//
//   node scripts/check-well-known.mjs                 source and build output in dist/ (run after `yarn build`)
//   node scripts/check-well-known.mjs <folder>        source and build output in <folder>
//   node scripts/check-well-known.mjs --source-only   source files only
//
// The folder is relative to the repository root (or absolute); it holds any build: the
// files are the same in every mode (`yarn build`, `yarn build:dev`).
//
// Changing one of the files on purpose means updating its hash here in the same commit.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_SHA256 = {
  'apple-app-site-association':
    '5cb86e0589fb7b4ee8ea344f270422eb0e7bd1fb4727aeafa905b70be82a08da',
  'assetlinks.json':
    '5ed68b344aeff3e865aee9adab5016fddce9f30850fb6539c8fe8f7a5b2f0f68',
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const sourceOnly = args.includes('--source-only');
const positional = args.filter(arg => !arg.startsWith('--'));
const unknown = args.filter(
  arg => arg.startsWith('--') && arg !== '--source-only',
);
if (unknown.length > 0 || positional.length > 1) {
  console.error(
    'Usage: node scripts/check-well-known.mjs [<build output folder>] [--source-only]',
  );
  process.exit(1);
}
// Named relative to the repository when it is inside it (`dist`), in full otherwise.
const outputPath = resolve(root, positional[0] ?? 'dist');
const output = relative(root, outputPath).startsWith('..')
  ? outputPath
  : relative(root, outputPath);
const folders = sourceOnly ? ['public'] : ['public', output];

const sha256 = file =>
  createHash('sha256').update(readFileSync(file)).digest('hex');

const problems = [];
for (const folder of folders) {
  for (const [name, expected] of Object.entries(EXPECTED_SHA256)) {
    const file = resolve(root, folder, '.well-known', name);
    if (!existsSync(file)) {
      problems.push(`${folder}/.well-known/${name} is missing`);
    } else if (sha256(file) !== expected) {
      problems.push(
        `${folder}/.well-known/${name} has changed (SHA-256 differs)`,
      );
    }
  }
}

if (problems.length > 0) {
  console.error(`.well-known check failed:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.info(`.well-known check passed (${folders.join(', ')}).`);
