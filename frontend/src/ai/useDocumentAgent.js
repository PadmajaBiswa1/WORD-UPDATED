import { useCallback, useEffect, useRef, useState } from 'react';
import { aiApi } from '@/services/api';
import { runAgent } from '@/ai/agentLoop';

export function useDocumentAgent(editor) {
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [plan, setPlan] = useState(null);
  const planRef = useRef(null);
  const [lastRun, setLastRun] = useState(null);
  const controllerRef = useRef(null);
  const runCounterRef = useRef(0);
  const recorderRef = useRef(null); // the last run's recorder, listening until the next run starts

  // A recorder only makes sense for the editor it was recorded on.
  useEffect(() => () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [editor]);

  const run = useCallback(async (prompt, history = []) => {
    if (!editor || running) return null;
    const controller = new AbortController();
    controllerRef.current = controller;
    setRunning(true);
    setSteps([]);
    setPlan(null);
    planRef.current = null;
    // Starting a new run ends the previous run's undo window.
    recorderRef.current?.stop();
    recorderRef.current = null;
    try {
      const result = await runAgent({
        editor,
        prompt,
        history,
        agentStep: (payload, opts) => aiApi.agentStep(payload, opts),
        onStep: (step) => {
          if (step.kind === 'plan') {
            planRef.current = step.plan;
            setPlan(step.plan);
          }
          else setSteps((prev) => [...prev, step]);
        },
        signal: controller.signal,
      });
      recorderRef.current = result?.recorder || null;
      runCounterRef.current += 1;
      // Keep the final plan on the run so the chat can show it afterwards.
      const tagged = { ...result, runId: runCounterRef.current, plan: planRef.current };
      setLastRun(tagged);
      return tagged;
    } finally {
      setRunning(false);
      controllerRef.current = null;
    }
  }, [editor, running]);

  const stop = useCallback(() => controllerRef.current?.abort(), []);
  // Only the recorder that is still listening can undo safely: once a new run starts or the
  // editor changes it stops, and its inverse steps would land at stale positions.
  const undoRun = useCallback(() => {
    const recorder = lastRun?.recorder;
    if (running || !recorder || recorder !== recorderRef.current) return false;
    return recorder.undo();
  }, [lastRun, running]);

  return { run, stop, running, steps, plan, lastRun, lastRunId: lastRun?.runId ?? null, undoRun };
}
