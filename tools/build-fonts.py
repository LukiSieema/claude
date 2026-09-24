#!/usr/bin/env python3
"""
Builds the game's UI fonts (game/fonts/fredoka-{500,600,700}.woff2) from the Fredoka variable font.

Fredoka has no precomposed Polish letters except ó/ł (ą ć ę ń ś ź ż and capitals are missing), so browsers drew
them with a system fallback font. This script instantiates the weights the game uses and adds those letters as
composites of Fredoka's own base glyphs and combining marks, positioned with the font's mark-to-base anchors,
then subsets to Latin + Polish. The result stays under the SIL Open Font License (no Reserved Font Name).

  pip install fonttools brotli
  curl -L -o /tmp/Fredoka.ttf "https://raw.githubusercontent.com/google/fonts/main/ofl/fredoka/Fredoka%5Bwdth,wght%5D.ttf"
  python3 tools/build-fonts.py /tmp/Fredoka.ttf
"""
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
from fontTools.varLib import instancer

WEIGHTS = [500, 600, 700]
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'game', 'fonts')

# new glyph: (unicode, base glyph, mark glyph)
POLISH = {
    'aogonek': (0x0105, 'a', 'uni0328'), 'Aogonek': (0x0104, 'A', 'uni0328'),
    'eogonek': (0x0119, 'e', 'uni0328'), 'Eogonek': (0x0118, 'E', 'uni0328'),
    'cacute': (0x0107, 'c', 'acutecomb'), 'Cacute': (0x0106, 'C', 'acutecomb'),
    'nacute': (0x0144, 'n', 'acutecomb'), 'Nacute': (0x0143, 'N', 'acutecomb'),
    'sacute': (0x015B, 's', 'acutecomb'), 'Sacute': (0x015A, 'S', 'acutecomb'),
    'zacute': (0x017A, 'z', 'acutecomb'), 'Zacute': (0x0179, 'Z', 'acutecomb'),
    'zdotaccent': (0x017C, 'z', 'uni0307'), 'Zdotaccent': (0x017B, 'Z', 'uni0307'),
}

# Same Unicode coverage as the Google Fonts "latin" subset the game shipped with, plus Polish letters.
UNICODES = (list(range(0x20, 0x7F)) + list(range(0xA0, 0x100)) +
            [0x131, 0x152, 0x153, 0x2BB, 0x2BC, 0x2C6, 0x2DA, 0x2DC, 0x304, 0x308, 0x329, 0x2122, 0x2191, 0x2193,
             0x2212, 0x2215, 0xFEFF, 0xFFFD, 0x20AC] + list(range(0x2000, 0x2070)) +
            [0x141, 0x142, 0xD3, 0xF3] + [u for u, _, _ in POLISH.values()])


def mark_anchors(font):
    """{(glyph, class): (x, y)} for bases and {mark: (class, x, y)} from the GPOS mark-to-base lookups."""
    bases, marks = {}, {}
    for lookup in font['GPOS'].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, 'LookupType', lookup.LookupType) != 4:
                continue
            for g, rec in zip(st.MarkCoverage.glyphs, st.MarkArray.MarkRecord):
                marks.setdefault(g, (rec.Class, rec.MarkAnchor.XCoordinate, rec.MarkAnchor.YCoordinate))
            for g, rec in zip(st.BaseCoverage.glyphs, st.BaseArray.BaseRecord):
                for cls, anchor in enumerate(rec.BaseAnchor):
                    if anchor is not None:
                        bases.setdefault((g, cls), (anchor.XCoordinate, anchor.YCoordinate))
    return bases, marks


def offset(bases, marks, base, mark):
    cls, mx, my = marks[mark]
    bx, by = bases[(base, cls)]
    return bx - mx, by - my


def add_composites(font):
    bases, marks = mark_anchors(font)
    # sanity check: the anchors reproduce composites the designers made themselves (é, É, ž, š)
    for comp, base, mark in (('eacute', 'e', 'acutecomb'), ('Eacute', 'E', 'acutecomb'), ('zcaron', 'z', 'uni030C'), ('scaron', 's', 'uni030C')):
        ref = {c.glyphName: (c.x, c.y) for c in font['glyf'][comp].components}[mark]
        got = offset(bases, marks, base, mark)
        assert abs(got[0] - ref[0]) <= 1 and abs(got[1] - ref[1]) <= 1, (comp, got, ref)
    glyf, hmtx = font['glyf'], font['hmtx']
    for name, (uni, base, mark) in POLISH.items():
        if name in glyf:
            continue
        g = Glyph()
        g.numberOfContours = -1
        g.components = []
        for gname, (x, y) in ((base, (0, 0)), (mark, offset(bases, marks, base, mark))):
            c = GlyphComponent()
            c.glyphName, c.x, c.y, c.flags = gname, x, y, 0
            g.components.append(c)
        g.components[0].flags = 0x0200  # USE_MY_METRICS: advance and side bearings of the base letter
        glyf[name] = g  # also appends the name to the font's glyph order
        hmtx[name] = hmtx[base]
        for table in font['cmap'].tables:
            if table.isUnicode():
                table.cmap[uni] = name
    font.setGlyphOrder(font.getGlyphOrder())  # refresh the cached name → id map
    for name in POLISH:
        glyf[name].recalcBounds(glyf)


def main(src):
    for w in WEIGHTS:
        font = TTFont(src)
        font = instancer.instantiateVariableFont(font, {'wght': w, 'wdth': 100}, updateFontNames=False)
        add_composites(font)
        font['OS/2'].usWeightClass = w
        opts = subset.Options()
        opts.layout_features = ['*']
        opts.name_IDs = ['*']
        opts.notdef_outline = True
        opts.flavor = 'woff2'
        sub = subset.Subsetter(opts)
        sub.populate(unicodes=UNICODES)
        sub.subset(font)
        out = os.path.join(OUT_DIR, 'fredoka-%d.woff2' % w)
        font.flavor = 'woff2'
        font.save(out)
        cmap = font.getBestCmap()
        missing = [chr(u) for u, _, _ in POLISH.values() if u not in cmap]
        assert not missing, missing
        print(out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
