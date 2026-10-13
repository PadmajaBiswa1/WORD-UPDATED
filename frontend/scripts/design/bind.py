"""Apply app bindings to the raw design markup.

The design export is static in places the app needs live data (title, save state,
undo availability, embedded editor, ...). Each entry swaps one exact snippet of the
design markup for the same snippet with {{ bindings }} or <sc-slot> placeholders,
so the generated views keep the design's styles byte for byte.

Usage: bind.py design.markup.html > bound.markup.html
"""
import sys
import re

B = []  # (old, new, count)


def bind(old, new, count=1):
    B.append((old, new, count))


# ── Top bar ──────────────────────────────────────────────────────────
bind('<div style="width:30px;height:16px;border-radius:8px;background:var(--t31,#d6b25e);position:relative;margin:0 8px 0 4px;flex:none"><div style="position:absolute;right:2px;top:2px;width:12px;height:12px;border-radius:50%;background:#1a1405"></div></div>',
     '<div role="switch" aria-checked="{{ autoSaveOn }}" title="{{ autoSaveTitle }}" sc-camel-on-click="{{ toggleAutoSave }}" style="width:30px;height:16px;border-radius:8px;background:{{ autoSaveTrack }};position:relative;margin:0 8px 0 4px;flex:none;cursor:pointer"><div style="position:absolute;left:{{ autoSaveKnobLeft }};top:2px;width:12px;height:12px;border-radius:50%;background:{{ autoSaveKnob }}"></div></div>')
bind('<button title="Save (Ctrl+S)" style=',
     '<button title="Save (Ctrl+S)" sc-camel-on-click="{{ save }}" style=')
bind('<button title="Undo (Ctrl+Z)" style="width:30px;height:30px;border:0;background:transparent;border-radius:8px;color:var(--t22,#c4c2bd);',
     '<button title="Undo (Ctrl+Z)" sc-camel-on-click="{{ undo }}" disabled="{{ undoDisabled }}" style="width:30px;height:30px;border:0;background:transparent;border-radius:8px;color:{{ undoColor }};')
bind('<button title="Redo (Ctrl+Y)" style="width:30px;height:30px;border:0;background:transparent;border-radius:8px;color:var(--t28,#6f6d68);',
     '<button title="Redo (Ctrl+Y)" sc-camel-on-click="{{ redo }}" disabled="{{ redoDisabled }}" style="width:30px;height:30px;border:0;background:transparent;border-radius:8px;color:{{ redoColor }};')
bind('<button title="Customize Quick Access Toolbar" style=',
     '<button title="Open or import a document (Ctrl+O)" sc-camel-on-click="{{ openImport }}" style=')
bind('<span style="font-weight:500">Untitled Document</span>',
     '<sc-slot name="titleField"></sc-slot>')
bind('<i class="icon-cloud-check" style="font-size:13px;color:var(--t31,#d6b25e)"></i>Saved</span>',
     '<i class="icon-{{ saveIcon }}" style="font-size:13px;color:var(--t31,#d6b25e)"></i>{{ saveLabel }}</span>')
bind('<button style="flex:none;height:30px;padding:0 10px 0 8px;',
     '<button sc-camel-on-click="{{ focusTitle }}" style="flex:none;height:30px;padding:0 10px 0 8px;')
bind('<div style="display:flex;align-items:center;gap:8px;height:30px;width:300px;max-width:24vw;padding:0 6px 0 12px;box-sizing:border-box;border-radius:999px;background:rgba(var(--ink,255,255,255),0.05);border:1px solid rgba(var(--ink,255,255,255),0.08);color:var(--t27,#7d7b76);font-size:12.5px;white-space:nowrap;overflow:hidden;cursor:text"><i class="icon-search" style="font-size:14px"></i><span style="flex:1">Search</span><span style="font-size:10.5px;padding:2px 6px;border-radius:999px;background:rgba(var(--ink,255,255,255),0.06);color:var(--t26,#85837d)">Alt Q</span></div>',
     '<sc-slot name="search"></sc-slot>')
bind('<span style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--t31,#d6b25e);padding:3px 8px;border-radius:999px;border:1px solid rgba(212,175,55,0.35);margin:0 4px">PRO</span>',
     '<span title="{{ planTitle }}" sc-camel-on-click="{{ openPlans }}" style="font-size:10px;font-weight:700;letter-spacing:0.08em;color:var(--t31,#d6b25e);padding:3px 8px;border-radius:999px;border:1px solid rgba(212,175,55,0.35);margin:0 4px;cursor:pointer">{{ planLabel }}</span>')
