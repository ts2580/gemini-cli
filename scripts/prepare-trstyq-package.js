/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
if (
  args.length !== 0 &&
  (args.length !== 2 ||
    args[0] !== '--tag' ||
    !['ca', 'latest'].includes(args[1]))
) {
  throw new Error('Usage: npm run package:trstyq -- [--tag ca|latest]');
}
const tag = args[1] ?? 'ca';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const runNpm = (args, cwd = root) =>
  execFileSync(npm, args, { cwd, stdio: 'inherit' });
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
if (
  execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
) {
  throw new Error('Commit source changes before preparing a release package');
}
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// bundle/ is generated output. Remove stale chunks before rebuilding.
rmSync(join(root, 'bundle'), { recursive: true, force: true });
runNpm(['run', 'generate']);
runNpm(['run', 'build', '--workspace', '@google/gemini-cli-core']);
runNpm(['run', 'bundle']);

const output = mkdtempSync(join(tmpdir(), `gemini-cli-${tag}-`));
const manifest = {
  name: '@trstyq/gemini-cli',
  version: pkg.version,
  description:
    'Gemini CLI fork for private LLM gateways without SSE support, with NDJSON streaming and configurable model routing',
  license: 'Apache-2.0',
  repository: {
    type: 'git',
    url: 'git+https://github.com/ts2580/gemini-cli.git',
  },
  type: pkg.type,
  engines: pkg.engines,
  bin: pkg.bin,
  scripts: { postinstall: 'node bundle/setup-company-models.js' },
  files: pkg.files,
  dependencies: pkg.dependencies,
  optionalDependencies: pkg.optionalDependencies,
  publishConfig: {
    access: 'public',
    tag,
    registry: 'https://registry.npmjs.org/',
  },
  gitHead: sourceCommit,
};
writeFileSync(
  join(output, 'package.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
cpSync(join(root, 'bundle'), join(output, 'bundle'), { recursive: true });
cpSync(join(root, 'LICENSE'), join(output, 'LICENSE'));
cpSync(join(root, 'docs/npm-trstyq.md'), join(output, 'README.md'));

const packed = JSON.parse(
  execFileSync(npm, ['pack', '--ignore-scripts', '--json'], {
    cwd: output,
    encoding: 'utf8',
  }),
);
const tarball = Array.isArray(packed) ? packed[0] : packed[manifest.name];
const bytes = readFileSync(join(output, tarball.filename));
const sha256 = createHash('sha256').update(bytes).digest('hex');
writeFileSync(join(output, 'SHA256SUMS'), `${sha256}  ${tarball.filename}\n`);
writeFileSync(
  join(output, 'release.json'),
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      tag,
      sourceCommit,
      filename: tarball.filename,
      integrity: tarball.integrity,
      sha256,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Prepared package (not published): ${join(output, tarball.filename)}`,
);
