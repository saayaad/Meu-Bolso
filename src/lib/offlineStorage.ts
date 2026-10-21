import { Transaction, Account, Category, Budget, Goal, Workspace, UserProfile } from '../types';

export const OFFLINE_CACHE_NAME = 'meu-bolso-data-cache-v1';
const SNAPSHOT_STORAGE_PREFIX = 'meu_bolso_offline_snapshot_';
const PROFILE_STORAGE_KEY = 'meu_bolso_offline_user_profile';
const PENDING_QUEUE_PREFIX = 'meu_bolso_offline_pending_txs_';

export interface OfflineDataSnapshot {
  workspaceId: string;
  workspace: Workspace | null;
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  budgets?: Budget[];
  goals?: Goal[];
  timestamp: string;
  formattedTimestamp: string;
}

function getFormattedDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDate;
  }
}

/**
 * Persists recent transactions, accounts, categories, and financial data
 * into the browser's Cache API (with localStorage fallback).
 * This enables viewing all financial records even with zero internet connectivity.
 */
export async function saveOfflineSnapshot(
  workspaceId: string,
  data: {
    workspace?: Workspace | null;
    transactions: Transaction[];
    accounts: Account[];
    categories: Category[];
    budgets?: Budget[];
    goals?: Goal[];
  }
): Promise<void> {
  const now = new Date().toISOString();
  const snapshot: OfflineDataSnapshot = {
    workspaceId,
    workspace: data.workspace || null,
    transactions: data.transactions,
    accounts: data.accounts,
    categories: data.categories,
    budgets: data.budgets || [],
    goals: data.goals || [],
    timestamp: now,
    formattedTimestamp: getFormattedDate(now),
  };

  const jsonStr = JSON.stringify(snapshot);

  // 1. Primary: Browser Cache API
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request(`/offline-cache/workspace-${workspaceId}`, {
        headers: { 'Content-Type': 'application/json' },
      });
      const response = new Response(jsonStr, {
        headers: {
          'Content-Type': 'application/json',
          'X-Cache-Timestamp': snapshot.timestamp,
          'X-Cache-Item-Count': String(snapshot.transactions.length),
        },
      });
      await cache.put(cacheUrl, response);
    } catch (err) {
      console.warn('Cache API indisponível ou com erro ao salvar snapshot:', err);
    }
  }

  // 2. Secondary: localStorage instantaneous backup
  try {
    localStorage.setItem(SNAPSHOT_STORAGE_PREFIX + workspaceId, jsonStr);
  } catch (err) {
    console.warn('LocalStorage indisponível ao salvar snapshot:', err);
  }
}

/**
 * Retrieves the cached offline snapshot using Cache API (or localStorage fallback).
 */
export async function getOfflineSnapshot(workspaceId: string): Promise<OfflineDataSnapshot | null> {
  // 1. Primary: Attempt Cache API
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request(`/offline-cache/workspace-${workspaceId}`);
      const cachedResponse = await cache.match(cacheUrl);
      if (cachedResponse) {
        const data = await cachedResponse.json();
        return data as OfflineDataSnapshot;
      }
    } catch (err) {
      console.warn('Cache API match falhou, tentando fallback:', err);
    }
  }

  // 2. Secondary: Fallback to localStorage
  try {
    const raw = localStorage.getItem(SNAPSHOT_STORAGE_PREFIX + workspaceId);
    if (raw) {
      return JSON.parse(raw) as OfflineDataSnapshot;
    }
  } catch (err) {
    console.warn('LocalStorage snapshot leitura falhou:', err);
  }

  return null;
}

/**
 * Cache user profile so the app can stay active even if offline on restart.
 */
export async function saveUserProfileOffline(profile: UserProfile): Promise<void> {
  const jsonStr = JSON.stringify(profile);

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request('/offline-cache/user-profile');
      await cache.put(
        cacheUrl,
        new Response(jsonStr, { headers: { 'Content-Type': 'application/json' } })
      );
    } catch (err) {
      console.warn('Erro ao salvar perfil no Cache API:', err);
    }
  }

  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, jsonStr);
  } catch (err) {
    console.warn('Erro ao salvar perfil no localStorage:', err);
  }
}

export async function getUserProfileOffline(): Promise<UserProfile | null> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request('/offline-cache/user-profile');
      const res = await cache.match(cacheUrl);
      if (res) {
        return (await res.json()) as UserProfile;
      }
    } catch (err) {
      console.warn('Erro ao ler perfil do Cache API:', err);
    }
  }

  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as UserProfile;
    }
  } catch (err) {
    console.warn('Erro ao ler perfil do localStorage:', err);
  }

  return null;
}

/**
 * Queue a transaction created while offline to be synced automatically when back online.
 */
export async function queuePendingOfflineTransaction(
  workspaceId: string,
  transaction: Transaction
): Promise<void> {
  const existing = await getPendingOfflineTransactions(workspaceId);
  const updated = [...existing.filter(t => t.id !== transaction.id), transaction];
  const jsonStr = JSON.stringify(updated);

  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request(`/offline-cache/pending-txs-${workspaceId}`);
      await cache.put(
        cacheUrl,
        new Response(jsonStr, { headers: { 'Content-Type': 'application/json' } })
      );
    } catch (err) {
      console.warn('Erro ao enfileirar transação no Cache API:', err);
    }
  }

  try {
    localStorage.setItem(PENDING_QUEUE_PREFIX + workspaceId, jsonStr);
  } catch (err) {
    console.warn('Erro ao enfileirar transação no localStorage:', err);
  }
}

export async function getPendingOfflineTransactions(workspaceId: string): Promise<Transaction[]> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request(`/offline-cache/pending-txs-${workspaceId}`);
      const res = await cache.match(cacheUrl);
      if (res) {
        return (await res.json()) as Transaction[];
      }
    } catch (err) {
      console.warn('Erro ao ler fila offline do Cache API:', err);
    }
  }

  try {
    const raw = localStorage.getItem(PENDING_QUEUE_PREFIX + workspaceId);
    if (raw) {
      return JSON.parse(raw) as Transaction[];
    }
  } catch (err) {
    console.warn('Erro ao ler fila offline do localStorage:', err);
  }

  return [];
}

export async function clearPendingOfflineTransactions(workspaceId: string): Promise<void> {
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      const cacheUrl = new Request(`/offline-cache/pending-txs-${workspaceId}`);
      await cache.delete(cacheUrl);
    } catch (err) {
      console.warn('Erro ao limpar fila no Cache API:', err);
    }
  }

  try {
    localStorage.removeItem(PENDING_QUEUE_PREFIX + workspaceId);
  } catch (err) {
    console.warn('Erro ao limpar fila no localStorage:', err);
  }
}

/**
 * Returns cache metadata (last sync time, cached transactions count, pending sync count)
 */
export async function getCacheDetails(
  workspaceId: string
): Promise<{ lastSync: string | null; transactionCount: number; pendingCount: number }> {
  const snapshot = await getOfflineSnapshot(workspaceId);
  const pending = await getPendingOfflineTransactions(workspaceId);

  return {
    lastSync: snapshot?.formattedTimestamp || null,
    transactionCount: snapshot?.transactions?.length || 0,
    pendingCount: pending.length,
  };
}
