/**
 * printUtils.js
 * Suppresses browser header/footer document title metadata during print
 */

export function printDocument() {
  const prevTitle = document.title;
  try {
    document.title = ' ';
    window.print();
  } finally {
    setTimeout(() => {
      document.title = prevTitle;
    }, 600);
  }
}

export function initGlobalPrintHandler() {
  if (typeof window === 'undefined') return;
  
  let savedTitle = '';
  window.addEventListener('beforeprint', () => {
    savedTitle = document.title;
    document.title = ' ';
  });

  window.addEventListener('afterprint', () => {
    if (savedTitle) {
      document.title = savedTitle;
    }
  });
}
