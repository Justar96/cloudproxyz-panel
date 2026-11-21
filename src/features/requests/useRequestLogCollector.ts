import { useEffect } from 'react';
import { apiClient } from '@/services/api/client';
import { USAGE_QUEUE_BATCH, usageQueueApi } from '@/services/api/usageQueue';
import { requestLogScope, useAuthStore, useRequestLogStore } from '@/stores';
import { getErrorMessage } from '@/utils/helpers';

/**
 * Unread records survive on the backend for 60 seconds by default, so poll well inside that.
 * Background tabs may throttle timers; a longer backend retention covers that gap.
 */
export const REQUEST_LOG_POLL_INTERVAL_MS = 5_000;
/** Drain bursts quickly, but never hold the connection in one poll indefinitely. */
const MAX_BATCHES_PER_POLL = 10;

/**
 * Mounted once by the authenticated layout: keeps the request log scoped to the current
 * connection and, when collection is enabled for it, drains the usage queue on an interval.
 */
export function useRequestLogCollector() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const apiBase = useAuthStore((state) => state.apiBase);
  const scope = isAuthenticated && apiBase ? requestLogScope(apiBase) : null;
  const setScope = useRequestLogStore((state) => state.setScope);
  const collecting = useRequestLogStore((state) => state.collecting && state.scope === scope);

  useEffect(() => {
    void setScope(scope);
  }, [scope, setScope]);

  useEffect(() => {
    if (!scope || !collecting) return;
    const { ingest, recordPoll } = useRequestLogStore.getState();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const revision = apiClient.getConnectionRevision();
      let error: string | null = null;
      try {
        for (let batch = 0; batch < MAX_BATCHES_PER_POLL; batch += 1) {
          const { records, received } = await usageQueueApi.pop(apiBase);
          // Popped records are gone from the backend: keep them even if collection just stopped.
          ingest(scope, records);
          if (cancelled || revision !== apiClient.getConnectionRevision()) return;
          if (received < USAGE_QUEUE_BATCH) break;
        }
      } catch (err: unknown) {
        if (cancelled || revision !== apiClient.getConnectionRevision()) return;
        error = getErrorMessage(err);
      }
      recordPoll(scope, error);
      if (!cancelled) timer = setTimeout(poll, REQUEST_LOG_POLL_INTERVAL_MS);
    };

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [scope, collecting, apiBase]);
}
