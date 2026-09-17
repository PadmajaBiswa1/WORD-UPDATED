// ═══════════════════════════════════════════════════════════════
//  EtherX Word — Handwriting & Document OCR Recognition Service
// ═══════════════════════════════════════════════════════════════
import * as Tesseract from 'tesseract.js';

/**
 * Preprocesses an image to improve handwriting recognition accuracy.
 * Enhances contrast, converts to grayscale, and sharpens ink strokes.
 * 
 * @param {File|Blob|string} imageInput - Image file, blob, or data URL
 * @param {Object} options
 * @param {boolean} options.enhanceContrast - Whether to apply ink contrast enhancement
 * @returns {Promise<string>} Processed image as data URL
 */
export async function preprocessHandwritingImage(imageInput, { enhanceContrast = true } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof imageInput === 'string' ? imageInput : URL.createObjectURL(imageInput));
          return;
        }

        // Cap dimensions for performance while maintaining readability
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;
        const maxDim = 2400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        if (!enhanceContrast) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Grayscale + Adaptive Contrast Enhancement for ink detection
        // 1. Calculate luminance histogram
        let totalLuminance = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          totalLuminance += lum;
        }
        const avgLuminance = totalLuminance / (data.length / 4);

        // 2. High-contrast ink enhancement
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          
          // S-curve contrast stretching centered around average luminance
          let adjusted = lum;
          if (lum < avgLuminance) {
            // Darken ink / handwriting
            adjusted = Math.max(0, lum * 0.75 - 15);
          } else {
            // Brighten paper background
            adjusted = Math.min(255, lum * 1.15 + 20);
          }

          data[i] = adjusted;     // R
          data[i + 1] = adjusted; // G
          data[i + 2] = adjusted; // B
          // Alpha remains unchanged
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.warn('Preprocessing fallback to original image:', err);
        resolve(typeof imageInput === 'string' ? imageInput : URL.createObjectURL(imageInput));
      }
    };

    img.onerror = (err) => reject(new Error('Failed to load image for preprocessing: ' + err));

    if (typeof imageInput === 'string') {
      img.src = imageInput;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      reader.readAsDataURL(imageInput);
    }
  });
}

/**
 * Converts raw recognized OCR text into clean HTML paragraphs suitable for TipTap.
 * 
 * @param {string} text - Raw plain text
 * @returns {string} Clean HTML string with <p> blocks
 */
export function formatOcrTextToHtml(text = '') {
  if (!text || !text.trim()) return '<p></p>';

  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return '<p></p>';

  return paragraphs
    .map((para) => {
      // Escape HTML special characters
      const escaped = para
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br />');
      return `<p>${escaped}</p>`;
    })
    .join('');
}

/**
 * Executes handwriting recognition / OCR on an image file or blob.
 * 
 * @param {File|Blob|string} imageFile - The image to process
 * @param {Object} options
 * @param {Function} [options.onProgress] - Callback ({ status, progress, percent, stage }) => void
 * @param {boolean} [options.enhanceContrast=true] - Whether to preprocess image contrast
 * @param {string} [options.language='eng'] - Language model (default 'eng')
 * @returns {Promise<Object>} OCR result with text, html, confidence, words, and lowConfidence flag
 */
export async function recognizeHandwriting(imageFile, {
  onProgress = () => {},
  enhanceContrast = true,
  language = 'eng',
} = {}) {
  const startTime = Date.now();

  try {
    // 1. Stage: Preprocessing
    onProgress({
      status: 'preprocessing',
      stage: 'Enhancing handwriting contrast...',
      progress: 0.1,
      percent: 10,
    });

    const preprocessedDataUrl = await preprocessHandwritingImage(imageFile, { enhanceContrast });

    // 2. Stage: Engine Initialization & Recognition
    onProgress({
      status: 'initializing',
      stage: 'Initializing OCR engine...',
      progress: 0.25,
      percent: 25,
    });

    const result = await Tesseract.recognize(
      preprocessedDataUrl,
      language,
      {
        logger: (m) => {
          if (!m || typeof m.progress !== 'number') return;
          const status = m.status || '';
          
          let stageLabel = 'Reading handwriting...';
          let scaledProgress = 0.25;

          if (status.includes('loading') || status.includes('init')) {
            stageLabel = 'Loading handwriting recognition models...';
            scaledProgress = 0.25 + (m.progress * 0.2); // 25% -> 45%
          } else if (status.includes('recogniz')) {
            stageLabel = 'Extracting handwritten text...';
            scaledProgress = 0.45 + (m.progress * 0.5); // 45% -> 95%
          }

          const percent = Math.min(96, Math.round(scaledProgress * 100));
          onProgress({
            status,
            stage: stageLabel,
            progress: scaledProgress,
            percent,
            rawProgress: m.progress,
          });
        },
      }
    );

    // 3. Stage: Formatting & Quality Assessment
    onProgress({
      status: 'finalizing',
      stage: 'Finalizing extracted text...',
      progress: 0.98,
      percent: 98,
    });

    const rawText = String(result?.data?.text || '').trim();
    const confidence = Math.round(result?.data?.confidence || 0);
    const words = result?.data?.words || [];
    const lines = result?.data?.lines || [];

    // Filter out words with length > 0
    const validWords = words.filter((w) => w.text && w.text.trim().length > 0);
    const wordCount = validWords.length;

    // Confidence threshold assessment:
    // If confidence < 55% or very few words detected relative to expected size
    const lowConfidence = Boolean(confidence < 55 || (confidence < 65 && wordCount < 3));

    const html = formatOcrTextToHtml(rawText);
    const durationMs = Date.now() - startTime;

    onProgress({
      status: 'completed',
      stage: 'Recognition complete',
      progress: 1.0,
      percent: 100,
    });

    return {
      success: true,
      text: rawText,
      html,
      confidence,
      lowConfidence,
      wordCount,
      linesCount: lines.length,
      durationMs,
      preprocessedImage: preprocessedDataUrl,
    };
  } catch (error) {
    console.error('Handwriting recognition failed:', error);
    throw new Error(error.message || 'Handwriting recognition failed. Please try a clearer image.');
  }
}
