import { useRef } from 'react';
import { useUIStore, useEditorStore, useDocumentStore } from '@/store';

export function InsertTab() {
  const { openDialog, toast, setHeaderFooterTab } = useUIStore();
  const { editor } = useEditorStore();
  const { title } = useDocumentStore();
  const commentCount = useRef(1);

  const run = (fn) => {
    if (!editor) {
      toast('Editor is not ready yet', 'info');
      return;
    }
    editor.chain().focus().run();
    fn?.();
    editor.view?.focus();
  };

  const insertHtml = (html) => run(() => editor.chain().focus().insertContent(html).run());

  const insertCoverPage = () => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const safeTitle = (title || 'Untitled Document').replace(/[<>]/g, '');
    run(() => {
      editor.chain().focus().insertContentAt(0, `
        <div style="height:72vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;page-break-after:always;">
          <div style="font-size:44px;font-weight:700;letter-spacing:0.02em;margin-bottom:14px;">${safeTitle}</div>
          <div style="font-size:18px;opacity:0.75;margin-bottom:28px;">Created with EtherX Word</div>
          <div style="font-size:14px;opacity:0.65;">${today}</div>
        </div>
      `).run();
    });
    toast('Cover page inserted', 'success');
  };

  const insertBookmark = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      toast('Select text first to create a bookmark', 'info');
      return;
    }
    const selected = editor.state.doc.textBetween(from, to, ' ').trim();
    const base = selected.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `bookmark-${Date.now()}`;
    const id = `bm-${base}-${Date.now().toString().slice(-4)}`;
    run(() => editor.chain().focus().insertContentAt({ from, to }, `<span id="${id}" data-bookmark="${id}">${selected}</span>`).run());
    toast(`Bookmark created: ${id}`, 'success');
  };

  const insertCrossReference = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const m = html.match(/data-bookmark="([^"]+)"/);
    if (!m) {
      toast('Create a bookmark first, then insert cross-reference', 'info');
      return;
    }
    const id = m[1];
    insertHtml(`<a href="#${id}">See ${id}</a>`);
    toast('Cross-reference inserted', 'success');
  };

  const addCommentMark = () => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    if (from === to) {
      toast('Select text first to add a comment', 'info');
      return;
    }
    const n = commentCount.current++;
    run(() => {
      editor.chain().focus().setTextSelection({ from, to }).toggleHighlight({ color: '#fff59d' }).run();
      editor.chain().focus().insertContentAt(to, `<sup data-comment="${n}" style="color:#777;font-size:10px;">[${n}]</sup>`).run();
    });
    toast('Comment marker inserted', 'success');
  };

  const insertSmartArt = () => {
    insertHtml(`
      <div style="border:2px solid #4a90e2;padding:16px;margin:12px 0;border-radius:4px;background:#f9f9f9;" data-smartart="true">
        <div style="font-weight:700;margin-bottom:12px;color:#4a90e2;display:flex;justify-content:space-between;align-items:center;">
          <span>SmartArt Process</span>
          <span style="font-size:11px;font-weight:400;color:#999;">[Editable]</span>
        </div>
        <div style="display:flex;gap:16px;justify-content:space-around;align-items:flex-start;flex-wrap:wrap;">
          <div style="flex:1;min-width:120px;padding:12px;background:#fff;border:1px solid #ddd;border-radius:3px;cursor:text;" contenteditable="true">Step 1</div>
          <div style="display:flex;align-items:center;color:#999;padding:0 8px;">→</div>
          <div style="flex:1;min-width:120px;padding:12px;background:#fff;border:1px solid #ddd;border-radius:3px;cursor:text;" contenteditable="true">Step 2</div>
          <div style="display:flex;align-items:center;color:#999;padding:0 8px;">→</div>
          <div style="flex:1;min-width:120px;padding:12px;background:#fff;border:1px solid #ddd;border-radius:3px;cursor:text;" contenteditable="true">Step 3</div>
        </div>
      </div>
    `);
    toast('Editable SmartArt inserted', 'success');
  };

  const insertQuickPart = () => {
    const now = new Date().toLocaleString();
    insertHtml(`<span style="border:1px solid #d7d7d7;padding:2px 6px;background:#f8f8f8;">${title || 'Untitled'} - ${now}</span>`);
    toast('Quick Part inserted', 'success');
  };

  const insertDropCap = () => {
    if (!editor) return;
    const { $from } = editor.state.selection;
    const start = $from.start($from.depth);
    const paragraphText = $from.parent.textContent || '';
    const first = paragraphText[0];
    if (!first) {
      toast('Place cursor inside a paragraph with text', 'info');
      return;
    }
    run(() => editor.chain().focus().insertContentAt({ from: start, to: start + 1 }, `<span style="float:left;font-size:2.4em;line-height:0.9;padding-right:4px;font-family:serif;">${first}</span>`).run());
    toast('Drop cap applied', 'success');
  };

  const insertSignatureLine = () => {
    insertHtml(`
      <div style="margin:18px 0 10px 0;max-width:320px;">
        <div style="border-bottom:1px solid #444;height:16px;"></div>
        <div style="font-size:11px;color:#666;margin-top:4px;">Signature</div>
      </div>
    `);
    toast('Signature line inserted', 'success');
  };

  const insertObjectPlaceholder = () => {
    const objectId = `obj-${Date.now()}`;
    insertHtml(`
      <div style="border:2px solid #9b59b6;border-radius:4px;padding:16px;margin:12px 0;background:#f5f5f5;display:inline-block;min-width:200px;" data-object-id="${objectId}" data-object-type="embedded">
        <div style="font-weight:600;color:#9b59b6;margin-bottom:8px;">Embedded Object</div>
        <div style="font-size:12px;color:#666;margin-bottom:10px;">Object ID: ${objectId}</div>
        <input type="text" placeholder="Object URL or Path" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:3px;font-size:12px;margin-bottom:8px;" />
        <div style="font-size:11px;color:#999;">
          Embedded objects require compatible viewers in exported documents. You can reference external files or embed media objects.
        </div>
      </div>
    `);
    toast('Embedded object placeholder inserted', 'success');
  };

  const insertEsignFields = () => {
    insertHtml(`
      <table style="border-collapse:collapse;width:100%;margin:8px 0;">
        <tr>
          <td style="border:1px solid #d4d4d4;padding:8px;">Signer Name</td>
          <td style="border:1px solid #d4d4d4;padding:8px;">Signature</td>
          <td style="border:1px solid #d4d4d4;padding:8px;">Date</td>
        </tr>
      </table>
    `);
    toast('eSignature fields inserted', 'success');
  };

  const openHeaderFooter = (tab) => {
    setHeaderFooterTab(tab);
    openDialog('headerFooter');
  };

  const wrap = {
    display: 'flex',
    alignItems: 'stretch',
    height: '100%',
    width: '100%',
    minWidth: 1860,
    background: 'var(--ribbon-surface)',
    border: '1px solid var(--ribbon-divider)',
    borderTop: 'none',
    fontFamily: 'var(--font-ui)',
  };

  const group = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    borderRight: '1px solid var(--ribbon-divider)',
    padding: '3px 7px 2px 7px',
    minHeight: 86,
  };

  const cmds = { display: 'flex', alignItems: 'flex-start', gap: 4 };
  const stack = { display: 'flex', flexDirection: 'column', gap: 2 };
  const footer = { fontSize: 11, color: 'var(--ribbon-ink)', textAlign: 'center', lineHeight: 1 };

  const iconBox = (kind) => {
    const base = {
      width: 32,
      height: 26,
      border: '1px solid var(--ribbon-divider)',
      background: 'var(--ribbon-surface-2)',
      position: 'relative',
      boxSizing: 'border-box',
    };
    if (kind === 'table') {
      return <div style={{ ...base, backgroundImage: 'linear-gradient(var(--ribbon-divider) 1px, transparent 1px), linear-gradient(90deg,var(--ribbon-divider) 1px, transparent 1px)', backgroundSize: '8px 8px' }} />;
    }
    if (kind === 'picture') {
      return <div style={base}><div style={{ position: 'absolute', left: 2, bottom: 2, width: 18, height: 9, background: '#c9a84c', clipPath: 'polygon(0 100%, 35% 35%, 60% 70%, 75% 50%, 100% 100%)' }} /><div style={{ position: 'absolute', right: 4, top: 4, width: 4, height: 4, background: '#e7cd7a', borderRadius: '50%' }} /></div>;
    }
    if (kind === 'chart') {
      return <div style={base}><div style={{ position: 'absolute', bottom: 2, left: 4, width: 5, height: 12, background: '#8a7236' }} /><div style={{ position: 'absolute', bottom: 2, left: 12, width: 5, height: 16, background: '#c9a84c' }} /><div style={{ position: 'absolute', bottom: 2, left: 20, width: 5, height: 20, background: '#e7cd7a' }} /></div>;
    }
    if (kind === 'link') {
      return <div style={{ ...base, border: 'none', background: 'transparent', width: 26 }}><div style={{ position: 'absolute', width: 10, height: 6, border: '2px solid #6a6a6a', borderRadius: 6, left: 1, top: 8 }} /><div style={{ position: 'absolute', width: 10, height: 6, border: '2px solid #6a6a6a', borderRadius: 6, left: 11, top: 8 }} /></div>;
    }
    return <div style={base} />;
  };

  const cmdStyle = {
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 2,
    cursor: 'pointer',
    color: 'var(--ribbon-ink)',
    width: 54,
    minHeight: 66,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '2px 2px 1px 2px',
  };

  const textBtn = {
    border: '1px solid transparent',
    background: 'transparent',
    borderRadius: 2,
    cursor: 'pointer',
    color: 'var(--ribbon-ink)',
    minHeight: 23,
    fontSize: 12,
    textAlign: 'left',
    padding: '2px 6px',
    whiteSpace: 'nowrap',
  };

  const label = (t, dd = false) => <span style={{ fontSize: 12, lineHeight: 1.05, textAlign: 'center' }}>{t}{dd ? ' v' : ''}</span>;

  return (
    <div style={wrap}>
      <div style={group}>
        <div style={stack}>
          <button style={textBtn} onClick={insertCoverPage}>Cover Page v</button>
          <button style={textBtn} onClick={() => run(() => editor.chain().focus().insertPageBreak().run())}>Blank Page</button>
          <button style={textBtn} onClick={() => run(() => editor.chain().focus().insertPageBreak().run())}>Page Break</button>
        </div>
        <div style={footer}>Pages</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('insertTable')}>
            {iconBox('table')}
            {label('Table', true)}
          </button>
        </div>
        <div style={footer}>Tables</div>
      </div>

      <div style={{ ...group, minWidth: 390 }}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('insertImage')}>{iconBox('picture')}{label('Pictures', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertShape')}>{iconBox('picture')}{label('Shapes', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertSymbol')}>{iconBox('picture')}{label('Icons', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insert3DModel')}>{iconBox('picture')}{label('3D Models', true)}</button>
          <button style={cmdStyle} onClick={insertSmartArt}>{iconBox('picture')}{label('SmartArt', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertChart')}>{iconBox('chart')}{label('Chart', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('screenshot')}>{iconBox('picture')}{label('Screenshot', true)}</button>
        </div>
        <div style={footer}>Illustrations</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('insertVideo')}>{iconBox('picture')}{label('Online Videos')}</button>
        </div>
        <div style={footer}>Media</div>
      </div>

      <div style={group}>
        <div style={stack}>
          <button style={textBtn} onClick={() => openDialog('insertLink')}>Link</button>
          <button style={textBtn} onClick={insertBookmark}>Bookmark</button>
          <button style={textBtn} onClick={insertCrossReference}>Cross-reference</button>
        </div>
        <div style={footer}>Links</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={addCommentMark}>{iconBox('picture')}{label('Comment')}</button>
        </div>
        <div style={footer}>Comments</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openHeaderFooter('header')}>{iconBox('picture')}{label('Header', true)}</button>
          <button style={cmdStyle} onClick={() => openHeaderFooter('footer')}>{iconBox('picture')}{label('Footer', true)}</button>
          <button style={cmdStyle} onClick={() => openHeaderFooter('pagenum')}>{iconBox('picture')}{label('Page Number', true)}</button>
        </div>
        <div style={footer}>Header & Footer</div>
      </div>

      <div style={{ ...group, minWidth: 360 }}>
        <div style={cmds}>
          <button
            style={cmdStyle}
            onClick={() => {
              if (!editor) return;
              const boxId = `textbox-${Date.now()}`;
              run(() => {
                editor
                  .chain()
                  .focus()
                  .insertContent(`<div id="${boxId}" style="border:2px solid #4472c4;border-radius:4px;padding:12px;margin:8px 0;background:#f0f7ff;cursor:text;min-width:200px;min-height:60px;" contenteditable="true" data-textbox="true"><span style="color:#999;font-style:italic;">Click to type</span></div>`)
                  .run();
              });
              toast('Text box inserted', 'success');
            }}
          >
            {iconBox('picture')}{label('Text Box', true)}
          </button>
          <button style={cmdStyle} onClick={insertQuickPart}>{iconBox('picture')}{label('Quick Parts', true)}</button>
          <button style={cmdStyle} onClick={() => insertSignatureLine()}>{iconBox('picture')}{label('Signature Line', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('wordArt')}>{iconBox('picture')}{label('WordArt', true)}</button>
          <button style={cmdStyle} onClick={insertDropCap}>{iconBox('picture')}{label('Drop Cap', true)}</button>
          <button style={cmdStyle} onClick={() => insertHtml(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}>{iconBox('picture')}{label('Date & Time', true)}</button>
          <button style={cmdStyle} onClick={insertObjectPlaceholder}>{iconBox('picture')}{label('Object', true)}</button>
        </div>
        <div style={footer}>Text</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('equation')}>{iconBox('picture')}{label('Equation', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertSymbol')}>{iconBox('picture')}{label('Symbol', true)}</button>
        </div>
        <div style={footer}>Symbols</div>
      </div>

      <div style={{ ...group, borderRight: 'none', minWidth: 120 }}>
        <div style={cmds}>
          <button style={{ ...cmdStyle, width: 98 }} onClick={insertEsignFields}>{iconBox('picture')}{label('eSignature fields')}</button>
        </div>
        <div style={footer}>eSignature</div>
      </div>
    </div>
  );
}
