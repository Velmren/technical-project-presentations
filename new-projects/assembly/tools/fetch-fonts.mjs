// Downloads the Cyrillic and Latin subsets of the two page fonts from Google Fonts into fonts/.
// Both families are under the SIL Open Font License 1.1; the licence texts sit next to the files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'fonts');
const css = 'https://fonts.googleapis.com/css2?family=Onest:wght@300..700&family=Noto+Serif+Display:wdth,wght@62.5..100,300..600&display=swap';
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const licences = {
  'Onest-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/onest/OFL.txt',
  'NotoSerifDisplay-OFL.txt': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifdisplay/OFL.txt',
};

fs.mkdirSync(out, {recursive: true});
const text = await (await fetch(css, {headers: {'User-Agent': ua}})).text();
const blocks = [...text.matchAll(/\/\* ([a-z-]+) \*\/\s*@font-face \{([^}]+)\}/g)];
for (const [, subset, body] of blocks) {
  if (subset !== 'cyrillic' && subset !== 'latin') continue;
  if (/font-style: italic/.test(body)) continue;
  const family = body.match(/font-family: '([^']+)'/)[1].replaceAll(' ', '');
  const url = body.match(/url\(([^)]+)\)/)[1];
  const file = `${family}-${subset}.woff2`;
  fs.writeFileSync(path.join(out, file), Buffer.from(await (await fetch(url)).arrayBuffer()));
  const range = body.match(/unicode-range: ([^;]+);/)[1];
  console.log(file, fs.statSync(path.join(out, file)).size, range);
}
for (const [file, url] of Object.entries(licences)) {
  fs.writeFileSync(path.join(out, file), await (await fetch(url)).text());
}
