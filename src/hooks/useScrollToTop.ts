import { useEffect } from 'react';

/**
 * Custom hook to scroll to top when component mounts or dependency changes
 * @param dependency - Value that triggers scroll to top when it changes
 */
export const useScrollToTop = (dependency?: unknown) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [dependency]);
};
