"""Locate the design's top-level regions by anchor snippet; print regions.json.

Offsets shift whenever bind.py rewrites markup, so regions are found by the
opening tag of each region rather than stored as fixed offsets.
"""
import sys, re, json

ANCHORS = [
    ('TopBarView', '<div style="height:44px;flex:none;display:flex;align-items:center;gap:12px;padding:0 12px;'),
    ('TabStripView', '<div style="height:40px;flex:none;display:flex;align-items:stretch;gap:2px;padding:0 12px;'),
    ('RibbonView', '<div ref="{{ wheelX }}" style="scrollbar-width:none;flex:none;position:relative;padding:8p'),
    ('NavPaneView', '<sc-if value="{{ pagesOpen }}"'),
    ('CanvasView', '<div style="flex:1;min-width:0;overflow:auto;background-color:var(--t1,#0e0e10)'),
    ('PragnaPanelView', '<sc-if value="{{ pragnaOpen }}"'),
    ('StatusBarView', '<div style="height:26px;flex:none;display:flex;align-items:center;gap:14px;'),
    ('ToastView', '<sc-if value="{{ toast }}"'),
    ('BackstageNavView', '<div style="width:216px;flex:none;display:flex;flex-direction:column;'),
    # Empty-page starters, dark and light paper (same block, two paper palettes).
    ('CanvasStartersView', '<div style="margin-top:40px;display:flex;flex-direction:column;gap:12px">', 0),
    ('CanvasStartersLightView', '<div style="margin-top:40px;display:flex;flex-direction:column;gap:12px">', 1),
]


def end_of(b, s):
    tag = re.match(r'<([a-zA-Z][\w-]*)', b[s:]).group(1)
    d = 0
    for t in re.finditer(r'<(/?)' + re.escape(tag) + r'(?=[\s>/])[^>]*?(/?)>', b[s:]):
        if t.group(1):
            d -= 1
        elif not t.group(2):
            d += 1
        if d == 0:
            return s + t.end()
    raise SystemExit(f'unbalanced <{tag}> at {s}')


def main():
    b = open(sys.argv[1], encoding='utf-8').read()
    out = []
    for name, anchor, *nth in ANCHORS:
        hits = [m.start() for m in re.finditer(re.escape(anchor), b)]
        if (len(hits) != 1 and not nth) or (nth and nth[0] >= len(hits)):
            raise SystemExit(f'regions: anchor for {name} matched {len(hits)} times')
        s = hits[nth[0] if nth else 0]
        out.append({'name': name, 'start': s, 'end': end_of(b, s)})
    for m in re.finditer(r'<sc-if value="\{\{ (f[A-Z]\w*) \}\}"', b):
        out.append({'name': 'Backstage' + m.group(1)[1:] + 'View', 'start': m.start(), 'end': end_of(b, m.start())})
    print(json.dumps(out, indent=1))


main()
