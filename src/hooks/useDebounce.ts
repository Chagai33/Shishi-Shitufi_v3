// src/hooks/useDebounce.ts

import { useEffect, useState } from 'react';

/**
 * 🚀 OPTIMIZATION: Debounce hook for search inputs.
 * Reduces unnecessary re-renders and filtering operations during typing.
 * 
 * @param value - The value to debounce (e.g., search term)
 * @param delay - Delay in milliseconds (default: 300ms)
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
