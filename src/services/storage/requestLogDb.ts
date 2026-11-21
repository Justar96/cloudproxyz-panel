/**
 * IndexedDB persistence for the Requests page.
 *
 * Records are already secret-free (see services/api/usageQueue.ts). Each connection gets its own
 * scope, capped to the newest REQUEST_LOG_CAP records. When IndexedDB is unavailable every
 * operation degrades to a no-op and the page keeps records in memory only.
 */

import type { RequestLogRecord } from '@/types/requestLog';

export const REQUEST_LOG_CAP = 10_000;

const DB_NAME = 'cloudproxyz-request-log';
const DB_VERSION = 1;
const STORE = 'records';
const SCOPE_TIME_INDEX = 'scope_timestamp';

type StoredRecord = RequestLogRecord & { scope: string };

let dbPromise: Promise<IDBDatabase | null> | null = null;

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const transactionDone = (transaction: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase | null>((resolve) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: ['scope', 'id'] });
        store.createIndex(SCOPE_TIME_INDEX, ['scope', 'timestamp']);
      };
      request.onsuccess = () => resolve(request.result);
      // Private browsing or blocked storage: fall back to memory only.
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
  }
  return dbPromise;
}

/** Index keys are [scope, timestamp]. */
const scopeRange = (scope: string) => IDBKeyRange.bound([scope, -Infinity], [scope, Infinity]);

/** Primary keys are [scope, id]; in key order an array sorts after every string id. */
const scopeKeyRange = (scope: string) => IDBKeyRange.bound([scope], [scope, []]);

const stripScope = ({ scope: _scope, ...record }: StoredRecord): RequestLogRecord => record;

/** Newest first, at most `limit` records. */
export async function loadRequestLog(
  scope: string,
  limit = REQUEST_LOG_CAP
): Promise<RequestLogRecord[]> {
  const db = await openDb();
  if (!db) return [];
  const transaction = db.transaction(STORE, 'readonly');
  const index = transaction.objectStore(STORE).index(SCOPE_TIME_INDEX);
  const records: RequestLogRecord[] = [];
  await new Promise<void>((resolve, reject) => {
    const cursorRequest = index.openCursor(scopeRange(scope), 'prev');
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor || records.length >= limit) {
        resolve();
        return;
      }
      records.push(stripScope(cursor.value as StoredRecord));
      cursor.continue();
    };
    cursorRequest.onerror = () => reject(cursorRequest.error);
  });
  return records;
}

/** Store records and drop the oldest beyond the cap. */
export async function appendRequestLog(
  scope: string,
  records: readonly RequestLogRecord[]
): Promise<void> {
  if (!records.length) return;
  const db = await openDb();
  if (!db) return;
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  for (const record of records) store.put({ ...record, scope } satisfies StoredRecord);

  const index = store.index(SCOPE_TIME_INDEX);
  const total = await requestToPromise(index.count(scopeRange(scope)));
  let excess = total - REQUEST_LOG_CAP;
  if (excess > 0) {
    await new Promise<void>((resolve, reject) => {
      const cursorRequest = index.openCursor(scopeRange(scope), 'next');
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (!cursor || excess <= 0) {
          resolve();
          return;
        }
        cursor.delete();
        excess -= 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  }
  await transactionDone(transaction);
}

export async function clearRequestLog(scope?: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const transaction = db.transaction(STORE, 'readwrite');
  const store = transaction.objectStore(STORE);
  if (scope === undefined) store.clear();
  else store.delete(scopeKeyRange(scope));
  await transactionDone(transaction);
}
