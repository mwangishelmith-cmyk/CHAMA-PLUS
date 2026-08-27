import { useCallback, useEffect, useRef, useState } from "react";

import { getErrorMessage } from "../api/client";

/**
 * Tiny data-fetching hook giving every page the same loading / empty / error /
 * refetch behaviour without pulling in extra state libraries.
 *
 * `fetcher` must be stable (wrap it in useCallback). Returning `null` from it
 * skips the request — handy while the current chama is still unknown.
 */
export function useApiResource(fetcher, { enabled = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) {
        setError(getErrorMessage(err));
        setData(initialData);
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}

export default useApiResource;
