export function fitImageOnPage(candidate, pages) {
  if (!pages.length) return candidate;
  const center = candidate.top + candidate.height / 2;
  const page = pages.reduce((best, current) => Math.abs(current.top + current.height / 2 - center) < Math.abs(best.top + best.height / 2 - center) ? current : best);
  const padding = page.padding || 0;
  const width = Math.max(1, page.width - padding * 2);
  const height = Math.max(1, page.height - padding * 2);
  const ratio = Math.min(1, width / candidate.width, height / candidate.height);
  const fitted = { ...candidate, width: candidate.width * ratio, height: candidate.height * ratio };
  return { ...fitted, left: Math.max(page.left + padding, Math.min(candidate.left, page.left + page.width - padding - fitted.width)), top: Math.max(page.top + padding, Math.min(candidate.top, page.top + page.height - padding - fitted.height)) };
}
