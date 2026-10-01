// Parses every source module with Node so syntax errors fail fast without a browser.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT_ROOT} from './lib/browser.mjs';

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(m?js)$/.test(entry.name)) files.push(full);
  }
})(path.join(PROJECT_ROOT, 'src'));
for (const file of files) execFileSync(process.execPath, ['--check', file], {stdio: 'inherit'});
console.log(`Syntax OK: ${files.length} modules.`);