bind('<button title="Notifications" style="width:28px;height:28px;border:0;background:transparent;border-radius:6px;color:var(--t23,#a19f99);cursor:pointer;display:grid;place-items:center" style-hover="background:rgba(var(--ink,255,255,255),0.07);color:var(--t18,#f1efea)"><i class="icon-bell" style="font-size:15px"></i></button>',
     '<sc-slot name="notifications"></sc-slot>')
bind('<div title="1 editing" style="position:relative;width:28px;height:28px;border-radius:50%;background:#c4644a;color:#fff;display:grid;place-items:center;font-size:10.5px;font-weight:600;margin-left:4px;flex:none">PA<span',
     '<div title="{{ avatarTitle }}" sc-camel-on-click="{{ toggleAccount }}" style="position:relative;width:28px;height:28px;border-radius:50%;background:#c4644a;color:#fff;display:grid;place-items:center;font-size:10.5px;font-weight:600;margin-left:4px;flex:none;cursor:pointer">{{ initials }}<sc-slot name="accountMenu"></sc-slot><span')

# ── Tab strip ────────────────────────────────────────────────────────
bind('<button title="Comments" style="height:30px;',
     '<button title="Comments" sc-camel-on-click="{{ openComments }}" style="height:30px;')
bind('<button title="Editing mode" style="height:30px;',
     '<button title="Editing mode" sc-camel-on-click="{{ openEditing }}" style="height:30px;')
bind('<button style="height:30px;padding:0 14px;border:0;border-radius:8px;background:linear-gradient(135deg,#e5c76b 0%,#d4af37 50%,#b8860b 100%);color:#1a1405;font-weight:600;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px" style-hover="background:var(--t32,#e3c378)"><i class="icon-share-2"',
     '<button title="Share" sc-camel-on-click="{{ openShare }}" style="height:30px;padding:0 14px;border:0;border-radius:8px;background:linear-gradient(135deg,#e5c76b 0%,#d4af37 50%,#b8860b 100%);color:#1a1405;font-weight:600;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px" style-hover="background:var(--t32,#e3c378)"><i class="icon-share-2"')
bind('<button sc-camel-on-click="{{ togglePragna }}" title="Pragna" style="height:30px;padding:0 12px;border:1px solid rgba(212,175,55,0.3);background:rgba(212,175,55,0.06);',
     '<button sc-camel-on-click="{{ togglePragna }}" title="Pragna" aria-pressed="{{ pragnaOpen }}" style="height:30px;padding:0 12px;border:0;background:transparent;')

# ── Home ribbon ──────────────────────────────────────────────────────
bind('<div style="height:26px;width:136px;padding:0 8px;box-sizing:border-box;border-radius:6px;background:var(--t10,#1a1a1d);border:1px solid rgba(var(--ink,255,255,255),0.06);display:flex;align-items:center;justify-content:space-between;font-size:14px;font-family:Lora,serif;color:var(--t20,#e8e6e1)">Lora<i class="icon-chevron-down" style="font-size:12px;color:var(--t28,#6f6d68)"></i></div>',
     '<sc-slot name="fontFamily"></sc-slot>')
bind('<div style="height:26px;width:56px;padding:0 8px;box-sizing:border-box;border-radius:6px;background:var(--t10,#1a1a1d);border:1px solid rgba(var(--ink,255,255,255),0.06);display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--t20,#e8e6e1)">12<i class="icon-chevron-down" style="font-size:12px;color:var(--t28,#6f6d68)"></i></div>',
     '<sc-slot name="fontSize"></sc-slot>')
bind('<button title="{{ f.label }}" sc-camel-on-mouse-down="{{ f.run }}" style="width:28px;height:28px;border:0;background:transparent;border-radius:6px;cursor:pointer;color:var(--t22,#c4c2bd);',
     '<button title="{{ f.label }}" aria-pressed="{{ f.on }}" sc-camel-on-mouse-down="{{ f.run }}" style="width:28px;height:28px;border:0;background:{{ f.bg }};border-radius:6px;cursor:pointer;color:{{ f.color }};', 3)

# ── Canvas ───────────────────────────────────────────────────────────
bind('<button style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;',
     '<button sc-camel-on-click="{{ st.run }}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;', 2)

