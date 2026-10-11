import { LOGO_LETTERS, LOGO_VIEWBOX, SHIELD_PATHS } from './logoPaths';

export { LOGO_LETTERS, LOGO_VIEWBOX, SHIELD_PATHS };

// The "Word" line sits below the ETHERX line and has its own, lighter gradient.
const WORD_LINE_TOP = 220;

/** Gradients the logo shapes reference (colours sampled from etherxwordlogo.png). Render once per <svg>. */
export function LogoDefs() {
  return (
    <defs>
      <linearGradient id="exw-logo-shield" x1="0" y1="124" x2="0" y2="300" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#d5bf6c" />
        <stop offset="1" stopColor="#ddc673" />
      </linearGradient>
      <linearGradient id="exw-logo-etherx" x1="264" y1="0" x2="600" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#d3b975" />
        <stop offset="1" stopColor="#9b7237" />
      </linearGradient>
      <linearGradient id="exw-logo-word" x1="263" y1="0" x2="462" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#d1b573" />
        <stop offset="1" stopColor="#b49154" />
      </linearGradient>
    </defs>
  );
}

export function letterFill(letter) {
  return letter.box[2] >= WORD_LINE_TOP ? 'url(#exw-logo-word)' : 'url(#exw-logo-etherx)';
}

/** The full logo, static and resolution-independent. */
export default function EtherxWordLogo({ className, style, title = 'EtherxWord' }) {
  return (
    <svg className={className} style={style} viewBox={LOGO_VIEWBOX} role="img" aria-label={title}>
      <LogoDefs />
      <path d={SHIELD_PATHS.join(' ')} fill="url(#exw-logo-shield)" />
      {LOGO_LETTERS.map((letter, i) => <path key={i} d={letter.face} fill={letterFill(letter)} />)}
    </svg>
  );
}
