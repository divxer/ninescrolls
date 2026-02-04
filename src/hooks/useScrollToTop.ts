import { useEffect } from 'react';

/**
 * Custom hook to scroll to top when component mounts or dependencies change
 * @param dependencies - Values that trigger scroll to top when they change
 */
export const useScrollToTop = (dependencies: ReadonlyArray<unknown> = []) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  // We intentionally accept an array to support multiple dependencies.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};
