import { useState, useEffect, useCallback } from 'react';

export interface HistoryItem<T = any> {
  id: string;
  timestamp: number;
  prompt: string;
  result: string;
  parameters?: T;
}

export function usePersistentHistory<T>(key: string, limit: number = 20) {
  const [history, setHistory] = useState<HistoryItem<T>[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(`history_${key}`);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(`Failed to load history for ${key}:`, e);
      }
    }
  }, [key]);

  // Save to localStorage whenever history changes
  useEffect(() => {
    localStorage.setItem(`history_${key}`, JSON.stringify(history));
  }, [history, key]);

  const addHistory = useCallback((prompt: string, result: string, parameters?: T) => {
    const newItem: HistoryItem<T> = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      prompt,
      result,
      parameters
    };

    setHistory(prev => {
      // Avoid duplicate results if they are large strings
      if (prev.length > 0 && prev[0].result === result) return prev;
      return [newItem, ...prev].slice(0, limit);
    });
  }, [limit]);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  const removeHistory = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  return {
    history,
    addHistory,
    clearHistory,
    removeHistory
  };
}
