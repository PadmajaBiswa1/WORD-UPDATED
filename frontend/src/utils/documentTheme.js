// Theme changes repaint the existing layout. Fonts and paragraph spacing have
// their own Design controls, so choosing a palette must not move placed media.
export function getThemeAppearance(theme) {
  return {
    themeName: theme.name,
    accent: theme.accent,
    heading: theme.heading,
    subtle: theme.subtle,
    pageColor: theme.pageColor,
    effect: theme.effect,
    pageColorMode: 'custom',
  };
}
