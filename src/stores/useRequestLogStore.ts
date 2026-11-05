/**
 * Request log collected from the backend usage queue.
 *
 * Collection is opt-in per connection because reading the queue removes records, which would
 * starve any other consumer of the same backend. Records live in memory for the page and in
 * IndexedDB (services/storage/requestLogDb.ts) across reloads; signing out clears them.
 */

import { create } from 'zustand';
import type { RequestLogRecord } from '@/types/requestLog';
import { apiKeyNameFingerprint } from '@/features/config/apiKeyNames';
import { mergeRequestRecords } from '@/features/requests/logic';
import {
  REQUEST_LOG_CAP,
  appendRequestLog,
  clearRequestLog,
  loadRequestLog,
} from '@/services/storage/requestLogDb';

const COLLECT_KEY_PREFIX = 'request-log:collect:';

/** Storage scope for one backend; derived from the address only, never from a key. */
export const requestLogScope = (apiBase: string): string =>
  apiKeyNameFingerprint('request-log-scope', apiBase).slice(0, 32);

const readCollecting = (scope: string): boolean => {
  try {
    return localStorage.getItem(COLLECT_KEY_PREFIX + scope) === '1';
  } catch {
    return false;
  }
};

const writeCollecting = (scope: string, enabled: boolean) => {
  try {
    if (enabled) localStorage.setItem(COLLECT_KEY_PREFIX + scope, '1');
    else localStorage.removeItem(COLLECT_KEY_PREFIX + scope);
  } catch {
    // Storage unavailable: the choice lasts for this session only.
  }
};

interface RequestLogState {
  scope: string | null;
  records: RequestLogRecord[];
  /** True once stored records for the current scope have been loaded. */
  hydrated: boolean;
  collecting: boolean;
  lastPollAt: number | null;
  lastError: string | null;
  /** Switch to a connection's records (null when signed out). */
  setScope: (scope: string | null) => Promise<void>;
  setCollecting: (enabled: boolean) => void;
  /** Add records popped for `scope`; they are persisted even if the connection changed since. */
  ingest: (scope: string, records: readonly RequestLogRecord[]) => void;
  recordPoll: (scope: string, error: string | null) => void;
  clear: () => Promise<void>;
  /** Sign-out: forget every connection's records. The collection choice is kept. */
  reset: () => void;
}

export const useRequestLogStore = create<RequestLogState>((set, get) => ({
  scope: null,
  records: [],
  hydrated: false,
  collecting: false,
  lastPollAt: null,
  lastError: null,

  setScope: async (scope) => {
    if (get().scope === scope) return;
    set({
      scope,
      records: [],
      hydrated: false,
      collecting: scope ? readCollecting(scope) : false,
      lastPollAt: null,
      lastError: null,
    });
    if (!scope) return;
    let stored: RequestLogRecord[] = [];
    try {
      stored = await loadRequestLog(scope);
    } catch {
      stored = [];
    }
    if (get().scope !== scope) return;
    set((state) => ({
      records: mergeRequestRecords(state.records, stored, REQUEST_LOG_CAP),
      hydrated: true,
    }));
  },

  setCollecting: (enabled) => {
    const { scope } = get();
    if (!scope) return;
    writeCollecting(scope, enabled);
    set({ collecting: enabled, lastError: null });
  },

  ingest: (scope, records) => {
    if (!records.length) return;
    void appendRequestLog(scope, records).catch(() => undefined);
    if (get().scope !== scope) return;
    set((state) => ({ records: mergeRequestRecords(state.records, records, REQUEST_LOG_CAP) }));
  },

  recordPoll: (scope, error) => {
    if (get().scope !== scope) return;
    set({ lastPollAt: Date.now(), lastError: error });
  },

  clear: async () => {
    const { scope } = get();
    if (!scope) return;
    set({ records: [] });
    await clearRequestLog(scope).catch(() => undefined);
  },

  reset: () => {
    set({
      scope: null,
      records: [],
      hydrated: false,
      collecting: false,
      lastPollAt: null,
      lastError: null,
    });
    void clearRequestLog().catch(() => undefined);
  },
}));
