export const WORDART_FONTS = {
  Arial: { asset: 'arimo', fallback: 'sans-serif' },
  'Times New Roman': { asset: 'tinos', fallback: 'serif' },
  Georgia: { asset: 'gelasio', fallback: 'serif' },
  Impact: { asset: 'anton', fallback: 'sans-serif' },
  'Trebuchet MS': { asset: 'firasans', fallback: 'sans-serif' },
  'Courier New': { asset: 'cousine', fallback: 'monospace' },
  Verdana: { asset: 'notosans', fallback: 'sans-serif' },
};

export async function loadWordArtFont(font, size) {
  if (document.fonts?.load) await document.fonts.load(`bold ${size}px "EtherX WordArt ${font}"`);
}

export function drawWordArt(canvas, { text = 'WordArt', font = 'Arial', size = 48, color = '#d4af37', style = 'fill' }) {
  let ctx = canvas.getContext('2d');
  const family = `"${font}", "EtherX WordArt ${font}", ${WORDART_FONTS[font]?.fallback || 'sans-serif'}`;
  ctx.font = `bold ${size}px ${family}`;
  canvas.width = Math.ceil(Math.max(480, ctx.measureText(text).width + 64));
  canvas.height = Math.ceil(Math.max(120, size * 1.5 + 32));
  ctx = canvas.getContext('2d');
  ctx.font = `bold ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const x = canvas.width / 2;
  const y = canvas.height / 2;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color;
  if (style === 'gradient') {
    const width = ctx.measureText(text).width;
    const gradient = ctx.createLinearGradient(x - width / 2, 0, x + width / 2, canvas.height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, '#ffffff');
    ctx.fillStyle = gradient;
  } else if (style === 'outline') {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size / 28);
    ctx.strokeText(text, x, y);
    return;
  } else if (style === 'shadow') {
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;
    ctx.shadowBlur = 6;
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
  } else if (style === 'glow') {
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 10;
  } else if (style === 'emboss') {
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, x - 2, y - 2);
    ctx.fillStyle = '#333333';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
  }
  ctx.fillText(text, x, y);
}
