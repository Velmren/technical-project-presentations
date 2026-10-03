// Builds the browser version of Category Spark from its published source into public/assets/godot/web/.
// The export is not committed (like other game builds); run this before building the site.
// Usage: GODOT=<path to Godot_v4.7.2-stable console executable> node scripts/build-category-spark-web.mjs
import { execFileSync } from 'node:child_process';
import { appendFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Single-threaded export: runs on any static host without cross-origin isolation headers.
const WEB_PRESET = `
[preset.1]
name="Web"
platform="Web"
runnable=true
advanced_options=false
dedicated_server=false
custom_features=""
export_filter="all_resources"
include_filter="data/*.json,assets/fonts/*.txt,LICENSE"
exclude_filter="tests/*,output/*,docs/*,.qa-runtime*/*,.runtime/*,README.md"
export_path="build/web/index.html"
encryption_include_filters=""
encryption_exclude_filters=""
encrypt_pck=false
encrypt_directory=false
script_export_mode=2

[preset.1.options]
custom_template/debug=""
custom_template/release=""
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=true
html/custom_html_shell=""
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
`;

// Browsers offer no system fonts, so the check mark and arrows the default font lacks would show as boxes.
// The web copy loads DejaVu Sans as a fallback of the engine font; the game's own code is not changed.
const FALLBACK_SCRIPT = `extends Node

# Symbols missing from the default font (arrows, check mark) come from DejaVu Sans in the browser build.
func _enter_tree() -> void:
\tvar font := ThemeDB.fallback_font
\tvar extra: Font = load("res://assets/fonts/DejaVuSans-Bold.ttf")
\tif font and extra and not font.fallbacks.has(extra):
\t\tvar list := font.fallbacks.duplicate()
\t\tlist.append(extra)
\t\tfont.fallbacks = list
`;
const AUTOLOAD = `
[autoload]

WebFontFallback="*res://scripts/web_font_fallback.gd"
`;
const dejavu = path.resolve('node_modules/dejavu-fonts-ttf');

// A quiet link back to the main site in the bottom-left corner, which the game leaves empty at every window
// size (the motion switch sits top-right or bottom-right). Colours follow the game's own caption text.
const SITE_LINK_STYLE = `
#site-link { position: fixed; left: 12px; bottom: 4px; z-index: 2; font: 600 11px/14px 'Open Sans', 'Noto Sans', Arial, sans-serif; letter-spacing: .06em; color: #7f90a6; text-decoration: none; }
#site-link:hover, #site-link:focus-visible { color: #c5d2e2; }
#site-link:focus-visible { outline: 1px solid #c5d2e2; outline-offset: 2px; }
`;
const SITE_LINK = '<a id="site-link" href="https://velmren.com/">VELMREN</a>';
function addSiteLink(html) {
  // Newer sources carry the link in their own web shell.
  if (html.includes('velmren.com')) return html;
  if (!html.includes('</style>') || !html.includes('<script src="index.js">')) throw new Error('Unexpected Godot web shell');
  return html.replace('</style>', SITE_LINK_STYLE + '</style>').replace('<script src="index.js">', SITE_LINK + '\n\t\t<script src="index.js">');
}

const godot = process.env.GODOT;
if (!godot) throw new Error('Set GODOT to the Godot 4.7.2 console executable');
const source = path.resolve('public/assets/godot/CategorySpark-source.zip');
const target = path.resolve('public/assets/godot/web');
const work = await mkdtemp(path.join(os.tmpdir(), 'category-spark-'));
try {
  if (process.platform === 'win32') execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${source}' -DestinationPath '${work}'`]);
  else execFileSync('unzip', ['-q', source, '-d', work]);
  await cp(path.join(dejavu, 'ttf/DejaVuSans-Bold.ttf'), path.join(work, 'assets/fonts/DejaVuSans-Bold.ttf'));
  await cp(path.join(dejavu, 'LICENSE'), path.join(work, 'assets/fonts/DejaVu-LICENSE.txt'));
  await writeFile(path.join(work, 'scripts/web_font_fallback.gd'), FALLBACK_SCRIPT);
  // The game lays out by window size in pixels; on high-density phones the browser reports device pixels,
  // which halves the interface. Laying out in CSS pixels keeps the phone layout the game was tested with.
  const project = path.join(work, 'project.godot');
  const settings = await readFile(project, 'utf8');
  if (!/\[display\]\r?\n/.test(settings)) throw new Error('project.godot has no [display] section');
  await writeFile(project, settings.replace(/\[display\]\r?\n/, '[display]\n\nwindow/dpi/allow_hidpi=false\n') + AUTOLOAD);
  const presets = path.join(work, 'export_presets.cfg');
  if (!(await readFile(presets, 'utf8')).includes('name="Web"')) await appendFile(presets, WEB_PRESET);
  execFileSync(godot, ['--headless', '--path', work, '--import'], { stdio: 'inherit' });
  await mkdir(path.join(work, 'build/web'), { recursive: true });
  execFileSync(godot, ['--headless', '--path', work, '--export-release', 'Web', 'build/web/index.html'], { stdio: 'inherit' });
  await rm(target, { recursive: true, force: true });
  await cp(path.join(work, 'build/web'), target, { recursive: true });
  const shell = path.join(target, 'index.html');
  await writeFile(shell, addSiteLink(await readFile(shell, 'utf8')));
  console.log('Category Spark web build written to', target);
} finally {
  await rm(work, { recursive: true, force: true });
}
