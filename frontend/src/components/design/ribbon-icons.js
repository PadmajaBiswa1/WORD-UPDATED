(() => {
  const G = 'var(--rbi-gold,#d4af37)';
  const L = 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"';
  const GL = `fill="none" stroke="${G}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  const SF = 'fill="currentColor" fill-opacity=".07"';
  const GF = `fill="${G}"`;
  const GS = `fill="${G}" fill-opacity=".28"`;
  const page = (x = 7, y = 3, w = 18, h = 26) => `<path d="M${x} ${y}h${w - 6}l6 6v${h - 6}H${x}z" ${L} ${SF.replace('fill="currentColor"', '')} style="fill:currentColor;fill-opacity:.07"/><path d="M${x + w - 6} ${y}v6h6" ${L}/>`;
  const lines = (x, y, n, w, gap = 3.5, attrs = L) => Array.from({ length: n }, (_, i) => `<path d="M${x} ${y + i * gap}h${Array.isArray(w) ? w[i % w.length] : w}" ${attrs}/>`).join('');
  const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M${x} ${y + 5}h${w}" ${L}/>`;
  const I = {
    'clipboard-paste': `<rect x="5" y="6" width="16" height="22" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="9" y="3.5" width="8" height="5" rx="1.5" ${GF}/>${page(14, 13, 13, 16)}${lines(17, 21, 3, [7, 7, 4], 3)}`,
    'history': `<path d="M6 16a10 10 0 1 0 3-7.1" ${L}/><path d="M5 5v5h5" ${GL}/><path d="M16 10v6l4 3" ${GL}/>`,
    'scan-search': `${page(5, 3, 17, 24)}${lines(9, 13, 3, [9, 7, 5], 3.5)}<circle cx="21" cy="21" r="5" ${GS}/><circle cx="21" cy="21" r="5" ${GL}/><path d="M24.6 24.6 28 28" ${GL} stroke-width="2.2"/>`,
    'mic': `<rect x="11" y="3" width="10" height="17" rx="5" ${GS}/><rect x="11" y="3" width="10" height="17" rx="5" ${GL}/><path d="M7 15a9 9 0 0 0 18 0M16 24v5M11 29h10" ${L}/>`,
    'pen-line': `${page(4, 3, 17, 24)}${lines(8, 13, 3, [9, 7, 9], 3.5)}<path d="M18 26l1-4 9-9 3 3-9 9z" ${GS}/><path d="M18 26l1-4 9-9 3 3-9 9z" ${GL}/>`,
    'sparkles': `<path d="M14 4l2.5 7.5L24 14l-7.5 2.5L14 24l-2.5-7.5L4 14l7.5-2.5z" ${GF}/><path d="M24 20l1.2 3.3 3.3 1.2-3.3 1.2L24 29l-1.2-3.3-3.3-1.2 3.3-1.2z" ${GF} opacity=".7"/>`,
    'table': `<rect x="4" y="6" width="24" height="20" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="4" y="6" width="24" height="5" rx="2" ${GS}/><path d="M4 11h24M4 16h24M4 21h24M12 6v20M20 6v20" ${L}/>`,
    'image': `<rect x="4" y="6" width="24" height="20" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><circle cx="11" cy="12" r="2.5" ${GF}/><path d="M4 23l7-7 5 5 4-4 8 8" ${L}/>`,
    'shapes': `<circle cx="11" cy="11" r="6.5" ${GS}/><circle cx="11" cy="11" r="6.5" ${GL}/><rect x="15" y="15" width="12" height="12" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M4 28l4.5-8 4.5 8z" ${L}/>`,
    'smile': `<circle cx="16" cy="16" r="11" ${GS}/><circle cx="16" cy="16" r="11" ${GL}/><path d="M11.5 18.5a5.5 5.5 0 0 0 9 0" ${L}/><circle cx="12.5" cy="13" r="1.2" fill="currentColor"/><circle cx="19.5" cy="13" r="1.2" fill="currentColor"/>`,
    'box': `<path d="M16 4 27 9.5v13L16 28 5 22.5v-13z" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M16 4 27 9.5 16 15 5 9.5z" ${GS}/><path d="M16 4 27 9.5 16 15 5 9.5z M16 15v13" ${L}/>`,
    'network': `<rect x="11" y="3" width="10" height="7" rx="1.5" ${GS}/><rect x="11" y="3" width="10" height="7" rx="1.5" ${GL}/><rect x="3" y="22" width="10" height="7" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="19" y="22" width="10" height="7" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M16 10v6M8 22v-6h16v6" ${L}/>`,
    'chart-column': `<path d="M4 28h24" ${L}/><rect x="6" y="15" width="5" height="13" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="13.5" y="7" width="5" height="21" rx="1" ${GS}/><rect x="13.5" y="7" width="5" height="21" rx="1" ${GL}/><rect x="21" y="11" width="5" height="17" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/>`,
    'camera': `<path d="M4 11a2 2 0 0 1 2-2h4l2-3h8l2 3h4a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" ${L} style="fill:currentColor;fill-opacity:.07"/><circle cx="16" cy="17" r="5" ${GS}/><circle cx="16" cy="17" r="5" ${GL}/>`,
    'clapperboard': `<rect x="4" y="7" width="24" height="18" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M13 12v8l7-4z" ${GF}/>`,
    'message-square-plus': `<path d="M4 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H12l-6 5v-5H6a2 2 0 0 1-2-2z" ${GS}/><path d="M4 7a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H12l-6 5v-5H6a2 2 0 0 1-2-2z" ${GL}/><path d="M16 9v10M11 14h10" ${L}/>`,
    'panel-top': `${page()}<rect x="9.5" y="6" width="11" height="4" rx="1" ${GF}/>${lines(10, 15, 4, [12, 12, 12, 8], 3.5)}`,
    'panel-bottom': `${page()}${lines(10, 8, 4, [12, 12, 12, 8], 3.5)}<rect x="9.5" y="22.5" width="13" height="4" rx="1" ${GF}/>`,
    'hash': `${page()}${lines(10, 11, 3, [12, 12, 8], 3.5)}<rect x="17" y="21" width="6" height="6" rx="1" ${GF}/>`,
    'text-cursor-input': `<rect x="4" y="7" width="24" height="18" rx="1.5" ${L} stroke-dasharray="3 2" style="fill:currentColor;fill-opacity:.07"/>${lines(8, 12.5, 3, [14, 14, 9], 3.5)}<path d="M21 18v7" ${GL}/>`,
    'signature': `<path d="M4 25h24" ${L}/><path d="M6 20c3-9 5-12 6-10s-3 10 0 9 4-6 6-6-1 5 2 5 4-3 6-3" ${GL}/><path d="M6 28l2-2" ${L}/>`,
    'palette': `<rect x="4" y="5" width="11" height="10" rx="1.5" ${GF}/><rect x="17" y="5" width="11" height="10" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="4" y="17" width="11" height="10" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="17" y="17" width="11" height="10" rx="1.5" ${GS}/>`,
    'swatch-book': `<rect x="4" y="6" width="8" height="20" rx="1.5" ${GF}/><rect x="12" y="6" width="8" height="20" ${GS}/><rect x="20" y="6" width="8" height="20" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="4" y="6" width="24" height="20" rx="1.5" ${L}/>`,
    'type': `<path d="M8 23 16 5l8 18M11 17h10" ${L} stroke-width="1.8"/><path d="M5 27.5h22" ${GL} stroke-width="2.4"/>`,
    'droplets': `${page()}<path d="M10 22 20 12" ${GL} stroke-width="3" opacity=".55"/>${lines(10, 9, 1, 8)}`,
    'paint-bucket': `<path d="M7 3h12l6 6v20H7z" ${GS}/>${page()}`,
    'square': `${page()}<rect x="9.5" y="11" width="13" height="15.5" ${GL}/>`,
    'square-dashed': `${page()}<rect x="10" y="10" width="12" height="16" ${GL} stroke-dasharray="2 2"/>`,
    'rotate-cw': `<rect x="5" y="3" width="12" height="17" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="11" y="16" width="17" height="12" rx="1" ${GS}/><rect x="11" y="16" width="17" height="12" rx="1" ${GL}/><path d="M21 6a6 6 0 0 1 5 6M24 10l2 2 2-2" ${L}/>`,
    'file': `${page(9, 3, 18, 26)}<path d="M5 6v20M3.5 7.5 5 6l1.5 1.5M3.5 24.5 5 26l1.5-1.5" ${GL}/>`,
    'columns-2': `${page()}${lines(10, 11, 5, 5, 3, GL)}${lines(17, 11, 5, 5, 3)}`,
    'layout-grid': `${page()}${lines(10, 20, 3, [12, 12, 8], 2.8)}<rect x="10" y="8" width="7" height="8" rx="1" ${GF}/>`,
    'wrap-text': `${lines(4, 6, 1, 24)}${lines(4, 11, 3, 8, 5)}${lines(24, 11, 3, 4, 5)}<rect x="14" y="9" width="8" height="12" rx="1" ${GF}/>${lines(4, 26, 1, 24)}`,
    'bring-to-front': `<rect x="4" y="4" width="14" height="14" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="14" y="14" width="14" height="14" rx="1.5" ${GF}/>`,
    'send-to-back': `<rect x="4" y="4" width="14" height="14" rx="1.5" ${GF}/><rect x="14" y="14" width="14" height="14" rx="1.5" ${L} style="fill:var(--t4,#121214);fill-opacity:1"/>`,
    'layers': `<path d="M16 4 28 10 16 16 4 10z" ${GS}/><path d="M16 4 28 10 16 16 4 10z" ${GL}/><path d="M4 16l12 6 12-6M4 22l12 6 12-6" ${L}/>`,
    'list-tree': `${page()}<path d="M10 10h3" ${GL} stroke-width="2.4"/>${lines(15, 10, 1, 7)}<path d="M12 15h3" ${GL} stroke-width="2.4"/>${lines(17, 15, 1, 5)}<path d="M12 20h3" ${GL} stroke-width="2.4"/>${lines(17, 20, 1, 5)}`,
    'file-text': `${page()}${lines(10, 10, 3, [10, 12, 8], 3.5)}<path d="M10 22h6" ${GL}/>${lines(10, 25, 1, 11)}<path d="M20.5 7.5v4" ${GL}/>`,
    'quote': `<path d="M5 22c0-6 2-10 7-12v4c-2 1-3 3-3 4h3v6H5z M18 22c0-6 2-10 7-12v4c-2 1-3 3-3 4h3v6h-7z" ${GF}/>`,
    'captions': `<rect x="4" y="4" width="24" height="16" rx="1.5" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M4 17l6-6 5 5 3-3 10 7" ${L}/><rect x="4" y="23" width="24" height="5" rx="1" ${GS}/>${lines(7, 25.5, 1, 12, 0, GL)}`,
    'bookmark-plus': `${page()}${lines(10, 15, 4, [12, 12, 12, 8], 3.2)}<path d="M18 3v9l2.5-2 2.5 2V3" ${GF}/>`,
    'scale': `<path d="M16 4v23M10 28h12M6 8h20" ${L}/><path d="M3 18l3-10 3 10a3 3 0 0 1-6 0zM23 18l3-10 3 10a3 3 0 0 1-6 0z" ${GS}/><path d="M3 18l3-10 3 10a3 3 0 0 1-6 0zM23 18l3-10 3 10a3 3 0 0 1-6 0z" ${GL}/>`,
    'mail': `<rect x="4" y="8" width="24" height="16" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M4 9l12 9 12-9" ${GL}/>`,
    'tag': `<path d="M4 15V5a1 1 0 0 1 1-1h10l13 13-11 11z" ${GS}/><path d="M4 15V5a1 1 0 0 1 1-1h10l13 13-11 11z" ${GL}/><circle cx="10" cy="10" r="2" ${L}/>`,
    'mail-plus': `<rect x="3" y="11" width="20" height="15" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M3 12l10 7 10-7" ${L}/><path d="M24 4v10M19 9h10" ${GL} stroke-width="2"/>`,
    'users': `<circle cx="11" cy="10" r="4" ${L}/><path d="M3 25a8 8 0 0 1 16 0" ${L}/><circle cx="21" cy="12" r="4" ${GS}/><circle cx="21" cy="12" r="4" ${GL}/><path d="M13 27a8 8 0 0 1 16 0z" ${GS}/><path d="M13 27a8 8 0 0 1 16 0" ${GL}/>`,
    'user-pen': `<circle cx="12" cy="10" r="5" ${L}/><path d="M3 27a9 9 0 0 1 14-7.5" ${L}/><path d="M18 28l1-4 7-7 3 3-7 7z" ${GS}/><path d="M18 28l1-4 7-7 3 3-7 7z" ${GL}/>`,
    'highlighter': `<rect x="4" y="13" width="18" height="6" rx="1" ${GS}/>${lines(5, 8, 1, 22)}${lines(5, 16, 1, 16)}${lines(5, 24, 1, 22)}<path d="M23 20l2-6 4 1.5-2 6z" ${GF}/>`,
    'map-pin': `<rect x="3" y="8" width="20" height="18" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/>${lines(6, 14, 3, [10, 12, 8], 3.5)}<path d="M24 20s-5-5-5-9a5 5 0 0 1 10 0c0 4-5 9-5 9z" ${GF}/><circle cx="24" cy="11" r="1.8" fill="var(--t4,#121214)"/>`,
    'message-circle': `<path d="M16 4C9 4 4 8.5 4 14c0 3 1.5 5.6 4 7.5V28l5.5-3.3c.8.1 1.6.2 2.5.2 7 0 12-4.5 12-10.5S23 4 16 4z" ${L} style="fill:currentColor;fill-opacity:.07"/>${lines(10, 12, 2, [12, 8], 4.5, GL)}`,
    'braces': `<path d="M11 5c-3 0-3 2-3 5s-1 5-3 6c2 1 3 3 3 6s0 5 3 5M21 5c3 0 3 2 3 5s1 5 3 6c-2 1-3 3-3 6s0 5-3 5" ${L}/><rect x="13" y="13" width="6" height="6" rx="1" ${GF}/>`,
    'eye': `<path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9S3 16 3 16z" ${L} style="fill:currentColor;fill-opacity:.07"/><circle cx="16" cy="16" r="4.5" ${GF}/>`,
    'check-check': `${page()}${lines(10, 10, 2, [12, 8], 3.5)}<path d="M10 21l4 4 9-10" ${GL} stroke-width="2.2"/>`,
    'volume-2': `<path d="M4 12h5l7-6v20l-7-6H4z" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M20 11a7 7 0 0 1 0 10M23.5 7.5a12 12 0 0 1 0 17" ${GL}/>`,
    'accessibility': `${page(4, 3, 17, 24)}${lines(8, 12, 3, [9, 7, 9], 3.5)}<circle cx="22" cy="22" r="7" ${GF}/><path d="M18.8 22l2.2 2.2 4-4.2" fill="none" stroke="var(--t4,#121214)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    'languages': `<rect x="3" y="4" width="16" height="14" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M7 15l4-8 4 8M8.5 12.5h5" ${L}/><rect x="13" y="14" width="16" height="14" rx="2" ${GS}/><rect x="13" y="14" width="16" height="14" rx="2" ${GL}/><path d="M17 18.5h8M21 17v1.5c0 3-2 6-4 7M19.5 21.5c1 2 3 3.5 5 4" ${GL} stroke-width="1.3"/>`,
    'globe': `<circle cx="16" cy="16" r="12" ${L} style="fill:currentColor;fill-opacity:.07"/><ellipse cx="16" cy="16" rx="5" ry="12" ${GL}/><path d="M4 16h24M6 10h20M6 22h20" ${L}/>`,
    'list-filter': `<path d="M4 6h24l-9 11v9l-6 3V17z" ${GS}/><path d="M4 6h24l-9 11v9l-6 3V17z" ${GL}/>`,
    'file-pen-line': `${page(4, 3, 17, 24)}${lines(8, 11, 1, 9)}<path d="M8 15h9" ${GL}/><path d="M8 19h6" ${L}/><path d="M7.5 17.5l3-2.5" ${GL}/><path d="M18 28l1-4 8-8 3 3-8 8z" ${L} style="fill:currentColor;fill-opacity:.07"/>`,
    'check': `${page()}${lines(10, 10, 3, [12, 10, 12], 3.5)}<circle cx="22" cy="23" r="6.5" ${GF}/><path d="M19 23l2 2 4-4" fill="none" stroke="var(--t4,#121214)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
    'x': `${page()}${lines(10, 10, 3, [12, 10, 12], 3.5)}<circle cx="22" cy="23" r="6.5" ${L} style="fill:currentColor;fill-opacity:.25"/><path d="M19.5 20.5l5 5M24.5 20.5l-5 5" ${L} stroke-width="1.8"/>`,
    'git-compare': `${page(3, 4, 14, 20)}${lines(6, 12, 3, [8, 6, 8], 3.2)}<path d="M15 8h8l5 5v15H15z" ${GS}/><path d="M15 8h8l5 5v15H15z" ${GL}/>${lines(18, 17, 3, [7, 5, 7], 3.2, GL)}`,
    'shield': `<path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" ${GS}/><path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" ${GL}/><rect x="12" y="14" width="8" height="7" rx="1" ${L}/><path d="M13.5 14v-2a2.5 2.5 0 0 1 5 0v2" ${L}/>`,
    'eye-off': `<path d="M5 26c4-1 6-6 9-10s6-7 9-5-2 7-6 9" ${GL}/><path d="M4 4l24 24" ${L} stroke-width="1.8"/>`,
    'book-open': `<path d="M16 8c-3-2-7-3-12-3v19c5 0 9 1 12 3 3-2 7-3 12-3V5c-5 0-9 1-12 3z" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M16 8v19" ${L}/>${lines(7, 11, 3, 6, 4, GL)}${lines(19, 11, 3, 6, 4)}`,
    'monitor': `<rect x="3" y="5" width="26" height="17" rx="2" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="11" y="8" width="10" height="11" rx="1" ${GS}/><rect x="11" y="8" width="10" height="11" rx="1" ${GL}/><path d="M11 27h10M16 22v5" ${L}/>`,
    'audio-lines': `<path d="M16 9c-3-2-7-3-12-3v18c5 0 9 1 12 3 3-2 7-3 12-3V6c-5 0-9 1-12 3z" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M8 13v6M12 11v10M20 14v4M24 12v8" ${GL} stroke-width="2"/>`,
    'sun-moon': `<circle cx="16" cy="16" r="10" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M16 6a10 10 0 0 1 0 20z" ${GF}/>`,
    'move-vertical': `<rect x="8" y="2" width="14" height="12" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="8" y="18" width="14" height="12" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M26 6v20M24 23.5l2 2.5 2-2.5" ${GL}/>`,
    'move-horizontal': `<rect x="2" y="6" width="12" height="16" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="18" y="6" width="12" height="16" rx="1" ${L} style="fill:currentColor;fill-opacity:.07"/><path d="M6 27h20M23.5 25l2.5 2-2.5 2" ${GL}/>`,
    'zoom-in': `<circle cx="13" cy="13" r="9" ${GS}/><circle cx="13" cy="13" r="9" ${GL}/><path d="M19.5 19.5 28 28" ${L} stroke-width="2.6"/><path d="M13 9v8M9 13h8" ${L}/>`,
    'scan': `${page()}<path d="M10 14v-3h3M22 14v-3h-3M10 21v3h3M22 21v3h-3" ${GL}/>`,
    'app-window': `${win(3, 5, 22, 18)}<path d="M25 18v10M20 23h10" ${GL} stroke-width="2"/>`,
    'layout-grid-w': '',
    'rows-2': `${win(3, 5, 26, 22)}<path d="M3 17h26" ${GL} stroke-width="2"/>`,
    'app-window-mac': `${win(3, 4, 18, 14)}<rect x="11" y="13" width="18" height="15" rx="2" ${L} style="fill:var(--t4,#121214)"/><rect x="11" y="13" width="18" height="5" rx="2" ${GF}/>`,
    'file-code': `${page()}<path d="M13 15l-3 3 3 3M19 15l3 3-3 3" ${GL}/>`,
    'info': `<circle cx="16" cy="16" r="12" ${GS}/><circle cx="16" cy="16" r="12" ${GL}/><path d="M16 15v7" ${L} stroke-width="2"/><circle cx="16" cy="10.5" r="1.4" fill="currentColor"/>`,
    'circle-help': `<circle cx="16" cy="16" r="12" ${GS}/><circle cx="16" cy="16" r="12" ${GL}/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3v.5" ${L} stroke-width="1.8"/><circle cx="16" cy="22.5" r="1.3" fill="currentColor"/>`,
    'graduation-cap': `<path d="M2 12 16 6l14 6-14 6z" ${GS}/><path d="M2 12 16 6l14 6-14 6z" ${GL}/><path d="M8 15v6c0 2 4 4 8 4s8-2 8-4v-6M28 13v8" ${L}/>`,
    'smartphone': `<rect x="9" y="3" width="14" height="26" rx="2.5" ${L} style="fill:currentColor;fill-opacity:.07"/><rect x="11" y="6" width="10" height="17" rx="1" ${GS}/><path d="M14.5 26h3" ${L}/>`,
  };
  I['layout-grid-w'] = I['layout-grid'];
  const l = 'fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"';
  const gl = `fill="none" stroke="${G}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
  const sf = 'style="fill:currentColor;fill-opacity:.1"';
  const pg = (x = 7, y = 3, w = 18, h = 26) => `<path d="M${x} ${y}h${w - 7}l7 7v${h - 7}H${x}z" ${l} ${sf}/><path d="M${x + w - 7} ${y}v7h7" ${l}/>`;
  const S = {
    'scissors': `<circle cx="8" cy="24" r="4.5" ${gl}/><circle cx="24" cy="24" r="4.5" ${gl}/><path d="M11 21 25 4M21 21 7 4" ${l}/>`,
    'copy': `<rect x="4" y="4" width="16" height="18" rx="2" ${l} ${sf}/><rect x="12" y="10" width="16" height="18" rx="2" ${GS}/><rect x="12" y="10" width="16" height="18" rx="2" ${gl}/>`,
    'paintbrush': `<rect x="6" y="3" width="20" height="9" rx="2" ${GF}/><path d="M16 12v5M13 17h6v11h-6z" ${l}/>`,
    'search': `<circle cx="13" cy="13" r="8.5" ${GS}/><circle cx="13" cy="13" r="8.5" ${gl}/><path d="M20 20l8 8" ${l} stroke-width="3"/>`,
    'replace': `<rect x="3" y="4" width="11" height="10" rx="2" ${l} ${sf}/><rect x="18" y="18" width="11" height="10" rx="2" ${GF}/><path d="M20 6h4a3 3 0 0 1 3 3v4M24.5 11l2.5 2.5 2.5-2.5M12 26H8a3 3 0 0 1-3-3v-4" ${l}/>`,
    'mouse-pointer-2': `<path d="M6 4l20 9-9 3-3 9z" ${GS}/><path d="M6 4l20 9-9 3-3 9z" ${gl}/>`,
    'file-text': `${pg()}<path d="M11 15h10M11 20h10M11 25h6" ${l}/>`,
    'file-plus': `${pg()}<path d="M16 14v10M11 19h10" ${gl}/>`,
    'separator-horizontal': `<path d="M7 3v8h18V3M7 29v-8h18v8" ${l} ${sf}/><path d="M3 16h26" ${gl} stroke-dasharray="3 3"/>`,
    'link': `<path d="M13 19a6 6 0 0 0 8.5 0l4-4a6 6 0 0 0-8.5-8.5l-1.5 1.5" ${gl}/><path d="M19 13a6 6 0 0 0-8.5 0l-4 4a6 6 0 0 0 8.5 8.5l1.5-1.5" ${l}/>`,
    'bookmark': `<path d="M8 3h16v26l-8-6-8 6z" ${GS}/><path d="M8 3h16v26l-8-6-8 6z" ${gl}/>`,
    'external-link': `${pg()}<path d="M12 22l9-9M15 13h6v6" ${gl}/>`,
    'blocks': `<rect x="4" y="4" width="11" height="11" rx="2" ${GF}/><rect x="17" y="4" width="11" height="11" rx="2" ${l} ${sf}/><rect x="4" y="17" width="11" height="11" rx="2" ${l} ${sf}/><rect x="17" y="17" width="11" height="11" rx="2" ${l} ${sf}/>`,
    'wand-sparkles': `<path d="M4 28 20 12" ${l} stroke-width="3"/><path d="M22 3l1.5 4 4 1.5-4 1.5L22 14l-1.5-4-4-1.5 4-1.5z" ${GF}/>`,
    'case-upper': `<path d="M4 26 10 8l6 18M6 20h8" ${gl}/><path d="M19 13h7M19 19h7M19 25h7" ${l}/>`,
    'pen-line': `<path d="M5 27l1.5-6L21 6.5l4.5 4.5L11 25.5z" ${GS}/><path d="M5 27l1.5-6L21 6.5l4.5 4.5L11 25.5z" ${gl}/><path d="M18 29h10" ${l}/>`,
    'calendar': `<rect x="4" y="6" width="24" height="22" rx="2" ${l} ${sf}/><path d="M4 6h24v6H4z" ${GF}/><path d="M10 3v6M22 3v6" ${l}/><rect x="10" y="17" width="5" height="5" rx="1" ${GF}/>`,
    'file-box': `${pg()}<rect x="11" y="15" width="10" height="9" rx="1" ${GF}/>`,
    'sigma': `<path d="M24 5H7l10 11-10 11h17" ${gl}/>`,
    'omega': `<path d="M5 27h7v-3a10 10 0 1 1 8 0v3h7" ${gl}/>`,
    'circle-check': `<circle cx="16" cy="16" r="12" ${GS}/><circle cx="16" cy="16" r="12" ${gl}/><path d="M11 16l3.5 3.5L21 13" ${l}/>`,
    'list-ordered': `<path d="M14 8h14M14 16h14M14 24h14" ${l}/><path d="M4 6l2-1v6M4 14h4l-4 5h4M4 22h3.5l-2 2.5c2 0 2.5 1 2.5 2s-1 2-2.5 2H4" ${gl} stroke-width="2"/>`,
    'spell-check': `<path d="M3 19 8 5l5 14M4.5 15h7M16 5h4.5a3.5 3.5 0 0 1 0 7H16zm0 7h5a3.5 3.5 0 0 1 0 7h-5z" ${l}/><path d="M13 25l4 4 11-11" ${gl} stroke-width="2.8"/>`,
    'book-open': `<path d="M16 8c-3-2-7-3-12-3v20c5 0 9 1 12 3 3-2 7-3 12-3V5c-5 0-9 1-12 3z" ${l} ${sf}/><path d="M16 8v20" ${l}/><path d="M16 8c3-2 7-3 12-3v20c-5 0-9 1-12 3z" ${GS}/>`,
    'library': `<path d="M5 4v24M11 4v24" ${l}/><path d="M17 5l4-1 6 23-4 1z" ${GS}/><path d="M17 5l4-1 6 23-4 1z" ${gl}/>`,
    'book': `<path d="M6 26V6a3 3 0 0 1 3-3h17v21H9a3 3 0 0 0-3 3 3 3 0 0 0 3 3h17" ${l} ${sf}/><path d="M12 9h9" ${gl}/>`,
    'tag': `<path d="M4 15V5a1 1 0 0 1 1-1h10l13 13-11 11z" ${GS}/><path d="M4 15V5a1 1 0 0 1 1-1h10l13 13-11 11z" ${gl}/><circle cx="10" cy="10" r="2" ${l}/>`,
    'settings-2': `<path d="M4 9h14M24 9h4M4 23h4M14 23h14" ${l}/><circle cx="21" cy="9" r="3.5" ${GF}/><circle cx="11" cy="23" r="3.5" ${GF}/>`,
    'hash': `${pg()}<rect x="15" y="20" width="6" height="5" rx="1" ${GF}/>`,
    'message-square-plus': `<path d="M4 6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H12l-7 6v-6a1 1 0 0 1-1-1z" ${GS}/><path d="M4 6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H12l-7 6v-6a1 1 0 0 1-1-1z" ${gl}/><path d="M16 9v9M11.5 13.5h9" ${l}/>`,
    'message-square': `<path d="M4 6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H12l-7 6v-6a1 1 0 0 1-1-1z" ${GS}/><path d="M4 6a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2H12l-7 6v-6a1 1 0 0 1-1-1z" ${gl}/>`,
    'trash-2': `<path d="M4 8h24M12 8V4h8v4" ${l}/><path d="M7 8l1.5 20h15L25 8z" ${l} ${sf}/><path d="M13 14v9M19 14v9" ${gl}/>`,
    'file-diff': `${pg()}<path d="M16 13v7M12.5 16.5h7" ${gl}/><path d="M12.5 24h7" ${l}/>`,
    'panel-right': `<rect x="4" y="5" width="24" height="22" rx="2" ${l} ${sf}/><rect x="19" y="5" width="9" height="22" rx="2" ${GF}/>`,
    'list-tree': `<path d="M14 7h14M18 16h10M18 25h10" ${l}/><path d="M4 4v18a3 3 0 0 0 3 3h5M4 13a3 3 0 0 0 3 3h5" ${gl}/>`,
    'file': `${pg()}`,
    'columns-2': `<rect x="4" y="4" width="24" height="24" rx="2" ${l} ${sf}/><rect x="4" y="4" width="12" height="24" rx="2" ${GS}/><path d="M16 4v24" ${l}/>`,
    'list': `<path d="M12 8h16M12 16h16M12 24h16" ${l}/><circle cx="5.5" cy="8" r="2" ${GF}/><circle cx="5.5" cy="16" r="2" ${GF}/><circle cx="5.5" cy="24" r="2" ${GF}/>`,
    'align-left': `<path d="M4 6h24M4 13h15M4 20h24M4 27h15" ${l}/><path d="M4 3v27" ${gl}/>`,
    'group': `<rect x="3" y="3" width="26" height="26" rx="3" ${l} stroke-dasharray="3 3"/><rect x="8" y="8" width="9" height="9" rx="1.5" ${GF}/><rect x="15" y="15" width="9" height="9" rx="1.5" ${l} ${sf}/>`,
    'eye': `<path d="M3 16s5-9 13-9 13 9 13 9-5 9-13 9S3 16 3 16z" ${l} ${sf}/><circle cx="16" cy="16" r="4.5" ${GF}/>`,
    'square': `<rect x="5" y="5" width="22" height="22" rx="4" ${l}/>`,
    'square-check': `<rect x="5" y="5" width="22" height="22" rx="4" ${GF}/><path d="M10.5 16l4 4 7-8" fill="none" stroke="#1a1405" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    'sparkles': `<path d="M13 3l2.5 7.5L23 13l-7.5 2.5L13 23l-2.5-7.5L3 13l7.5-2.5z" ${GF}/><path d="M24 19l1.3 3.7L29 24l-3.7 1.3L24 29l-1.3-3.7L19 24l3.7-1.3z" ${GF} opacity=".7"/>`,
    'undo-2': `<path d="M10 6 4 12l6 6" ${gl}/><path d="M4 12h15a8 8 0 0 1 0 16h-5" ${l}/>`,
    'redo-2': `<path d="M22 6l6 6-6 6" ${l}/><path d="M28 12H13a8 8 0 0 0 0 16h5" ${l}/>`,
    'house': `<path d="M4 14 16 4l12 10v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" ${l} ${sf}/><path d="M12 28v-9h8v9" ${gl}/>`,
    'folder-open': `<path d="M3 8a2 2 0 0 1 2-2h7l3 3h10a2 2 0 0 1 2 2v3" ${l}/><path d="M3 26 7 14h22l-4 12z" ${GS}/><path d="M3 26 7 14h22l-4 12zM3 8v18" ${gl}/>`,
    'save': `<path d="M5 5a1 1 0 0 1 1-1h16l5 5v17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z" ${l} ${sf}/><rect x="10" y="4" width="10" height="7" ${GF}/><rect x="9" y="17" width="14" height="10" ${l}/>`,
    'save-all': `<path d="M3 9v17a2 2 0 0 0 2 2h17" ${l}/><path d="M8 4h14l5 5v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" ${l} ${sf}/><rect x="12" y="4" width="9" height="6" ${GF}/><rect x="11" y="15" width="12" height="9" ${l}/>`,
    'printer': `<path d="M9 11V4h14v7" ${l}/><rect x="4" y="11" width="24" height="12" rx="2" ${l} ${sf}/><rect x="9" y="19" width="14" height="9" ${GS}/><rect x="9" y="19" width="14" height="9" ${gl}/>`,
    'download': `<path d="M4 21v5a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-5" ${l}/><path d="M16 4v16M10 14l6 6 6-6" ${gl}/>`,
    'share-2': `<path d="M11 14l10-5M11 18l10 5" ${l}/><circle cx="8" cy="16" r="4" ${l} ${sf}/><circle cx="24" cy="7" r="4" ${GF}/><circle cx="24" cy="25" r="4" ${GF}/>`,
    'info': `<circle cx="16" cy="16" r="12" ${GS}/><circle cx="16" cy="16" r="12" ${gl}/><path d="M16 15v7" ${l}/><circle cx="16" cy="10.5" r="1.5" fill="currentColor"/>`,
    'activity': `<rect x="4" y="18" width="5" height="10" rx="1" ${l} ${sf}/><rect x="13.5" y="10" width="5" height="18" rx="1" ${GF}/><rect x="23" y="4" width="5" height="24" rx="1" ${l} ${sf}/>`,
    'zap': `<path d="M18 3 6 18h9l-1 11 12-15h-9z" ${GS}/><path d="M18 3 6 18h9l-1 11 12-15h-9z" ${gl}/>`,
    'shield': `<path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" ${GS}/><path d="M16 3 27 7v8c0 7-5 12-11 14C10 27 5 22 5 15V7z" ${gl}/><path d="M11.5 16l3 3 6-6" ${l}/>`,
    'settings': `<path d="M13.5 3h5l.8 3.5 2.6 1.5 3.4-1.1 2.5 4.3-2.6 2.4v3l2.6 2.4-2.5 4.3-3.4-1.1-2.6 1.5-.8 3.3h-5l-.8-3.3-2.6-1.5-3.4 1.1-2.5-4.3 2.6-2.4v-3L4.2 11.2l2.5-4.3 3.4 1.1L12.7 6.5z" ${l} ${sf}/><circle cx="16" cy="16" r="4" ${GF}/>`,
    'x': `<path d="M7 7l18 18M25 7 7 25" ${l} stroke-width="2.6"/>`,
    'a-arrow-up': `<path d="M3 27 10 7l7 20M5.5 20h9" ${l}/><path d="M25 22V8M20.5 12.5 25 8l4.5 4.5" ${gl}/>`,
    'a-arrow-down': `<path d="M3 27 10 7l7 20M5.5 20h9" ${l}/><path d="M25 8v14M20.5 17.5 25 22l4.5-4.5" ${gl}/>`,
    'remove-formatting': `<path d="M6 6h18M15 6l-5 22" ${l}/><path d="M19 19l9 9M28 19l-9 9" ${gl}/>`,
  };
  const fix = (s) => s.replace(/ fill-opacity="\.07"/g, '');
  class RbIcon extends HTMLElement {
    static get observedAttributes() { return ['name', 'size']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { this.render(); }
    render() {
      const n = this.getAttribute('name') || '', sz = +(this.getAttribute('size') || 32);
      this.style.display = 'inline-flex'; this.style.flex = 'none'; this.style.width = this.style.height = sz + 'px';
      this.style.alignItems = 'center'; this.style.justifyContent = 'center';
      const svg = (sz <= 20 ? S[n] : I[n]) || (sz > 20 ? S[n] : null);
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      if (!svg) {
        if (!window.__rbSheet) {
          const src = [...document.querySelectorAll('style')].find(s => s.textContent.includes('.icon-') && s.textContent.includes('lucide'));
          if (src) { try { const sh = new CSSStyleSheet(); sh.replaceSync(src.textContent.replace(/@font-face\s*{[^}]*}/g, '')); window.__rbSheet = sh; } catch (e) {} }
        }
        if (window.__rbSheet) root.adoptedStyleSheets = [window.__rbSheet];
      }
      root.innerHTML = svg ? `<svg viewBox="0 0 32 32" width="${sz}" height="${sz}" aria-hidden="true" style="display:block;overflow:visible">${fix(svg)}</svg>`
        : `${window.__rbSheet ? '' : '<link rel="stylesheet" href="https://unpkg.com/lucide-static@0.460.0/font/lucide.css">'}<i class="icon-${n}" style="font-size:${sz <= 20 ? 15 : Math.round(sz * 0.62)}px;line-height:1"></i>`;
    }
  }
  if (!customElements.get('rb-icon')) customElements.define('rb-icon', RbIcon);
})();
