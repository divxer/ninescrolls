import { useEffect } from 'react';

/**
 * Custom hook to scroll to top when component mounts or dependencies change
 * @param dependencies - Array of dependencies that trigger scroll to top
 */
export const useScrollToTop = (dependencies: any[] = []) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, dependencies);
};