# Generic ribbon controls need real disabled states and active design anchors.
bind('<button title="{{ it.label }}" sc-camel-on-click="{{ it.run }}"',
     '<button title="{{ it.title }}" sc-camel-on-click="{{ it.run }}" disabled="{{ it.disabled }}" aria-pressed="{{ it.on }}" data-design-trigger="true" data-design-name="{{ it.feature }}"', 4)
bind('<div title="{{ gi.name }}"', '<div role="button" aria-label="{{ gi.name }}" title="{{ gi.name }}" sc-camel-on-click="{{ gi.run }}"', 1)

# ── Status bar ───────────────────────────────────────────────────────
bind('cursor:pointer" style-hover="color:var(--t18,#f1efea)">Page 1 of 1</button>',
     'cursor:pointer" style-hover="color:var(--t18,#f1efea)">{{ pageLabel }}</button>')
bind('<span style="width:6px;height:6px;border-radius:50%;background:#6bbf7a"></span>Live · 1 collaborator</span>',
     '<span style="width:6px;height:6px;border-radius:50%;background:{{ liveDot }}"></span>{{ liveLabel }}</span>')
bind('<span style="display:flex;align-items:center;gap:5px;cursor:pointer"><i class="icon-monitor" style="font-size:13px"></i>Focus</span>',
     '<span role="button" aria-pressed="{{ focusOn }}" sc-camel-on-click="{{ toggleFocus }}" style="display:flex;align-items:center;gap:5px;cursor:pointer;color:{{ focusColor }}"><i class="icon-monitor" style="font-size:13px"></i>Focus</span>')
bind('<button title="Read Mode" style="width:24px;height:22px;border:0;border-radius:4px;background:transparent;color:var(--t25,#8b8984);cursor:pointer"',
     '<button title="Read Mode" sc-camel-on-click="{{ view.read }}" style="width:24px;height:22px;border:0;border-radius:4px;background:{{ view.readBg }};color:{{ view.readColor }};cursor:pointer"')
bind('<button title="Print Layout" style="width:24px;height:22px;border:0;border-radius:4px;background:rgba(212,175,55,0.14);color:var(--t32,#e3c378);cursor:pointer"',
     '<button title="Print Layout" sc-camel-on-click="{{ view.print }}" style="width:24px;height:22px;border:0;border-radius:4px;background:{{ view.printBg }};color:{{ view.printColor }};cursor:pointer"')
bind('<button title="Web Layout" style="width:24px;height:22px;border:0;border-radius:4px;background:transparent;color:var(--t25,#8b8984);cursor:pointer"',
     '<button title="Web Layout" sc-camel-on-click="{{ view.web }}" style="width:24px;height:22px;border:0;border-radius:4px;background:{{ view.webBg }};color:{{ view.webColor }};cursor:pointer"')

bind('<div style="width:100px;height:3px;border-radius:2px;background:var(--t15,#2a2a2e);position:relative"><div style="position:absolute;left:{{ zoomPos }};top:-4px;width:2px;height:11px;margin-left:-1px;background:var(--t20,#e8e6e1)"></div></div>',
     '<div style="width:100px;height:3px;border-radius:2px;background:var(--t15,#2a2a2e);position:relative"><div style="position:absolute;left:{{ zoomPos }};top:-4px;width:2px;height:11px;margin-left:-1px;background:var(--t20,#e8e6e1)"></div><sc-slot name="zoomInput"></sc-slot></div>')
bind('<span style="width:34px;text-align:right">{{ zoomLabel }}</span>',
     '<span role="button" title="Reset zoom" sc-camel-on-click="{{ zoomReset }}" style="width:34px;text-align:right;cursor:pointer">{{ zoomLabel }}</span>')

# Account and plan controls are keyboard reachable.
bind('<span title="{{ planTitle }}"', '<span role="button" aria-label="View plans" title="{{ planTitle }}"')
bind('<div title="{{ avatarTitle }}"', '<div role="button" aria-label="Account menu" title="{{ avatarTitle }}"')

# ── Backstage Save ───────────────────────────────────────────────────
bind('<button style="height:36px;padding:0 16px;border:0;border-radius:8px;background:var(--t31,#d6b25e);color:#1a1405;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap"><i class="icon-save" style="font-size:15px"></i>Save now',
     '<button sc-camel-on-click="{{ saveNow }}" disabled="{{ saveBusy }}" style="height:36px;padding:0 16px;border:0;border-radius:8px;background:var(--t31,#d6b25e);color:#1a1405;font-weight:600;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;white-space:nowrap"><i class="icon-save" style="font-size:15px"></i>Save now')


