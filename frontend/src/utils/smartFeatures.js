import * as Tesseract from 'tesseract.js';
import { buildAiResult, getHtmlFromPlainText } from '@/services/ai';
import { useDocumentStore } from '@/store';

function getDocumentText(editor) {
  if (!editor) return '';
  return editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ').trim();
}

export function getSelectedText(editor) {
  if (!editor) return '';
  const { from, to } = editor.state.selection;
  if (from === to) return getDocumentText(editor);
  return editor.state.doc.textBetween(from, to, ' ').trim();
}

function insertHtml(editor, html) {
  if (!editor) return false;
  const { from, to } = editor.state.selection;
  const content = html || '<p></p>';
  if (from !== to) {
    editor.chain().focus().insertContentAt({ from, to }, content).run();
  } else {
    editor.chain().focus().insertContent(content).run();
  }
  return true;
}

export function speakText(text) {
  if (!window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

import { parseVoiceCommand, executeVoiceCommand } from '@/services/voiceCommands';

export function runDictation({ editor, toast }) {
  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognitionApi) {
    toast('Dictation is not available in this browser', 'info');
    return false;
  }

  const recognition = new SpeechRecognitionApi();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    if (transcript && editor) {
      const match = parseVoiceCommand(transcript);
      if (match.matched) {
        executeVoiceCommand(transcript, { editor });
        toast(`Voice Command: ${match.command.label}`, 'success');
      } else {
        editor.chain().focus().insertContent(`${transcript} `).run();
        toast('Dictation inserted', 'success');
      }
    }
  };
  recognition.onerror = () => toast('Dictation failed. Try again.', 'warning');
  recognition.start();
  toast('Listening for voice commands & dictation...', 'info');
  return true;
}

export function runReadAloud({ editor, toast }) {
  const text = getSelectedText(editor).trim();
  if (!text) {
    toast('Select some text to read aloud', 'info');
    return false;
  }

  if (!speakText(text)) {
    toast('Read aloud is not available in this browser', 'info');
    return false;
  }

  toast('Reading selection aloud', 'success');
  return true;
}

async function extractTextFromImage(file) {
  const result = await Tesseract.recognize(file, 'eng');
  return String(result?.data?.text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function runImageTextCapture({ editor, toast, mode = 'ocr' }) {
  if (!editor) {
    toast('Open a document first', 'info');
    return false;
  }

  if (typeof document === 'undefined') {
    toast('Image text capture is not available here', 'warning');
    return false;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      toast(mode === 'handwriting' ? 'Reading handwriting...' : 'Running OCR...', 'info');
      const text = await extractTextFromImage(file);

      if (!text) {
        toast('No text was found in the image', 'warning');
        return;
      }

      insertHtml(editor, getHtmlFromPlainText(text));
      toast(mode === 'handwriting' ? 'Handwriting text inserted' : 'OCR text inserted', 'success');
    } catch (error) {
      console.error(error);
      toast(mode === 'handwriting' ? 'Handwriting recognition failed' : 'OCR failed', 'error');
    } finally {
      input.remove();
    }
  };

  document.body.appendChild(input);
  input.click();
  return true;
}

function buildSuggestionActions(editor) {
  const suggestions = [];
  const selection = getSelectedText(editor).trim();
  const fullText = getDocumentText(editor).trim();
  const source = selection || fullText;

  if (!source) return suggestions;

  const targetStore = useDocumentStore.getState();

  if (!selection) {
    suggestions.push({
      label: 'Generate a better title',
      run: () => {
        const result = buildAiResult('title', source, { fallbackTitle: targetStore.title || 'Untitled Document' });
        targetStore.setTitle(result.title || targetStore.title || 'Untitled Document');
      },
    });
  }

  suggestions.push(
    {
      label: 'Correct grammar and punctuation',
      run: () => insertHtml(editor, buildAiResult('grammar', source).html),
    },
    {
      label: 'Summarize the text',
      run: () => insertHtml(editor, buildAiResult('summarize', source).html),
    },
    {
      label: 'Rewrite more clearly',
      run: () => {
        const mode = window.prompt('Rewrite style: clear, formal, or short', 'clear') || 'clear';
        insertHtml(editor, buildAiResult('rewrite', source, { mode }).html);
      },
    },
    {
      label: 'Translate the text',
      run: () => {
        const language = window.prompt('Translate to which language?', 'Spanish') || 'Spanish';
        insertHtml(editor, buildAiResult('translate', source, { language }).html);
      },
    },
  );

  return suggestions;
}

export function runSmartSuggestions({ editor, toast }) {
  const suggestions = buildSuggestionActions(editor);
  if (!suggestions.length) {
    toast('Type or select text to get smart suggestions', 'info');
    return false;
  }

  const promptLines = suggestions.map((item, index) => `${index + 1}. ${item.label}`).join('\n');
  const choice = window.prompt(`Smart suggestions:\n${promptLines}\n\nChoose a number`, '1');
  const selectedIndex = Number(choice) - 1;

  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= suggestions.length) {
    toast('No suggestion selected', 'info');
    return false;
  }

  const selected = suggestions[selectedIndex];
  selected.run();
  toast(`Applied: ${selected.label}`, 'success');
  return true;
}
