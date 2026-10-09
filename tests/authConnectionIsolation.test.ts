import { describe, expect, spyOn, test } from 'bun:test';
import { apiClient } from '@/services/api/client';
import { useAuthStore, useConfigStore } from '@/stores';

const oldCredentials = {
  apiBase: 'https://old.example.test',
  managementKey: 'fixture-old',
  rememberPassword: false,
};
const newCredentials = {
  apiBase: 'https://new.example.test',
  managementKey: 'fixture-new',
  rememberPassword: false,
};

function browserStorage() {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    },
  });
  return () => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  };
}

describe('authentication connection revisions', () => {
  test('a superseded login failure cannot mark a newer login disconnected', async () => {
    const restoreStorage = browserStorage();
    const original = useAuthStore.getState();
    let rejectOld!: (error: Error) => void;
    const fetch = spyOn(useConfigStore.getState(), 'fetchConfig')
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectOld = reject;
          })
      )
      .mockResolvedValue({});
    try {
      const old = useAuthStore
        .getState()
        .login(oldCredentials)
        .catch((error) => error);
      await useAuthStore.getState().login(newCredentials);
      rejectOld(new Error('Old connection failed'));
      await old;
      expect(useAuthStore.getState().managementKey).toBe(newCredentials.managementKey);
      expect(useAuthStore.getState().connectionStatus).toBe('connected');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    } finally {
      fetch.mockRestore();
      useAuthStore.setState(original);
      apiClient.setConfig(original);
      restoreStorage();
    }
  });

  test('a late successful login cannot restore a logged-out session', async () => {
    const restoreStorage = browserStorage();
    const original = useAuthStore.getState();
    let resolveOld!: (value: object) => void;
    const fetch = spyOn(useConfigStore.getState(), 'fetchConfig').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    );
    try {
      const old = useAuthStore
        .getState()
        .login(oldCredentials)
        .catch((error) => error);
      useAuthStore.getState().logout();
      resolveOld({});
      expect(await old).toHaveProperty('name', 'AbortError');
      expect(useAuthStore.getState().connectionStatus).toBe('disconnected');
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    } finally {
      fetch.mockRestore();
      useAuthStore.setState(original);
      apiClient.setConfig(original);
      restoreStorage();
    }
  });

  for (const failed of [false, true]) {
    test(`an old checkAuth cannot overwrite a switched connection (failed=${failed})`, async () => {
      const restoreStorage = browserStorage();
      const original = useAuthStore.getState();
      let settle!: () => void;
      const fetch = spyOn(useConfigStore.getState(), 'fetchConfig').mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            settle = () => (failed ? reject(new Error('Old session')) : resolve({}));
          })
      );
      try {
        useAuthStore.setState({
          ...oldCredentials,
          isAuthenticated: true,
          connectionStatus: 'connected',
        });
        const check = useAuthStore.getState().checkAuth();
        apiClient.setConfig(newCredentials);
        useAuthStore.setState({
          ...newCredentials,
          isAuthenticated: true,
          connectionStatus: 'connected',
        });
        settle();
        expect(await check).toBe(false);
        expect(useAuthStore.getState().managementKey).toBe(newCredentials.managementKey);
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
        expect(useAuthStore.getState().connectionStatus).toBe('connected');
      } finally {
        fetch.mockRestore();
        useAuthStore.setState(original);
        apiClient.setConfig(original);
        restoreStorage();
      }
    });
  }
});
