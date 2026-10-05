# Cuts the site fonts down to the characters the site can show.
# Sources are Google Fonts' own script files (src/fonts/source/<family>-<script>.woff2, OFL); every face keeps its
# variation axes and all of its layout features, so the letters look the same, only unused glyphs go.
# The characters: everything outside Basic Latin found in src/ (content, interface strings), plus a base set that
# keeps ordinary new text covered. tests/fonts.test.ts fails when src/ gets a character outside src/fonts/charset.json;
# then run this again:  python scripts/subset-fonts.py   (needs fonttools and brotli: pip install fonttools brotli)
import json
import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

root = pathlib.Path(__file__).resolve().parent.parent
fonts = root / 'src' / 'fonts'

base = set(range(0x20, 0x7f))                                   # Basic Latin
base |= {0x401, 0x451, 0x2116} | set(range(0x410, 0x450))       # the Russian alphabet and the number sign
# Spaces with widths of their own (no-break, thin, narrow no-break) and common typography: quotes, dashes,
# the ellipsis, currency, arrows, the minus.
base |= {0xa0, 0x2009, 0x202f, 0xab, 0xbb, 0xb7, 0xd7, 0xa9, 0xae, 0x2122, 0xb0, 0xb1, 0xb2, 0xb3, 0x2013, 0x2014,
         0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e, 0x2026, 0x2022, 0x20ac, 0x20bd, 0x2190, 0x2191, 0x2192, 0x2193,
         0x2197, 0x2212}
found = set()
for path in (root / 'src').rglob('*'):
    if path.suffix in {'.ts', '.tsx', '.json', '.css'} and fonts not in path.parents:
        found |= {ord(c) for c in path.read_text(encoding='utf-8') if ord(c) > 0x7e}
# Invisible and format characters stay with the system: they are never drawn.
invisible = lambda c: 0x2000 <= c <= 0x200f or 0x2028 <= c <= 0x202e or 0x2060 <= c <= 0x206f or c in {0x85, 0x1680, 0x180e, 0x3000, 0xfeff, 0xfffd}
chars = sorted(base | {c for c in found if not invisible(c)})
(fonts / 'charset.json').write_text(json.dumps(''.join(map(chr, chars)), ensure_ascii=True) + '\n', encoding='utf-8')

# Sofia Sans Condensed is declared at 400 to 600 only (src/lib/fonts-c.ts), the weights the site uses, so the
# light end of its 1 to 1000 weight axis goes. The heavy end stays: cutting the axis at 600 re-rounds every glyph
# drawn at 600, and the figures would shift by a fraction of a pixel.
axes = {'sofia': {'wght': (400, 1000)}}

options = subset.Options()
options.flavor = 'woff2'
options.layout_features = ['*']
options.name_IDs = ['*']
options.notdef_outline = True
for source in sorted((fonts / 'source').glob('*.woff2')):
    font = TTFont(source)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=[c for c in chars if c in font.getBestCmap()])
    subsetter.subset(font)
    limits = axes.get(source.name.split('-')[0])
    if limits:
        font = instancer.instantiateVariableFont(font, limits)
    target = fonts / source.name
    font.flavor = 'woff2'
    font.save(target)
    kept = sorted(font.getBestCmap())
    extra = ' '.join(f'U+{c:04X}' for c in kept if c > 0x7e and not 0x400 <= c <= 0x45f)
    print(f'{source.name}: {source.stat().st_size} -> {target.stat().st_size} bytes, {len(kept)} characters; beyond Basic Latin and Cyrillic: {extra}')
