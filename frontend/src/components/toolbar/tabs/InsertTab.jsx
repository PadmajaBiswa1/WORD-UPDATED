import { useUIStore, useEditorStore, useDocumentStore } from '@/store';

export function InsertTab() {
  const { openDialog, toast, setHeaderFooterTab } = useUIStore();
  const { editor } = useEditorStore();
  const { title } = useDocumentStore();

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

  const insertSignatureField = () => {
    const fieldId = `sig-${Date.now()}`;
    insertHtml(`
      <div id="${fieldId}" data-signature-field="true" style="border: 2px dashed #c9a84c; border-radius: 6px; padding: 14px 18px; margin: 16px 0; max-width: 380px; background: rgba(212,175,55,0.05);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(212,175,55,0.3); padding-bottom: 6px; margin-bottom: 10px;">
          <span style="font-size: 11px; font-weight: 700; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.05em;">Digital Signature Field</span>
          <span style="font-size: 10px; background: #22c55e; color: #fff; padding: 1px 6px; border-radius: 999px;">PENDING SIGNATURE</span>
        </div>
        <div style="font-size: 12px; color: #aaa; margin-bottom: 16px;">Click or sign digitally with Web Crypto key</div>
        <div style="border-bottom: 1px solid #777; width: 100%; height: 20px;"></div>
        <div style="display: flex; justify-content: space-between; font-size: 10px; color: #888; margin-top: 4px;">
          <span>Authorized Signatory</span>
          <span>Date: ________________</span>
        </div>
      </div>
    `);
    toast('Digital signature field inserted', 'success');
  };

  const insertSignatureLine = () => {
    insertSignatureField();
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
    minWidth: 1240,
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
    if (kind === 'page') {
      return <div style={{ ...base, width: 24, height: 26 }}><div style={{ position: 'absolute', left: 4, top: 3, width: 14, height: 18, border: '1px solid #c9a84c', background: 'transparent' }} /><div style={{ position: 'absolute', left: 2, top: 12, width: 18, height: 1, background: '#e7cd7a', borderStyle: 'dashed' }} /></div>;
    }
    if (kind === 'signature') {
      return (
        <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <path d="m9 15 2 2 4-4" />
          </svg>
        </div>
      );
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

  const label = (t, dd = false) => <span style={{ fontSize: 12, lineHeight: 1.05, textAlign: 'center' }}>{t}{dd ? ' v' : ''}</span>;

  return (
    <>
      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => run(() => editor.chain().focus().insertPageBreak().run())}>
            {iconBox('page')}
            {label('Page Break')}
          </button>
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

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('insertImage')}>{iconBox('picture')}{label('Pictures', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertShape')}>{iconBox('picture')}{label('Shapes', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('insertChart')}>{iconBox('chart')}{label('Chart', true)}</button>
          <button style={cmdStyle} onClick={() => openDialog('screenshot')}>{iconBox('picture')}{label('Screenshot', true)}</button>
        </div>
        <div style={footer}>Illustrations</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('insertLink')}>
            {iconBox('link')}
            {label('Link')}
          </button>
        </div>
        <div style={footer}>Links</div>
      </div>

      <div style={group}>
        <div style={cmds}>
          <button style={cmdStyle} onClick={() => openDialog('comments')}>
            {iconBox('picture')}
            {label('Comment')}
          </button>
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

      <div style={group}>
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
          <button style={cmdStyle} onClick={() => openDialog('buildingBlocks')}>{iconBox('picture')}{label('Quick Parts', true)}</button>
          <button style={cmdStyle} onClick={insertSignatureField}>{iconBox('picture')}{label('Signature Field')}</button>
          <button style={cmdStyle} onClick={() => openDialog('wordArt')}>{iconBox('picture')}{label('WordArt', true)}</button>
          <button style={cmdStyle} onClick={insertDropCap}>{iconBox('picture')}{label('Drop Cap', true)}</button>
          <button style={cmdStyle} onClick={() => insertHtml(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }))}>{iconBox('picture')}{label('Date & Time', true)}</button>
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

      <div style={{ ...group, borderRight: 'none' }}>
        <div style={cmds}>
          <button style={{ ...cmdStyle, width: 72 }} onClick={() => openDialog('digitalSignature')}>
            {iconBox('signature')}
            {label('Digital Sign')}
          </button>
          <button style={{ ...cmdStyle, width: 66 }} onClick={insertSignatureField}>
            {iconBox('picture')}
            {label('Sig Field')}
          </button>
          <button style={{ ...cmdStyle, width: 66 }} onClick={insertEsignFields}>
            {iconBox('table')}
            {label('eSign Table')}
          </button>
        </div>
        <div style={footer}>Digital Signatures</div>
      </div>
    </>
  );
}
