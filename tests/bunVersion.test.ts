import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageManager } from '../package.json';

const source = (path: string) => readFileSync(join(import.meta.dir, '..', path), 'utf8');

describe('Bun version contract', () => {
  test('pins the same stable Bun version for local installs, CI and releases', () => {
    expect(packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
    const version = packageManager.slice('bun@'.length);
    for (const workflow of ['ci.yml', 'release.yml']) {
      expect(source(`.github/workflows/${workflow}`)).toContain(`bun-version: '${version}'`);
    }
    expect(source('AGENTS.md')).toContain(`\`${packageManager}\``);
    for (const readme of ['README.md', 'README_CN.md']) {
      expect(source(readme)).toContain(`**Bun ${version}**`);
    }
  });
});
