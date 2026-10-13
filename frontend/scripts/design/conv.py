"""Convert EtherX design markup (dc template dialect) into React JSX views.

Usage: conv.py markup.html regions.json out_dir
regions.json: [{"name": "TopBar", "start": int, "end": int}, ...]  (byte offsets of a
balanced fragment in markup.html). Each region becomes `export function <name>({ v, slots })`.
Hover styles go to one CSS file with !important rules (same as the dc runtime).
"""
import sys, re, json, hashlib, os
from html.parser import HTMLParser

VOID = {'br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'col', 'area', 'wbr'}
SVG_TAGS = {'svg', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs',
            'lineargradient', 'radialgradient', 'stop', 'ellipse', 'text', 'tspan', 'clippath', 'mask', 'use'}
SVG_CASE = {'lineargradient': 'linearGradient', 'radialgradient': 'radialGradient', 'clippath': 'clipPath'}


class Node:
    def __init__(self, tag, attrs):
        self.tag, self.attrs, self.kids = tag, attrs, []


class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].kids.append(n)
        if tag not in VOID:
            self.stack.append(n)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].kids.append(Node(tag, attrs))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, d):
        self.stack[-1].kids.append(d)


EXPR = re.compile(r'\{\{\s*([A-Za-z_$][\w$.]*)\s*\}\}')
hover_rules = {}


def ref(path, scope):
    if path in ('true', 'false', 'null'):
        return path
    head = path.split('.')[0]
    return path if head in scope else 'v.' + path


def interp(s, scope):
    """Attribute/style value -> JS expression."""
    m = EXPR.fullmatch(s.strip())
    if m:
        return ref(m.group(1), scope)
    if not EXPR.search(s):
        return json.dumps(s)
    out = EXPR.sub(lambda m: '${' + ref(m.group(1), scope) + '}', s.replace('`', '\\`'))
    return '`' + out + '`'


def camel(k):
    if k.startswith('--'):
        return k
    return re.sub(r'-([a-z])', lambda m: m.group(1).upper(), k)


def style_obj(s, scope):
    parts = {}
    for decl in re.split(r';(?![^(]*\))', s):
        if ':' not in decl:
            continue
        k, val = decl.split(':', 1)
        k, val = k.strip(), val.strip()
        if not k:
            continue
        key = json.dumps(k) if k.startswith('--') else camel(k)
        if k.startswith('-webkit-'):
            key = 'Webkit' + camel(k[8:])[0].upper() + camel(k[8:])[1:]
        parts[key] = interp(val, scope)
    return '{{ ' + ', '.join(f'{key}: {value}' for key, value in parts.items()) + ' }}'


def hover_class(s):
    decl = ';'.join(d.strip() + ('' if 'important' in d else ' !important')
                    for d in s.split(';') if d.strip())
    h = 'dh-' + hashlib.md5(decl.encode()).hexdigest()[:7]
    hover_rules[h] = decl
    return h


def attr_name(k, tag):
    if k.startswith('sc-camel-'):
        return camel(k[len('sc-camel-'):])
    if k == 'class':
        return 'className'
    if k == 'tabindex':
        return 'tabIndex'
    if k == 'for':
        return 'htmlFor'
    if k.startswith('data-') or k.startswith('aria-'):
        return k
    if tag in SVG_TAGS or '-' in k:
        return camel(k)
    return k


def jsx_text(t):
    out, last = [], 0
    for m in EXPR.finditer(t):
        out.append(esc(t[last:m.start()]))
        out.append('{%s}' % m.group(1))  # resolved by caller via placeholder
        last = m.end()
    out.append(esc(t[last:]))
    return ''.join(out)


def esc(t):
    return t.replace('{', '{"{"}').replace('}', '{"}"}').replace('<', '&lt;').replace('>', '&gt;')


