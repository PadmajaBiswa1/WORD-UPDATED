import { useCallback, useRef, useState } from 'react';
import { aiApi } from '@/services/api';
import { runAgent } from '@/ai/agentLoop';

export function useDocumentAgent(editor) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [lastRun, setLastRun] = useState(null);
  const controllerRef = useRef(null);
  const runCounterRef = useRef(0);

  const run = useCallback(async (prompt, history = []) => {
    if (!editor || running) return null;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setSteps([]);
    try {
      const result = await runAgent({
        editor,
        prompt,
        history,
        agentStep: (payload) => aiApi.agentStep(payload),
        onStep: (step) => setSteps((prev) => [...prev, step]),
        signal: controller.signal,
      });
      runCounterRef.current += 1;
      const tagged = { ...result, runId: runCounterRef.current };
      setLastRun(tagged);
      return tagged;
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  }, [editor, running]);

  const stop = useCallback(() => controllerRef.current?.abort(), []);
  const undoRun = useCallback(() => (lastRun?.recorder ? lastRun.recorder.undo() : false), [lastRun]);

  return { run, stop, running, steps, lastRun, lastRunId: lastRun?.runId ?? null, undoRun };
}
