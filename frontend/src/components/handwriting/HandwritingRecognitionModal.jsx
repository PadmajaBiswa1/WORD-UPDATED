import { useState, useRef, useCallback } from 'react';
import {
  UploadCloud, FileImage, AlertTriangle, CheckCircle2, RefreshCw,
  Copy, Check, FileText, Sparkles, X, Sliders, ArrowRight
} from 'lucide-react';
import { recognizeHandwriting, formatOcrTextToHtml } from '@/services/ocrService';

/**
 * Reusable Handwriting Recognition Modal.
 * Can be used standalone or wrapped in a DialogManager dialog.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is visible
 * @param {Function} props.onClose - Callback to close the modal
 * @param {Function} props.onInsert - Callback (html, plainText, metadata) => void
 * @param {string} [props.title] - Optional custom title
 */
export function HandwritingRecognitionModal({
  isOpen,
  onClose,
  onInsert,
  title = 'Handwriting Recognition (OCR)',
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [enhanceContrast, setEnhanceContrast] = useState(true);
  
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressInfo, setProgressInfo] = useState({ stage: '', percent: 0 });
  const [errorMsg, setErrorMsg] = useState('');
  
  // Results state
  const [result, setResult] = useState(null);
  const [editableText, setEditableText] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  // Reset state when closing or starting fresh
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewUrl('');
    setIsProcessing(false);
    setProgressInfo({ stage: '', percent: 0 });
    setErrorMsg('');
    setResult(null);
    setEditableText('');
    setCopied(false);
  }, []);

  const handleClose = () => {
    handleReset();
    onClose?.();
  };

  const processFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, JPEG, WEBP, BMP).');
      return;
    }

    handleReset();
    setSelectedFile(file);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const ocrResult = await recognizeHandwriting(file, {
        enhanceContrast,
        onProgress: (p) => {
          setProgressInfo({ stage: p.stage, percent: p.percent });
        },
      });

      setResult(ocrResult);
      setEditableText(ocrResult.text || '');

      if (!ocrResult.text || ocrResult.text.trim().length === 0) {
        setErrorMsg('No readable text could be detected in this image. Please ensure handwriting is legible and in good lighting.');
      }
    } catch (err) {
      console.error('Handwriting OCR error:', err);
      setErrorMsg(err.message || 'Recognition failed. Please try a clearer or higher-contrast photo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleCopy = async () => {
    if (!editableText) return;
    try {
      await navigator.clipboard.writeText(editableText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleInsert = () => {
    if (!editableText.trim()) return;
    const html = formatOcrTextToHtml(editableText);
    onInsert?.(html, editableText, {
      confidence: result?.confidence || 0,
      lowConfidence: result?.lowConfidence || false,
    });
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.titleRow}>
            <div style={styles.iconCircle}>
              <Sparkles size={18} color="#d4af37" />
            </div>
            <div>
              <h2 style={styles.title}>{title}</h2>
              <p style={styles.subtitle}>Upload photos or scans of handwritten notes to convert to editable text</p>
            </div>
          </div>
          <button style={styles.closeBtn} onClick={handleClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={styles.body}>
          {/* ── State 1: Upload / Drop Zone ── */}
          {!selectedFile && !result && !isProcessing && (
            <div>
              <div
                style={{
                  ...styles.dropZone,
                  ...(isDragging ? styles.dropZoneActive : {}),
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <div style={styles.uploadIconContainer}>
                  <UploadCloud size={38} color="var(--gold, #d4af37)" />
                </div>
                <div style={styles.dropPrompt}>
                  <strong style={{ color: 'var(--text-primary)' }}>Click to upload</strong> or drag and drop handwritten image
                </div>
                <div style={styles.dropSubtext}>
                  Supports PNG, JPG, JPEG, WEBP, BMP (notebooks, paper, whiteboards)
                </div>

                <div style={styles.featurePills}>
                  <span style={styles.pill}>✍️ Cursive & Print</span>
                  <span style={styles.pill}>🔒 100% Private (Runs Locally)</span>
                  <span style={styles.pill}>⚡ Auto Ink Enhancement</span>
                </div>
              </div>

              {/* Preprocessing Option */}
              <div style={styles.optionRow}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={enhanceContrast}
                    onChange={(e) => setEnhanceContrast(e.target.checked)}
                    style={{ accentColor: '#d4af37', cursor: 'pointer' }}
                  />
                  <span>Adaptive Contrast Enhancement (Recommended for faint pencil/blue ink)</span>
                </label>
              </div>
            </div>
          )}

          {/* ── State 2: Processing / Loading ── */}
          {isProcessing && (
            <div style={styles.loadingContainer}>
              <div style={styles.previewThumbBox}>
                {previewUrl && (
                  <img src={previewUrl} alt="Handwriting sample" style={styles.previewThumb} />
                )}
                <div style={styles.scannerLine} />
              </div>

              <div style={styles.loadingInfo}>
                <div style={styles.loadingHeader}>
                  <RefreshCw size={16} className="spin-icon" color="#d4af37" style={{ animation: 'spin 1.2s linear infinite' }} />
                  <span style={styles.loadingStageText}>{progressInfo.stage || 'Analyzing handwriting...'}</span>
                  <span style={styles.percentText}>{progressInfo.percent}%</span>
                </div>

                {/* Progress Bar */}
                <div style={styles.progressBarTrack}>
                  <div
                    style={{
                      ...styles.progressBarFill,
                      width: `${progressInfo.percent}%`,
                    }}
                  />
                </div>

                <p style={styles.loadingHint}>
                  Tesseract OCR engine is reading letter shapes and converting ink strokes into typed text...
                </p>
              </div>
            </div>
          )}

          {/* ── State 3: Error Message ── */}
          {errorMsg && !isProcessing && (
            <div style={styles.errorAlert}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={styles.errorTitle}>Recognition Issue</div>
                <div style={styles.errorDesc}>{errorMsg}</div>
                <button
                  style={styles.retryBtn}
                  onClick={() => {
                    if (selectedFile) processFile(selectedFile);
                    else handleReset();
                  }}
                >
                  <RefreshCw size={13} style={{ marginRight: 6 }} />
                  {selectedFile ? 'Retry Recognition' : 'Choose Another File'}
                </button>
              </div>
            </div>
          )}

          {/* ── State 4: Recognition Result Review ── */}
          {result && !isProcessing && (
            <div style={styles.resultsContainer}>
              {/* Image Preview & Confidence Bar */}
              <div style={styles.resultsHeaderRow}>
                <div style={styles.imageMiniPreview}>
                  <img src={result.preprocessedImage || previewUrl} alt="Analyzed" style={styles.miniImg} />
                  <span style={styles.imageTag}>Sample Image</span>
                </div>

                <div style={styles.metaCol}>
                  <div style={styles.statsRow}>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Words Detected</span>
                      <span style={styles.statVal}>{result.wordCount}</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Processing Time</span>
                      <span style={styles.statVal}>{(result.durationMs / 1000).toFixed(1)}s</span>
                    </div>
                    <div style={styles.statBox}>
                      <span style={styles.statLabel}>Confidence Score</span>
                      <span
                        style={{
                          ...styles.statVal,
                          color: result.confidence >= 75 ? '#22c55e' : result.confidence >= 55 ? '#f59e0b' : '#ef4444',
                        }}
                      >
                        {result.confidence}%
                      </span>
                    </div>
                  </div>

                  {/* Confidence Badge */}
                  <div
                    style={{
                      ...styles.confidenceBadge,
                      ...(result.confidence >= 75
                        ? styles.confidenceHigh
                        : result.confidence >= 55
                        ? styles.confidenceMed
                        : styles.confidenceLow),
                    }}
                  >
                    {result.confidence >= 75 ? (
                      <CheckCircle2 size={14} color="#22c55e" />
                    ) : (
                      <AlertTriangle size={14} color={result.confidence >= 55 ? '#f59e0b' : '#ef4444'} />
                    )}
                    <span>
                      {result.confidence >= 75
                        ? 'High Confidence Match'
                        : result.confidence >= 55
                        ? 'Moderate Confidence — Review suggested'
                        : 'Low Confidence — Please review/edit text below'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Low Confidence Warning Notice */}
              {result.lowConfidence && (
                <div style={styles.warningNotice}>
                  <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Low Confidence Detection ({result.confidence}%):</strong> Some words may have been misrecognized due to handwriting style, paper lines, or lighting. Please review and edit the text in the box below before inserting.
                  </div>
                </div>
              )}

              {/* Editable Text Area */}
              <div style={styles.editorArea}>
                <div style={styles.editorHeader}>
                  <span style={styles.editorTitle}>
                    <FileText size={14} style={{ marginRight: 6 }} />
                    Recognized Text (Editable):
                  </span>
                  <button style={styles.copyBtn} onClick={handleCopy} title="Copy to clipboard">
                    {copied ? <Check size={13} color="#22c55e" /> : <Copy size={13} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  placeholder="Extracted handwritten text will appear here. You can make corrections before inserting."
                  rows={6}
                  style={styles.textarea}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={handleClose}>
            Cancel
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            {result && !isProcessing && (
              <button style={styles.secondaryBtn} onClick={handleReset}>
                <RefreshCw size={13} style={{ marginRight: 6 }} />
                New Image
              </button>
            )}

            {result && !isProcessing && (
              <button
                style={{
                  ...styles.insertBtn,
                  opacity: editableText.trim() ? 1 : 0.5,
                  cursor: editableText.trim() ? 'pointer' : 'not-allowed',
                }}
                disabled={!editableText.trim()}
                onClick={handleInsert}
              >
                <span>Insert into Document</span>
                <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    background: 'var(--bg-card, #1e1e1e)',
    border: '1px solid var(--border, #333)',
    borderRadius: 12,
    width: '100%',
    maxWidth: 620,
    boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: 'var(--text-primary, #fff)',
    fontFamily: 'var(--font-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border, #333)',
    background: 'var(--bg-elevated, #252526)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(212, 175, 55, 0.12)',
    border: '1px solid rgba(212, 175, 55, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
    margin: 0,
    color: 'var(--text-primary, #fff)',
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--text-muted, #888)',
    margin: '2px 0 0 0',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted, #888)',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    maxHeight: '75vh',
    overflowY: 'auto',
  },
  dropZone: {
    border: '2px dashed var(--border, #444)',
    borderRadius: 10,
    padding: '36px 20px',
    textAlign: 'center',
    background: 'rgba(255, 255, 255, 0.02)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  dropZoneActive: {
    borderColor: 'var(--gold, #d4af37)',
    background: 'rgba(212, 175, 55, 0.08)',
  },
  uploadIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    background: 'rgba(212, 175, 55, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px auto',
  },
  dropPrompt: {
    fontSize: 14,
    color: 'var(--text-secondary, #aaa)',
    marginBottom: 6,
  },
  dropSubtext: {
    fontSize: 12,
    color: 'var(--text-muted, #777)',
    marginBottom: 16,
  },
  featurePills: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 12,
    background: 'var(--bg-elevated, #2a2a2a)',
    color: 'var(--text-secondary, #aaa)',
    border: '1px solid var(--border, #3a3a3a)',
  },
  optionRow: {
    marginTop: 14,
    padding: '0 4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: 'var(--text-secondary, #aaa)',
    cursor: 'pointer',
  },
  loadingContainer: {
    padding: '24px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  previewThumbBox: {
    position: 'relative',
    width: 140,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border, #444)',
    background: '#111',
    marginBottom: 20,
  },
  previewThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    opacity: 0.8,
  },
  scannerLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: 'var(--gold, #d4af37)',
    boxShadow: '0 0 10px #d4af37',
    animation: 'scan 2s ease-in-out infinite',
  },
  loadingInfo: {
    width: '100%',
    maxWidth: 420,
  },
  loadingHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  loadingStageText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary, #fff)',
    flex: 1,
    marginLeft: 8,
  },
  percentText: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--gold, #d4af37)',
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    background: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #d4af37, #f59e0b)',
    transition: 'width 0.25s ease-out',
  },
  loadingHint: {
    fontSize: 11,
    color: 'var(--text-muted, #777)',
    marginTop: 10,
    textAlign: 'center',
  },
  errorAlert: {
    display: 'flex',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#f87171',
  },
  errorDesc: {
    fontSize: 12,
    color: '#fca5a5',
    margin: '4px 0 10px 0',
    lineHeight: 1.4,
  },
  retryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    padding: '5px 12px',
    borderRadius: 6,
    background: 'rgba(239, 68, 68, 0.25)',
    border: '1px solid rgba(239, 68, 68, 0.4)',
    color: '#fee2e2',
    cursor: 'pointer',
  },
  resultsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  resultsHeaderRow: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
  },
  imageMiniPreview: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid var(--border, #444)',
    flexShrink: 0,
    background: '#111',
  },
  miniImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  imageTag: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    background: 'rgba(0,0,0,0.7)',
    fontSize: 9,
    textAlign: 'center',
    padding: '1px 0',
    borderRadius: 3,
  },
  metaCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  statsRow: {
    display: 'flex',
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: '6px 8px',
    background: 'var(--bg-elevated, #252526)',
    borderRadius: 6,
    border: '1px solid var(--border, #333)',
  },
  statLabel: {
    display: 'block',
    fontSize: 10,
    color: 'var(--text-muted, #777)',
    marginBottom: 2,
  },
  statVal: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary, #fff)',
  },
  confidenceBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    padding: '4px 10px',
    borderRadius: 6,
    fontWeight: 500,
  },
  confidenceHigh: {
    background: 'rgba(34, 197, 94, 0.12)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    color: '#86efac',
  },
  confidenceMed: {
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#fcd34d',
  },
  confidenceLow: {
    background: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#fca5a5',
  },
  warningNotice: {
    display: 'flex',
    gap: 10,
    padding: 10,
    borderRadius: 6,
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.25)',
    fontSize: 12,
    color: '#fef3c7',
    lineHeight: 1.4,
  },
  editorArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  editorHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editorTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary, #bbb)',
    display: 'flex',
    alignItems: 'center',
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    background: 'transparent',
    border: '1px solid var(--border, #444)',
    color: 'var(--text-secondary, #aaa)',
    padding: '3px 8px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    background: 'var(--bg-elevated, #252526)',
    border: '1px solid var(--border, #3a3a3a)',
    borderRadius: 6,
    color: 'var(--text-primary, #fff)',
    fontSize: 13,
    lineHeight: 1.5,
    fontFamily: 'var(--font-editor, Georgia, serif)',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 20px',
    borderTop: '1px solid var(--border, #333)',
    background: 'var(--bg-elevated, #222)',
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid var(--border, #444)',
    color: 'var(--text-secondary, #aaa)',
    padding: '7px 14px',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
  },
  secondaryBtn: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid var(--border, #444)',
    color: 'var(--text-primary, #fff)',
    padding: '7px 14px',
    borderRadius: 6,
    fontSize: 13,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  insertBtn: {
    background: 'var(--gold, #d4af37)',
    color: '#000',
    border: 'none',
    fontWeight: 600,
    padding: '7px 18px',
    borderRadius: 6,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    transition: 'all 0.2s',
  },
};
