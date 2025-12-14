import { useState, useCallback, useRef } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useStoryboardHistory<T>(initialState: T) {
  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });
  
  const isUndoRedoAction = useRef(false);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const set = useCallback((newPresent: T | ((prev: T) => T)) => {
    setHistory((currentHistory) => {
      const resolvedPresent = typeof newPresent === 'function'
        ? (newPresent as (prev: T) => T)(currentHistory.present)
        : newPresent;

      // Skip if the state hasn't changed (shallow comparison)
      if (JSON.stringify(resolvedPresent) === JSON.stringify(currentHistory.present)) {
        return currentHistory;
      }

      // If this is an undo/redo action, don't add to history
      if (isUndoRedoAction.current) {
        isUndoRedoAction.current = false;
        return {
          ...currentHistory,
          present: resolvedPresent,
        };
      }

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: resolvedPresent,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.past.length === 0) return currentHistory;

      const previous = currentHistory.past[currentHistory.past.length - 1];
      const newPast = currentHistory.past.slice(0, currentHistory.past.length - 1);

      isUndoRedoAction.current = true;

      return {
        past: newPast,
        present: previous,
        future: [currentHistory.present, ...currentHistory.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentHistory) => {
      if (currentHistory.future.length === 0) return currentHistory;

      const next = currentHistory.future[0];
      const newFuture = currentHistory.future.slice(1);

      isUndoRedoAction.current = true;

      return {
        past: [...currentHistory.past, currentHistory.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = useCallback((newPresent: T) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
    historyLength: history.past.length,
    futureLength: history.future.length,
  };
}
