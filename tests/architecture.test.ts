import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFilesUnder(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('architecture guard', () => {
  it('sim and ai stay headless: no pixi imports', () => {
    for (const dir of ['src/sim', 'src/ai', 'src/game', 'src/content']) {
      for (const file of tsFilesUnder(dir)) {
        const source = readFileSync(file, 'utf8');
        expect(source.includes('pixi.js'), `${file} imports pixi.js`).toBe(false);
      }
    }
  });
});