def emit(node, scope, ind):
    pad = '  ' * ind
    if isinstance(node, str):
        if not node.strip():
            return '' if '\n' in node or not node else ' '
        t = re.sub(r'\s+', ' ', node)
        return EXPR.sub(lambda m: '{' + ref(m.group(1), scope) + '}', esc_keep(t))
    a = dict(node.attrs)
    tag = node.tag
    if tag == 'sc-if':
        cond = interp(a['value'], scope)
        return f'{{{cond} && (<>{kids(node, scope, ind + 1)}</>)}}'
    if tag == 'sc-for':
        lst = interp(a['list'], scope)
        var = a.get('as', 'item')
        idx = f'{var}__i'
        return (f'{{({lst} || []).map(({var}, {idx}) => (<React.Fragment key={{{var}?.key ?? {idx}}}>'
                f'{kids(node, scope | {var}, ind + 1)}</React.Fragment>))}}')
    if tag == 'sc-slot':
        return '{' + ref(a['name'], scope) + '}'
    if tag == 'rb-icon':
        props = []
        for k, val in node.attrs:
            if k == 'style':
                props.append(f'style={style_obj(val, scope)}')
            else:
                props.append(f'{k}={{{interp(val, scope)}}}')
        return f'<RbIcon {" ".join(props)} />'
    if tag == 'sc-raw-select':
        tag = 'select'
    out_tag = SVG_CASE.get(tag, tag)
    props, classes = [], []
    for k, val in node.attrs:
        if k in ('hint-placeholder-val', 'hint-placeholder-count'):
            continue
        val = '' if val is None else val
        if k == 'style':
            props.append(f'style={style_obj(val, scope)}')
        elif k == 'style-hover':
            classes.append(json.dumps(hover_class(val)))
        elif k == 'class':
            classes.append(interp(val, scope))
        elif k == 'ref':
            props.append(f'ref={{{interp(val, scope)}}}')
        else:
            name = attr_name(k, tag)
            if tag == 'button' and name == 'onMouseDown':
                # Keep selection on pointer down; click also supports keyboard activation.
                props.append('onMouseDown={(e) => e.preventDefault()}')
                name = 'onClick'
            if name == 'contentEditable' or name == 'spellCheck' or name == 'suppressContentEditableWarning':
                props.append(f'{name}={{{interp(val, scope) if EXPR.search(val) else str(val.lower() == "true").lower()}}}')
            else:
                props.append(f'{name}={{{interp(val, scope)}}}')
    keys = {k for k, _ in node.attrs}
    if tag == 'button':
        props.append('type="button"')
    if tag in ('div', 'span') and a.get('role') in ('button', 'switch') and 'sc-camel-on-click' in keys:
        handler = interp(a['sc-camel-on-click'], scope)
        if 'tabindex' not in keys:
            props.append('tabIndex={0}')
        props.append(f'onKeyDown={{(e) => {{ if (e.key === "Enter" || e.key === " ") {{ e.preventDefault(); ({handler})?.(e); }} }} }}')
    if (tag == 'button' and 'title' in keys and not keys & {'sc-camel-on-click', 'sc-camel-on-mouse-down'}):
        # Unbound design button: route it through v.act(title) so the app can wire it.
        t = interp(a['title'], scope)
        props.append(f'onClick={{v.act ? (e) => v.act({t}, e) : undefined}}')
    if classes:
        props.insert(0, 'className={' + ' + " " + '.join(classes) + '}' if len(classes) > 1 else f'className={{{classes[0]}}}')
    p = (' ' + ' '.join(props)) if props else ''
    if tag in VOID or (not node.kids and tag in SVG_TAGS):
        return f'<{out_tag}{p} />'
    return f'<{out_tag}{p}>{kids(node, scope, ind + 1)}</{out_tag}>'


def esc_keep(t):
    # escape braces/angles but keep {{ expr }} markers intact
    parts, last = [], 0
    for m in EXPR.finditer(t):
        parts.append(esc(t[last:m.start()]))
        parts.append(m.group(0))
        last = m.end()
    parts.append(esc(t[last:]))
    return ''.join(parts)


def kids(node, scope, ind):
    return ''.join(emit(k, scope, ind) for k in node.kids)


def main():
    markup = open(sys.argv[1], encoding='utf-8').read()
    regions = json.load(open(sys.argv[2]))
    out_dir = sys.argv[3]
    mod = sys.argv[4] if len(sys.argv) > 4 else 'DesignViews'
    fns = []
    for r in regions:
        frag = re.sub(r'<!--.*?-->', '', markup[r['start']:r['end']], flags=re.S)
        p = P()
        p.feed(frag)
        # Stable region classes support responsive styling without fragile inline selectors.
        def add_region(n):
            if isinstance(n, Node):
                if n.tag == 'sc-if':
                    for child in n.kids:
                        if isinstance(child, Node):
                            add_region(child)
                            return
                else:
                    n.attrs.append(('class', 'etherx-' + re.sub(r'(?<!^)(?=[A-Z])', '-', r['name'].removesuffix('View')).lower()))
        for child in p.root.kids:
            if isinstance(child, Node):
                add_region(child)
                break
        body = kids(p.root, set(), 2)
        fns.append(f'export function {r["name"]}({{ v }}) {{\n  return (<>{body}</>);\n}}\n')
    head = ('// GENERATED by scripts/design/conv.py from the EtherX Word design. Do not hand-edit;\n'
            '// change the design and regenerate, or wrap the view instead.\n'
            "import React from 'react';\nimport { RbIcon } from './RbIcon';\n"
            f"import './{mod}.css';\n\n")
    open(os.path.join(out_dir, mod + '.jsx'), 'w').write(head + '\n'.join(fns))
    css = '\n'.join(f'.{k}:hover{{{v}}}' for k, v in sorted(hover_rules.items()))
    open(os.path.join(out_dir, mod + '.css'), 'w').write('/* GENERATED: design hover styles */\n' + css + '\n')


main()