def main():
    s = open(sys.argv[1], encoding='utf-8').read()
    for old, new, count in B:
        n = s.count(old)
        if n != count:
            sys.exit(f'bind: expected {count} match(es), found {n}: {old[:90]}')
        s = s.replace(old, new)
    # The editable title cannot be nested inside a button.
    start = s.index('<button sc-camel-on-click="{{ focusTitle }}"')
    end = s.index('</button>', start)
    s = s[:start] + s[start:end].replace('<button ', '<div class="studio-doc-title" ', 1) + '</div>' + s[end + len('</button>'):]
    brand_start = s.index('<div style="display:flex;align-items:center;gap:8px;margin-right:10px;flex:none">')
    brand_end = s.index('\n      <span', brand_start)
    s = s[:brand_start] + '<div style="display:flex;align-items:center;margin-right:10px;flex:none"><sc-slot name="brand"></sc-slot></div>' + s[brand_end:]
    nav_start = s.index('<div style="width:216px;flex:none;display:flex;flex-direction:column;')
    nav_open_end = s.index('>', nav_start) + 1
    s = s[:nav_open_end] + '<sc-slot name="brand"></sc-slot>' + s[nav_open_end:]
    s = s.replace('title="Back to editor"', 'title="Back to editor" aria-label="Back to editor"')
    # File screens use the reference markup with live document bindings.
    def patch_section(name, update):
        nonlocal s
        start = s.index('<sc-if value="{{ ' + name + ' }}"')
        depth = 0
        for match in re.finditer(r'<(/?)sc-if\b[^>]*>', s[start:]):
            depth += -1 if match.group(1) else 1
            if depth == 0:
                end = start + match.end()
                s = s[:start] + update(s[start:end]) + s[end:]
                break
    patch_section('fHome', lambda x: x.replace('sc-camel-on-click="{{ openEditor }}"', 'role="button" sc-camel-on-click="{{ tp.run }}"')
      .replace('<i class="icon-search" style="font-size:15px"></i>Search</div>', '<i class="icon-search" style="font-size:15px"></i><sc-slot name="fileSearch"></sc-slot></div>')
      .replace('>More documents<i', ' sc-camel-on-click="{{ goOpen }}">More documents<i')
      .replace('<div style="display:grid;grid-template-columns:minmax(0,1fr) 120px 150px 70px 72px;gap:12px;align-items:center;', '<div role="button" tabindex="0" sc-camel-on-click="{{ r.run }}" style="display:grid;grid-template-columns:minmax(0,1fr) 120px 150px 70px 72px;gap:12px;align-items:center;')
      .replace('<button title="Star"', '<button sc-camel-on-click="{{ r.star }}" title="Star" aria-pressed="{{ r.starred }}"')
      .replace('<button title="More"', '<button sc-camel-on-click="{{ r.more }}" title="More"')
      .replace('>You</span>', '>{{ r.owner }}</span>'))
    patch_section('fNew', lambda x: x.replace('sc-camel-on-click="{{ openEditor }}"', 'role="button" sc-camel-on-click="{{ tp.run }}"'))
    patch_section('fOpen', lambda x: x.replace('<input placeholder="Search documents"', '<input aria-label="Search documents" value="{{ search }}" sc-camel-on-change="{{ onSearch }}" placeholder="Search documents"')
      
      .replace('<div sc-camel-on-click="{{ d.select }}"', '<div role="button" sc-camel-on-click="{{ d.select }}" sc-camel-on-double-click="{{ d.run }}"')
      .replace('sc-camel-on-click="{{ openEditor }}"', 'sc-camel-on-click="{{ openSelected }}"'))
    patch_section('fSaveAs', lambda x: x.replace('sc-camel-default-value="Copy of Untitled Document"', 'aria-label="File name" value="{{ saveName }}" sc-camel-on-change="{{ onSaveName }}"')
      .replace('<sc-raw-select sc-camel-on-change="{{ pickFormat }}"', '<sc-raw-select aria-label="File format" value="{{ saveFormat }}" sc-camel-on-change="{{ pickFormat }}"')
      .replace('<button style="height:36px;padding:0 16px;border:0;', '<button sc-camel-on-click="{{ saveAs }}" disabled="{{ saveBusy }}" style="height:36px;padding:0 16px;border:0;'))
    patch_section('fExport', lambda x: x.replace('<button style="height:40px;border:0;', '<button sc-camel-on-click="{{ exportDocument }}" disabled="{{ exportBusy }}" style="height:40px;border:0;'))
    patch_section('fInfo', lambda x: x.replace('<button style=', '<button sc-camel-on-click="{{ a.run }}" style='))
    patch_section('fSettings', lambda x: x.replace('<sc-raw-select style=', '<sc-raw-select aria-label="{{ r.label }}" value="{{ r.value }}" sc-camel-on-change="{{ r.change }}" style=').replace('<button sc-camel-on-click="{{ r.toggle }}"', '<button role="switch" aria-label="{{ r.label }}" aria-checked="{{ r.on }}" sc-camel-on-click="{{ r.toggle }}"'))
    for name in ['fSave','fSaveAs','fPrint','fExport','fShare']:
        patch_section(name, lambda x: x.replace('Untitled Document', '{{ documentTitle }}'))
    def button_action(fragment, text, handler):
        def replace(match):
            if text in re.sub(r'<[^>]*>', '', match.group(2)):
                return '<button sc-camel-on-click="{{ ' + handler + ' }}"' + match.group(1) + '>' + match.group(2) + '</button>'
            return match.group(0)
        return re.sub(r'<button([^>]*)>((?:(?!</button>).)*)</button>', replace, fragment, flags=re.S)
    patch_section('fOpen', lambda x: button_action(x, 'Browse from device', 'browse'))
    patch_section('fPrint', lambda x: button_action(x, 'Print', 'printDocument'))
    patch_section('fShare', lambda x: button_action(button_action(x, 'Send', 'sendInvite'), 'Copy link', 'copyShareLink'))
    patch_section('fShare', lambda x: x.replace('<input placeholder="Add people by email"', '<input aria-label="Invite email" value="{{ inviteEmail }}" sc-camel-on-change="{{ onInviteEmail }}" placeholder="Add people by email"').replace('<sc-raw-select style="height:38px;', '<sc-raw-select aria-label="Invite role" value="{{ inviteRole }}" sc-camel-on-change="{{ onInviteRole }}" style="height:38px;',1).replace('<option>Can edit</option><option>Can comment</option><option>Can view</option>', '<option value="editor">Can edit</option><option value="commenter">Can comment</option><option value="viewer">Can view</option>',1))
    def share_patch(x):
        # One row per person with access (owner first), from the document's shares.
        row = re.search(r'<div style="display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:[^"]*">.*?>PA</div>.*?>You</div><span style="([^"]*)">Owner</span></div>', x, flags=re.S)
        looped = row.group(0).replace('>PA</div>', '>{{ person.initials }}</div>').replace('>You</div>', '>{{ person.name }}</div>').replace('>Owner</span>', '>{{ person.role }}</span>')
        x = x.replace(row.group(0), '<sc-for list="{{ people }}" as="person" hint-placeholder-count="1">' + looped + '</sc-for>', 1)
        # General access sets the share link's role; Restricted turns the link off.
        return re.sub(r'(<span[^>]*>Anyone with the link</span></div><sc-raw-select)( style="[^"]*">).*?(</sc-raw-select>)',
            lambda m: m.group(1) + ' aria-label="General access" value="{{ linkRole }}" sc-camel-on-change="{{ onLinkRole }}"' + m.group(2)
            + '<option value="viewer">Can view</option><option value="commenter">Can comment</option><option value="editor">Can edit</option><option value="restricted">Restricted</option>' + m.group(3), x, count=1, flags=re.S)
    patch_section('fShare', share_patch)
    def print_patch(x):
        # The browser's print dialog owns printer, copies, range, sides and pages per
        # sheet; a web page cannot set them, so the pane only offers page settings.
        x = re.sub(r'<div style="display:flex;flex-direction:column;gap:6px"><label[^>]*>Copies</label>.*?</div>', '', x, count=1, flags=re.S)
        note = '<div style="font-size:12.5px;line-height:1.5;color:var(--t25,#8b8984)">Printer, copies, page range and two-sided printing are chosen in your browser\'s print dialog.</div>'
        x = re.sub(r'<div style="display:flex;flex-direction:column;gap:6px"><label[^>]*>Printer</label>.*?</sc-raw-select></div>\s*<div style="display:flex;flex-direction:column;gap:6px"><label[^>]*>Pages</label>.*?</sc-raw-select></div>\s*<div style="display:flex;flex-direction:column;gap:6px"><label[^>]*>Sides</label>.*?</sc-raw-select></div>', note, x, count=1, flags=re.S)
        def select(label, binding, options):
            nonlocal x
            pattern = r'(<label[^>]*>' + label + r'</label><sc-raw-select)( style="[^"]*">).*?(</sc-raw-select>)'
            opts = ''.join('<option value="' + v + '">' + t + '</option>' for v, t in options)
            x = re.sub(pattern, lambda m: m.group(1) + ' aria-label="' + label + '" value="{{ ' + binding + ' }}" sc-camel-on-change="{{ on' + binding[0].upper() + binding[1:] + ' }}"' + m.group(2) + opts + m.group(3), x, count=1, flags=re.S)
        select('Orientation', 'printOrientation', [('portrait', 'Portrait'), ('landscape', 'Landscape')])
        select('Paper size', 'printSize', [('a4', 'A4'), ('letter', 'Letter'), ('legal', 'Legal'), ('a3', 'A3')])
        select('Margins', 'printMargin', [('normal', 'Normal'), ('narrow', 'Narrow'), ('moderate', 'Moderate'), ('wide', 'Wide')])
        x = re.sub(r'<div style="display:flex;flex-direction:column;gap:6px"><label[^>]*>Per sheet</label>.*?</sc-raw-select></div>', '', x, count=1, flags=re.S)
        x = re.sub(r'<div style="width:100%;max-width:340px;aspect-ratio:0.707;.*?</div></div><span style="font-size:12px;color:var\(--t27,#7d7b76\)">Page 1 of 1</span>', '<sc-slot name="printPreview"></sc-slot>', x, count=1, flags=re.S)
        return x
    patch_section('fPrint', print_patch)
    patch_section('fPlans', lambda x: x.replace('<button style=', '<button sc-camel-on-click="{{ pl.run }}" style='))
    # Layout metric fields retain the reference shape with editable controls.
    s = re.sub(r'<div style="height:24px;width:84px;[^>]*>\{\{ fd.value \}\}<i[^>]*></i></div>', '<sc-slot name="fd.control"></sc-slot>', s)
    s = s.replace('>Pro plan</span>', '>{{ planLabel }}</span>').replace('>7 documents</span>', '>{{ documentCount }}</span>')
    # Keep the requested ribbon layout and Save behaviour in generated views.
    for title in ['Replace', 'Scroll up', 'Scroll down', 'Inspector']:
        s = re.sub(r'<button\b[^>]*title="' + re.escape(title) + r'"[^>]*>.*?</button>', '', s, count=1, flags=re.S)
    s = s.replace('title="Find"', 'title="Find &amp; Replace"').replace('</rb-icon>Find</button>', '</rb-icon>Find &amp; Replace</button>')
    s = s.replace('<div style="display:flex;flex-direction:column;gap:2px"></div>', '')
    s = re.sub(r'>Styles<i\b[^>]*title="More options"[^>]*></i></div>', '>Styles</div>', s)
    editor_title = s.find('title="Editor"')
    if editor_title >= 0:
        group = '<div style="display:flex;flex-direction:column;gap:4px;padding:0 4px;flex:none">'
        start = s.rfind(group, 0, editor_title)
        end = s.index('>Editor</div></div>', editor_title) + len('>Editor</div></div>')
        s = s[:start] + s[end:]
    divider = '<div style="width:1px;background:rgba(var(--ink,255,255,255),0.06);margin:6px 12px 10px;flex:none"></div>'
    s = s.replace(divider + divider, divider)
    start = s.index('<sc-for list="{{ g.gallery }}"')
    depth = 0
    for match in re.finditer(r'<(/?)sc-for\b[^>]*>', s[start:]):
        depth += -1 if match.group(1) else 1
        if depth == 0:
            end = start + match.end()
            break
    header = '<div style="display:flex;flex-direction:column;gap:4px"><sc-if value="{{ g.themeHeader }}"><span style="height:18px;color:var(--t25);font-size:11px">Themes</span></sc-if><div style="display:flex;gap:4px;flex:1">'
    s = s[:start] + header + s[start:end] + '</div></div>' + s[end:]
    patch_section('fSave', lambda x: x.replace('Your changes are saved to EtherX Cloud automatically', '{{ saveDescription }}')
      .replace('All changes saved', '{{ saveStatus }}')
      .replace('EtherX Cloud · My Documents · just now', '{{ savedTime }}')
      .replace('sc-camel-default-value="{{ documentTitle }}"', 'value="{{ documentTitle }}" sc-camel-on-change="{{ onDocumentTitle }}"'))
    sys.stdout.write(s)


if __name__ == '__main__':
    main()
