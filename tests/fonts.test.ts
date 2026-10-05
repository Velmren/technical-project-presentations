import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// The site fonts carry only the characters listed in src/fonts/charset.json (scripts/subset-fonts.py).
// A character outside it would be drawn by the fallback font, so new text with one fails here.
const charset = new Set(JSON.parse(readFileSync('src/fonts/charset.json', 'utf8')) as string);
const invisible = (c: number) => (c >= 0x2000 && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || (c >= 0x2060 && c <= 0x206f) || [0x85, 0x1680, 0x180e, 0x3000, 0xfeff, 0xfffd].includes(c);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return file === path.join('src', 'fonts') ? [] : files(file);
    return /\.(ts|tsx|json|css)$/.test(name) ? [file] : [];
  });
}

test('every character the site text uses is in the fonts', () => {
  const missing = new Map<string, string>();
  for (const file of files('src')) {
    for (const ch of readFileSync(file, 'utf8')) {
      const code = ch.codePointAt(0)!;
      if (code > 0x7e && !invisible(code) && !charset.has(ch) && !missing.has(ch)) missing.set(ch, file);
    }
  }
  assert.deepEqual([...missing].map(([ch, file]) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase()} in ${file}`), [],
    'run python scripts/subset-fonts.py to add them');
});
