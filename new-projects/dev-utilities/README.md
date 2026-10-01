# Dev Utilities, VELMREN

A browser workspace with four tools for everyday development work: JSON, colors, checksums and Base64. Everything is processed on the device in background workers. There is no backend, account, analytics or upload. The interface is available in English and Russian, in light and dark themes. Example data is synthetic.

## Run and verify

```sh
npm ci
npm run check
npm test
npm run build
npm run dev
```

Requires Node.js 20+ and npm. Open http://127.0.0.1:4315/projects/dev-utilities/ (`/` also works). Serve the build rather than opening files directly: module workers do not load from `file://`. Clipboard access needs HTTPS or localhost.

With the server running and Chrome installed:

```sh
npm run test:browser
npm run test:extra
npm run screenshots
```

Reports and screenshots go to `artifacts/`, or to the directory in `DU_ARTIFACTS`. `npm run export:portfolio` copies `dist/` to `../../public/projects/dev-utilities/`. Nothing is published by any script.

## Interface

A top bar switches tools (Alt+1 to Alt+4), language and theme; the About dialog explains processing and storage. Each tool has a tool bar, resizable panes (pointer or arrow keys on the divider) and a status bar. Below 768 px the tools move to a bottom tab bar and one pane is shown at a time.

Language follows the browser (`ru*` gives Russian) until chosen; theme follows the system until chosen. Both choices and pane sizes are remembered. Document text, options and palettes are saved only after explicit opt-in in the About dialog; files and results stay in memory. Storage keys use the prefix `velmren.du.v3.`; consent given in v2 carries over, v2 drafts do not.

## Tools

**JSON.** CodeMirror editor with syntax colors, folding, search and diagnostics. Five modes:

- Inspect: virtualized tree with filter, JSON Pointer navigation and keyboard control; live JSONPath (RFC 9535) with a results table (normalized path, type, value), examples and a syntax guide. Every match is marked in the editor. Returned values are cut from the source, so large numbers stay exact; filters compare numbers in double precision and say so when that matters.
- Convert: YAML, CSV, TypeScript types or JSON Schema (draft 2020-12) from the whole document or any JSON Pointer. Numbers are copied digit for digit; the inferred schema can be sent straight to Schema mode.
- Compare: exact decimal comparison by keys and indexes, RFC 6902 JSON Patch export or opening the diff as an editable patch.
- Patch: RFC 6902 operations (add, remove, replace, move, copy, test) applied to an exact value tree; the result is previewed and replaces the source only on request.
- Schema: Ajv draft 2020-12 with formats and local references; messages in the interface language.
- Unsafe numbers and duplicate keys are kept in the source and block only the operations that would be ambiguous.

**Colors.** Saturation/lightness plane, hue and alpha sliders, HEX/RGB/HSL/OKLCH/OKLab fields. OKLCH or OKLab input beyond sRGB is marked (inside or outside Display P3) and mapped to the nearest sRGB color with the CSS Color 4 method. A palette of up to 12 colors with names, locks, ordering and harmony generation; each row shows contrast against white and black. Perceptual tonal scale in OKLCH. Contrast of text on background over an opaque page, with body text, large text and control samples checked against WCAG 2 AA/AAA. A vision control simulates protanopia, deuteranopia, tritanopia and achromatopsia on every swatch and sample. Export to CSS variables, Tailwind v4 `@theme` with `oklch()`, W3C Design Tokens and JSON. APCA is not included: its licence does not permit commercial use without a separate agreement.

**Hash.** SHA-256, SHA-512, SHA-1 (legacy) and CRC32 with hash-wasm, streamed in 2 MB chunks, and HMAC for the SHA algorithms with a UTF-8 or hex key that is never saved. Text is hashed as exact UTF-8, and all algorithms are shown side by side. The file queue shows progress, cancellation and per-file errors, and verifies against expected values or a loaded checksum list (GNU `sha256sum` or BSD format, matched by name). The list check shows files missing from the list and entries without a file, and exports a `sha256sum -c` style report. Exports: checksum file and JSON.

**Base64.** Text or file, encode or decode, standard or URL-safe alphabet, optional padding, Data URI output and automatic Data URI parsing. Decoding is strict (alphabet, padding, length, unused bits). Decoded bytes open in a hex view with offsets and ASCII, and common file signatures are recognized. HTML, JavaScript and SVG are shown only as text; PNG, JPEG, GIF and WebP get an image preview when their signature is recognized. Invalid UTF-8 stays downloadable as bytes. JWT mode decodes the header, payload and claims (with dates and validity) and states plainly that the signature is not verified; `alg: none` is flagged.

## Limits

| Operation      | Limit                                                              |
| -------------- | ------------------------------------------------------------------ |
| JSON source    | 5,242,880 UTF-16 units; imported file 5 MiB                        |
| JSON structure | 256 levels; 100,000 values; 600,000 tokens                         |
| Tree           | 25,000 listed values; filter and pointer cover the whole document  |
| JSONPath       | 2,000 listed matches; total counted up to 200,000; 10-second limit |
| Diff           | 5,000 changes; exponents up to 10,000 digits                       |
| Schema report  | First 200 errors plus total count                                  |
| JSON worker    | 20-second timeout; cancellation                                    |
| Hash           | 20 files; 1 GiB each; 2 MiB chunks; text 16 MiB UTF-8              |
| Base64         | 32 MiB original/decoded bytes; about 44 MiB encoded input          |
| Base64 worker  | 60-second timeout; cancellation                                    |
| Raster preview | 8 MiB; 8192 px per side; 16 megapixels                             |

Known boundaries:

- YAML numbers are written exactly as in the source. Strings such as `yes` or `on` are quoted for YAML 1.1 loaders, but an exponent without a dot or sign (`1E5`) is still read as a string by strict YAML 1.1 loaders.
- CSV cells are written as they are. Values starting with `=`, `+`, `-` or `@` are not escaped for spreadsheet formulas.
- A CSV export stops with an explanation when two fields would share one column name (a key `a.b` next to a nested `a` → `b`).
- Checksum lists: lines for algorithms the tool does not compute (MD5, for example) are counted and skipped. While HMAC is on, a loaded list is kept but not compared.

## Dependencies

React 19, CodeMirror 6 (JSON, YAML and TypeScript modes), Ajv with ajv-formats and ajv-i18n, jsonc-parser, lossless-json, json-p3 (JSONPath), yaml, culori, hash-wasm, lucide-react, IBM Plex Sans and Plex Mono (OFL, bundled). The JSONPath compliance suite in `tests/fixtures/jsonpath-cts/` is BSD-2 licensed and used only by tests.

References: [RFC 9535](https://www.rfc-editor.org/rfc/rfc9535), [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901), [RFC 6902](https://www.rfc-editor.org/rfc/rfc6902), [WCAG 2.2 contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [CodeMirror](https://codemirror.net/docs/ref/), [Ajv](https://ajv.js.org/), [hash-wasm](https://github.com/Daninet/hash-wasm).
