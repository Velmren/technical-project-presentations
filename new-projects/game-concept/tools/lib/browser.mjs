// Shared browser helpers for the verification, capture and recording scripts.
// Playwright is a development-only dependency: install `playwright` locally or
// point PLAYWRIGHT_CORE at an existing playwright-core directory.
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_CORE) candidates.push(pathToFileURL(path.join(process.env.PLAYWRIGHT_CORE, 'index.mjs')).href);
  candidates.push('playwright', 'playwright-core');
  for (const specifier of candidates) {
    try {
      const module = await import(specifier);
      return module.chromium ? module : module.default;
    } catch {}
  }
  throw new Error('Playwright not found. Run `npm i -D playwright` or set PLAYWRIGHT_CORE to a playwright-core directory.');
}

// GPU-backed Chromium keeps WebGL timings meaningful. Software WebGL
// (SwiftShader) leaves the graphics card alone and is enough for layout,
// state and flow checks, but its frame times say nothing about real devices.
export async function launch({headed = false, gpu = true} = {}) {
  const {chromium} = await loadPlaywright();
  const args = gpu
    ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']
    : ['--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  return chromium.launch({headless: !headed, args});
}

export function startServer(port = 4353) {
  const child = spawn(process.execPath, ['serve.mjs'], {cwd: PROJECT_ROOT, env: {...process.env, PORT: String(port)}, stdio: ['ignore', 'pipe', 'inherit']});
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', chunk => {
      if (String(chunk).includes('http://')) resolve({url: `http://127.0.0.1:${port}/`, stop: () => child.kill()});
    });
    setTimeout(() => reject(new Error('Local server did not start')), 8000);
  });
}

export async function waitForReady(page) {
  await page.waitForFunction(() => ['true', 'fallback'].includes(document.body.dataset.ready), null, {timeout: 20000});
}
