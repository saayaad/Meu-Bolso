import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import {
  Account,
  Category,
  Transaction,
  Recurrence,
  Budget,
  Goal,
  Workspace,
  WorkspaceMember,
  Invite,
  MemberRole,
} from '../types';
import { generateInstallmentTransactions } from '../lib/installments';
import { generateUpcomingRecurrences } from '../lib/recurrence';
import { todayString } from '../lib/dates';
import {
  saveOfflineSnapshot,
  getOfflineSnapshot,
  queuePendingOfflineTransaction,
  getPendingOfflineTransactions,
  clearPendingOfflineTransactions,
} from '../lib/offlineStorage';
import { DEFAULT_CATEGORIES } from '../lib/constants';

interface WorkspaceContextType {
  activeWorkspaceId: string | null;
  workspace: Workspace | null;
  members: WorkspaceMember[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurrences: Recurrence[];
  budgets: Budget[];
  goals: Goal[];
  trashItems: {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    goals: Budget[];
  } extends never ? never : {
    accounts: Account[];
    categories: Category[];
    transactions: Transaction[];
    budgets: Budget[];
    goals: Goal[];
  };
  loading: boolean;
  userRole: MemberRole;
  canEdit: boolean;
  isOwner: boolean;
  isOfflineMode: boolean;
  lastSyncTime: string | null;
  pendingOfflineCount: number;
  
  createWorkspace: (name: string) => Promise<string>;
  updateWorkspaceName: (name: string) => Promise<void>;

  addTransaction: (data: Omit<Transaction, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>, options?: { installmentCount?: number; isRecurring?: boolean; recurrenceFreq?: 'weekly' | 'monthly' | 'yearly'; recurrenceEnd?: string }) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>, scope?: 'single' | 'future' | 'all') => Promise<void>;
  deleteTransaction: (id: string, scope?: 'single' | 'future' | 'all') => Promise<void>;
  markAsPaid: (id: string, paidDate?: string, paidFromAccountId?: string) => Promise<void>;
  payCreditCardInvoice: (cardAccountId: string, paymentAccountId: string, invoiceTransactions: Transaction[], paymentDate?: string) => Promise<void>;
  
  addAccount: (account: Omit<Account, 'id'>) => Promise<void>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  archiveAccount: (id: string, archived: boolean) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  
  addCategory: (category: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string, reassignToCategoryId?: string) => Promise<void>;
  restoreDefaultCategories: () => Promise<void>;
  
  setBudgetLimit: (categoryId: string, limitCents: number, alertPercent?: number) => Promise<void>;
  setBudgetMode: (mode: 'categoria' | '50-30-20' | 'base-zero') => Promise<void>;
  deleteBudget: (id: string) => Promise<void>;
  
  addGoal: (goal: Omit<Goal, 'id' | 'savedCents' | 'contributions'>) => Promise<void>;
  updateGoal: (id: string, data: Partial<Goal>) => Promise<void>;
  addGoalContribution: (goalId: string, amountCents: number, note?: string) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  clearAllWorkspaceData: () => Promise<void>;
  restoreTrashItem: (type: 'account' | 'category' | 'transaction' | 'budget' | 'goal', id: string) => Promise<void>;
  
  createInvite: (role: 'editor' | 'viewer') => Promise<string>;
  joinWorkspaceByInvite: (inviteCode: string) => Promise<{ success: boolean; message: string }>;
  updateMemberRole: (uid: string, role: 'editor' | 'viewer') => Promise<void>;
  removeMember: (uid: string) => Promise<void>;
  leaveWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null);

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as T;
}

async function commitOptimistic(operation: Promise<unknown>, timeoutMs = 400): Promise<void> {
  operation.catch(err => {
    console.warn('Aviso na sincronização com o Firestore:', err);
  });
  await Promise.race([
    operation,
    new Promise<void>(resolve => setTimeout(resolve, timeoutMs)),
  ]);
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, switchActiveWorkspace, updateUserProfileData } = useAuth();
  const activeWorkspaceId = userProfile?.activeWorkspaceId || (userProfile?.workspaceIds?.[0] ?? null);

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  const userRole: MemberRole = useMemo(() => {
    if (!currentUser) return 'viewer';
    if (workspace?.ownerId === currentUser.uid) return 'owner';
    const found = members.find(m => m.uid === currentUser.uid);
    if (found) return found.role;
    return workspace ? 'viewer' : 'owner';
  }, [currentUser, workspace, members]);

  const isOwner = useMemo(() => {
    if (!currentUser) return false;
    if (workspace?.ownerId === currentUser.uid) return true;
    return userRole === 'owner';
  }, [currentUser, workspace, userRole]);

  const canEdit = useMemo(() => {
    return isOwner || userRole === 'owner' || userRole === 'editor';
  }, [isOwner, userRole]);

  // Separação de itens ativos e lixeira (soft delete)
  const activeAccounts = useMemo(() => accounts.filter(a => !a.deletedAt), [accounts]);
  const activeCategories = useMemo(() => categories.filter(c => !c.deletedAt), [categories]);
  const activeTransactions = useMemo(() => transactions.filter(t => !t.deletedAt), [transactions]);
  const activeBudgets = useMemo(() => budgets.filter(b => !b.deletedAt), [budgets]);
  const activeGoals = useMemo(() => goals.filter(g => !g.deletedAt), [goals]);

  const trashItems = useMemo(() => ({
    accounts: accounts.filter(a => !!a.deletedAt),
    categories: categories.filter(c => !!c.deletedAt),
    transactions: transactions.filter(t => !!t.deletedAt),
    budgets: budgets.filter(b => !!b.deletedAt),
    goals: goals.filter(g => !!g.deletedAt),
  }), [accounts, categories, transactions, budgets, goals]);

  useEffect(() => {
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOfflineMode || !currentUser || !activeWorkspaceId) return;

    let cancelled = false;
    getPendingOfflineTransactions(activeWorkspaceId).then(async pending => {
      if (cancelled || pending.length === 0) return;
      try {
        const batch = writeBatch(db);
        pending.forEach(tx => {
          const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, tx.id);
          batch.set(ref, stripUndefined(tx as unknown as Record<string, unknown>));
        });
        await commitOptimistic(batch.commit());
        await clearPendingOfflineTransactions(activeWorkspaceId);
        if (!cancelled) {
          setPendingOfflineCount(0);
        }
      } catch (err) {
        console.warn('Falha ao sincronizar transações offline pendentes:', err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOfflineMode, currentUser, activeWorkspaceId]);

  useEffect(() => {
    if (!currentUser || !activeWorkspaceId) {
      setLoading(false);
      return;
    }

    getOfflineSnapshot(activeWorkspaceId).then(cached => {
      if (cached) {
        if (cached.workspace) setWorkspace(cached.workspace);
        if (cached.accounts?.length) setAccounts(cached.accounts);
        if (cached.categories?.length) setCategories(cached.categories);
        if (cached.transactions?.length) setTransactions(cached.transactions);
        if (cached.budgets?.length) setBudgets(cached.budgets);
        if (cached.goals?.length) setGoals(cached.goals);
        if (cached.formattedTimestamp) setLastSyncTime(cached.formattedTimestamp);
        setLoading(false);
      }
    });

    getPendingOfflineTransactions(activeWorkspaceId).then(pending => {
      setPendingOfflineCount(pending.length);
    });

    setLoading(true);
    const unsubs: (() => void)[] = [];

    const wsRef = doc(db, 'workspaces', activeWorkspaceId);
    unsubs.push(
      onSnapshot(
        wsRef,
        snap => {
          if (snap.exists()) {
            setWorkspace({ id: snap.id, ...(snap.data() as Omit<Workspace, 'id'>) });
          }
        },
        err => console.warn('Workspace snapshot warn:', err)
      )
    );

    const membersRef = collection(db, `workspaces/${activeWorkspaceId}/members`);
    unsubs.push(
      onSnapshot(
        membersRef,
        snap => {
          setMembers(snap.docs.map(d => ({ uid: d.id, ...(d.data() as Omit<WorkspaceMember, 'uid'>) })));
        },
        err => console.warn('Members snapshot warn:', err)
      )
    );

    const accRef = collection(db, `workspaces/${activeWorkspaceId}/accounts`);
    unsubs.push(
      onSnapshot(
        accRef,
        snap => {
          setAccounts(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Account, 'id'>) })));
        },
        err => console.warn('Accounts snapshot warn:', err)
      )
    );

    const catRef = collection(db, `workspaces/${activeWorkspaceId}/categories`);
    unsubs.push(
      onSnapshot(
        catRef,
        snap => {
          const loadedCats = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
          const seedKey = `meu_bolso_seeded_cats_v4_${activeWorkspaceId}`;

          if (!localStorage.getItem(seedKey)) {
            localStorage.setItem(seedKey, 'true');
            const missing = DEFAULT_CATEGORIES.filter(
              def => !loadedCats.some(c => c.name.toLowerCase() === def.name.toLowerCase() && c.type === def.type)
            );

            if (missing.length > 0) {
              const batch = writeBatch(db);
              const createdCats: Category[] = [];

              missing.forEach(def => {
                const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/categories`));
                const cleanCat = stripUndefined(def as unknown as Record<string, unknown>);
                batch.set(ref, cleanCat);
                createdCats.push({ id: ref.id, ...def } as Category);
              });

              setCategories([...loadedCats, ...createdCats]);
              commitOptimistic(batch.commit());
              return;
            }
          }

          setCategories(loadedCats);
        },
        err => console.warn('Categories snapshot warn:', err)
      )
    );

    const txRef = collection(db, `workspaces/${activeWorkspaceId}/transactions`);
    unsubs.push(
      onSnapshot(
        txRef,
        snap => {
          const list = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }));
          list.sort((a, b) => b.date.localeCompare(a.date));
          setTransactions(list);
          setLoading(false);
        },
        err => {
          console.warn('Transactions snapshot warn:', err);
          setLoading(false);
        }
      )
    );

    const recRef = collection(db, `workspaces/${activeWorkspaceId}/recurrences`);
    unsubs.push(
      onSnapshot(
        recRef,
        snap => {
          setRecurrences(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Recurrence, 'id'>) })));
        },
        err => console.warn('Recurrences snapshot warn:', err)
      )
    );

    const budRef = collection(db, `workspaces/${activeWorkspaceId}/budgets`);
    unsubs.push(
      onSnapshot(
        budRef,
        snap => {
          setBudgets(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Budget, 'id'>) })));
        },
        err => console.warn('Budgets snapshot warn:', err)
      )
    );

    const goalRef = collection(db, `workspaces/${activeWorkspaceId}/goals`);
    unsubs.push(
      onSnapshot(
        goalRef,
        snap => {
          setGoals(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Goal, 'id'>) })));
        },
        err => console.warn('Goals snapshot warn:', err)
      )
    );

    return () => {
      unsubs.forEach(u => u());
    };
  }, [currentUser, activeWorkspaceId]);

  useEffect(() => {
    if (isOfflineMode || !activeWorkspaceId || !canEdit || recurrences.length === 0 || loading) return;

    const existingIds = new Set(transactions.map(t => t.id));
    const upcoming = generateUpcomingRecurrences(recurrences, existingIds);
    if (upcoming.length === 0) return;

    const batch = writeBatch(db);
    upcoming.forEach(tx => {
      const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, tx.id);
      batch.set(ref, stripUndefined(tx as unknown as Record<string, unknown>));
    });
    batch.commit().catch(err => console.warn('Aviso ao gerar recorrências futuras:', err));
  }, [isOfflineMode, activeWorkspaceId, canEdit, recurrences, transactions, loading]);

  useEffect(() => {
    if (activeWorkspaceId && (transactions.length > 0 || accounts.length > 0)) {
      saveOfflineSnapshot(activeWorkspaceId, {
        workspace,
        transactions: activeTransactions,
        accounts: activeAccounts,
        categories: activeCategories,
        budgets: activeBudgets,
        goals: activeGoals,
      });
    }
  }, [activeWorkspaceId, workspace, activeTransactions, activeAccounts, activeCategories, activeBudgets, activeGoals]);

  const createWorkspace = async (name: string): Promise<string> => {
    if (!currentUser || !userProfile) throw new Error('Usuário não autenticado.');

    const workspaceId = `ws_${currentUser.uid.substring(0, 8)}_${Date.now()}`;
    const workspaceRef = doc(db, 'workspaces', workspaceId);
    const newWs: Workspace = {
      id: workspaceId,
      name: name.trim(),
      ownerId: currentUser.uid,
      createdAt: new Date().toISOString(),
      budgetMode: 'categoria',
    };

    // 1. Cria o documento do workspace
    await commitOptimistic(setDoc(workspaceRef, newWs));

    // 2. Cria o documento de membro com role "owner"
    const memberRef = doc(db, `workspaces/${workspaceId}/members`, currentUser.uid);
    await commitOptimistic(
      setDoc(memberRef, {
        uid: currentUser.uid,
        role: 'owner',
        name: userProfile.name || currentUser.displayName || 'Proprietário',
        email: currentUser.email || '',
        joinedAt: new Date().toISOString(),
      })
    );

    // 3. Cria conta e categorias padrão
    const batch = writeBatch(db);
    const accountRef = doc(collection(db, `workspaces/${workspaceId}/accounts`));
    batch.set(accountRef, {
      name: 'Carteira',
      type: 'carteira',
      initialBalanceCents: 0,
      color: '#4ADE80',
      icon: 'Wallet',
      archived: false,
    });

    for (const cat of DEFAULT_CATEGORIES) {
      const catRef = doc(collection(db, `workspaces/${workspaceId}/categories`));
      batch.set(catRef, cat);
    }

    localStorage.setItem(`meu_bolso_seeded_cats_v4_${workspaceId}`, 'true');
    await commitOptimistic(batch.commit());

    const updatedWorkspaceIds = Array.from(new Set([...(userProfile.workspaceIds || []), workspaceId]));
    await updateUserProfileData({
      workspaceIds: updatedWorkspaceIds,
      activeWorkspaceId: workspaceId,
    });

    return workspaceId;
  };

  const updateWorkspaceName = async (name: string) => {
    if (!activeWorkspaceId) return;
    const ref = doc(db, 'workspaces', activeWorkspaceId);
    setWorkspace(prev => prev ? { ...prev, name: name.trim() } : prev);
    await commitOptimistic(updateDoc(ref, { name: name.trim() }));
  };

  const addTransaction = async (
    data: Omit<Transaction, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>,
    options?: {
      installmentCount?: number;
      isRecurring?: boolean;
      recurrenceFreq?: 'weekly' | 'monthly' | 'yearly';
      recurrenceEnd?: string;
    }
  ) => {
    if (!currentUser || !activeWorkspaceId || !canEdit) return;

    const now = new Date().toISOString();
    const baseTx: Omit<Transaction, 'id'> = stripUndefined({
      ...data,
      createdBy: currentUser.uid,
      createdAt: now,
      updatedAt: now,
    });

    if (!navigator.onLine) {
      const offlineId = `tx_offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const offlineTx: Transaction = { ...baseTx, id: offlineId };
      setTransactions(prev => [offlineTx, ...prev]);
      await queuePendingOfflineTransaction(activeWorkspaceId, offlineTx);
      setPendingOfflineCount(prev => prev + 1);
      return;
    }

    if (data.type === 'expense' && options?.installmentCount && options.installmentCount > 1) {
      const installments = generateInstallmentTransactions({
        baseTransaction: baseTx,
        installmentCount: options.installmentCount,
      });

      setTransactions(prev => [...installments, ...prev].sort((a, b) => b.date.localeCompare(a.date)));

      const batch = writeBatch(db);
      installments.forEach(item => {
        const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, item.id);
        batch.set(ref, stripUndefined(item as unknown as Record<string, unknown>));
      });
      await commitOptimistic(batch.commit());
      return;
    }

    if (options?.isRecurring && options?.recurrenceFreq) {
      const recRef = doc(collection(db, `workspaces/${activeWorkspaceId}/recurrences`));
      const recurrence: Omit<Recurrence, 'id'> = {
        template: stripUndefined({ ...data, createdBy: currentUser.uid }),
        frequency: options.recurrenceFreq,
        startDate: data.date,
        endDate: options.recurrenceEnd || null,
        active: true,
      };
      await commitOptimistic(setDoc(recRef, recurrence));

      const firstRecTxId = `rec_${recRef.id}_${data.date}`;
      const txRef = doc(db, `workspaces/${activeWorkspaceId}/transactions`, firstRecTxId);
      const newTx: Transaction = stripUndefined({ ...baseTx, id: firstRecTxId, recurrenceId: recRef.id });
      setTransactions(prev => [newTx, ...prev.filter(t => t.id !== firstRecTxId)]);
      await commitOptimistic(setDoc(txRef, newTx));
      return;
    }

    const txRef = doc(collection(db, `workspaces/${activeWorkspaceId}/transactions`));
    const newTx: Transaction = stripUndefined({ ...baseTx, id: txRef.id });
    setTransactions(prev => [newTx, ...prev.filter(t => t.id !== txRef.id)]);
    await commitOptimistic(setDoc(txRef, newTx));
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>, scope: 'single' | 'future' | 'all' = 'single') => {
    if (!activeWorkspaceId || !canEdit) return;
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    const cleanData = stripUndefined({ ...data, updatedAt: now });

    if (scope === 'single' || (!target.installment && !target.recurrenceId)) {
      setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...cleanData } : t)));
      const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, id);
      await commitOptimistic(updateDoc(ref, cleanData));
      return;
    }

    if (target.installment) {
      const { groupId, number } = target.installment;
      const related = transactions.filter(t => t.installment?.groupId === groupId);
      const batch = writeBatch(db);
      const { date: _d, installment: _inst, id: _ignore, ...toUpdate } = cleanData;

      setTransactions(prev =>
        prev.map(t => {
          if (
            t.installment?.groupId === groupId &&
            (scope === 'all' || (scope === 'future' && (t.installment?.number || 0) >= number))
          ) {
            return { ...t, ...toUpdate };
          }
          return t;
        })
      );

      related.forEach(item => {
        if (scope === 'all' || (scope === 'future' && (item.installment?.number || 0) >= number)) {
          const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, item.id);
          batch.update(ref, toUpdate);
        }
      });
      await commitOptimistic(batch.commit());
      return;
    }

    if (target.recurrenceId) {
      const batch = writeBatch(db);
      const related = transactions.filter(t => t.recurrenceId === target.recurrenceId);
      const { date: _d, id: _ignore, ...toUpdate } = cleanData;

      setTransactions(prev =>
        prev.map(t => {
          if (
            t.recurrenceId === target.recurrenceId &&
            (scope === 'all' || (scope === 'future' && t.date >= target.date))
          ) {
            return { ...t, ...toUpdate };
          }
          return t;
        })
      );

      related.forEach(item => {
        if (scope === 'all' || (scope === 'future' && item.date >= target.date)) {
          const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, item.id);
          batch.update(ref, toUpdate);
        }
      });
      await commitOptimistic(batch.commit());
    }
  };

  const deleteTransaction = async (id: string, scope: 'single' | 'future' | 'all' = 'single') => {
    if (!activeWorkspaceId || !canEdit) return;
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    const deletedAt = new Date().toISOString();

    if (scope === 'single' || (!target.installment && !target.recurrenceId)) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, deletedAt } : t));
      const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, id);
      await commitOptimistic(updateDoc(ref, { deletedAt }));
      return;
    }

    if (target.installment) {
      const { groupId, number } = target.installment;
      const related = transactions.filter(t => t.installment?.groupId === groupId);
      const batch = writeBatch(db);
      setTransactions(prev => prev.map(t => {
        if (t.installment?.groupId === groupId && (scope === 'all' || (scope === 'future' && (t.installment?.number || 0) >= number))) {
          return { ...t, deletedAt };
        }
        return t;
      }));
      related.forEach(item => {
        if (scope === 'all' || (scope === 'future' && (item.installment?.number || 0) >= number)) {
          const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, item.id);
          batch.update(ref, { deletedAt });
        }
      });
      await commitOptimistic(batch.commit());
      return;
    }

    if (target.recurrenceId) {
      const batch = writeBatch(db);
      setTransactions(prev => prev.map(t => {
        if (t.recurrenceId === target.recurrenceId && (scope === 'all' || (scope === 'future' && t.date >= target.date))) {
          return { ...t, deletedAt };
        }
        return t;
      }));
      const related = transactions.filter(t => t.recurrenceId === target.recurrenceId);
      related.forEach(item => {
        if (scope === 'all' || (scope === 'future' && item.date >= target.date)) {
          const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, item.id);
          batch.update(ref, { deletedAt });
        }
      });
      const recRef = doc(db, `workspaces/${activeWorkspaceId}/recurrences`, target.recurrenceId);
      batch.update(recRef, { active: false });
      await commitOptimistic(batch.commit());
    }
  };

  const markAsPaid = async (id: string, paidDate: string = todayString(), paidFromAccountId?: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, id);
    const updates: Partial<Transaction> = {
      status: 'paid',
      paidDate,
      updatedAt: new Date().toISOString(),
    };
    if (paidFromAccountId) {
      updates.paidFromAccountId = paidFromAccountId;
    }
    setTransactions(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
    await commitOptimistic(updateDoc(ref, updates));
  };

  const payCreditCardInvoice = async (
    _cardAccountId: string,
    paymentAccountId: string,
    invoiceTransactions: Transaction[],
    paymentDate: string = todayString()
  ) => {
    if (!activeWorkspaceId || !canEdit || !invoiceTransactions.length) return;
    const batch = writeBatch(db);
    const invoiceIds = new Set(invoiceTransactions.map(t => t.id));
    const now = new Date().toISOString();

    setTransactions(prev =>
      prev.map(t =>
        invoiceIds.has(t.id)
          ? { ...t, status: 'paid', paidDate: paymentDate, paidFromAccountId: paymentAccountId, updatedAt: now }
          : t
      )
    );

    invoiceTransactions.forEach(t => {
      const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, t.id);
      batch.update(ref, {
        status: 'paid',
        paidDate: paymentDate,
        paidFromAccountId: paymentAccountId,
        updatedAt: now,
      });
    });

    await commitOptimistic(batch.commit());
  };

  const addAccount = async (account: Omit<Account, 'id'>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/accounts`));
    const cleanAccount = stripUndefined({ ...account, archived: false });
    const newAcc: Account = { id: ref.id, ...cleanAccount };

    setAccounts(prev => [...prev.filter(a => a.id !== ref.id), newAcc]);
    await commitOptimistic(setDoc(ref, cleanAccount));
  };

  const updateAccount = async (id: string, account: Partial<Account>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/accounts`, id);
    const cleanAccount = stripUndefined(account);

    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, ...cleanAccount } : a)));
    await commitOptimistic(updateDoc(ref, cleanAccount));
  };

  const archiveAccount = async (id: string, archived: boolean) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/accounts`, id);

    setAccounts(prev => prev.map(a => (a.id === id ? { ...a, archived } : a)));
    await commitOptimistic(updateDoc(ref, { archived }));
  };

  const deleteAccount = async (id: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const deletedAt = new Date().toISOString();
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, deletedAt } : a));
    const ref = doc(db, `workspaces/${activeWorkspaceId}/accounts`, id);
    await commitOptimistic(updateDoc(ref, { deletedAt }));
  };

  const addCategory = async (category: Omit<Category, 'id'>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/categories`));
    const cleanCat = stripUndefined(category);
    const newCat: Category = { id: ref.id, ...cleanCat };

    setCategories(prev => [...prev.filter(c => c.id !== ref.id), newCat]);
    await commitOptimistic(setDoc(ref, cleanCat));
  };

  const updateCategory = async (id: string, category: Partial<Category>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/categories`, id);
    const cleanCat = stripUndefined(category);
    setCategories(prev => prev.map(c => (c.id === id ? { ...c, ...cleanCat } : c)));
    await commitOptimistic(updateDoc(ref, cleanCat));
  };

  const deleteCategory = async (id: string, reassignToCategoryId?: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const batch = writeBatch(db);

    if (reassignToCategoryId) {
      const affected = transactions.filter(t => t.categoryId === id);
      setTransactions(prev =>
        prev.map(t => (t.categoryId === id ? { ...t, categoryId: reassignToCategoryId } : t))
      );
      affected.forEach(t => {
        const ref = doc(db, `workspaces/${activeWorkspaceId}/transactions`, t.id);
        batch.update(ref, { categoryId: reassignToCategoryId });
      });
    }

    const deletedAt = new Date().toISOString();
    setCategories(prev => prev.map(c => c.id === id ? { ...c, deletedAt } : c));
    const catRef = doc(db, `workspaces/${activeWorkspaceId}/categories`, id);
    batch.update(catRef, { deletedAt });
    await commitOptimistic(batch.commit());
  };

  const restoreDefaultCategories = async () => {
    if (!activeWorkspaceId || !canEdit) return;
    const batch = writeBatch(db);
    let added = 0;
    const newCats: Category[] = [];

    for (const cat of DEFAULT_CATEGORIES) {
      const exists = categories.some(
        c => c.name.toLowerCase() === cat.name.toLowerCase() && c.type === cat.type && !c.deletedAt
      );
      if (!exists) {
        const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/categories`));
        const cleanCat = stripUndefined(cat as unknown as Record<string, unknown>);
        batch.set(ref, cleanCat);
        newCats.push({ id: ref.id, ...cat } as Category);
        added++;
      }
    }

    if (added > 0) {
      setCategories(prev => [...prev, ...newCats]);
      await commitOptimistic(batch.commit());
    }
  };

  const setBudgetLimit = async (categoryId: string, limitCents: number, alertPercent: number = 80) => {
    if (!activeWorkspaceId || !canEdit) return;
    const existing = budgets.find(b => b.categoryId === categoryId);
    if (existing) {
      const ref = doc(db, `workspaces/${activeWorkspaceId}/budgets`, existing.id);
      setBudgets(prev => prev.map(b => (b.id === existing.id ? { ...b, limitCents, alertPercent, deletedAt: null } : b)));
      await commitOptimistic(updateDoc(ref, { limitCents, alertPercent, deletedAt: null }));
    } else {
      const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/budgets`));
      setBudgets(prev => [...prev, { id: ref.id, categoryId, limitCents, alertPercent }]);
      await commitOptimistic(setDoc(ref, { categoryId, limitCents, alertPercent }));
    }
  };

  const setBudgetMode = async (mode: 'categoria' | '50-30-20' | 'base-zero') => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, 'workspaces', activeWorkspaceId);
    setWorkspace(prev => prev ? { ...prev, budgetMode: mode } : { id: activeWorkspaceId, name: 'Workspace', ownerId: currentUser?.uid || '', createdAt: new Date().toISOString(), budgetMode: mode } as Workspace);
    await commitOptimistic(setDoc(ref, { budgetMode: mode }, { merge: true }));
  };

  const deleteBudget = async (id: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const deletedAt = new Date().toISOString();
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, deletedAt } : b));
    const ref = doc(db, `workspaces/${activeWorkspaceId}/budgets`, id);
    await commitOptimistic(updateDoc(ref, { deletedAt }));
  };

  const addGoal = async (goal: Omit<Goal, 'id' | 'savedCents' | 'contributions'>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(collection(db, `workspaces/${activeWorkspaceId}/goals`));
    const newGoal: Goal = { id: ref.id, ...stripUndefined(goal), savedCents: 0, contributions: [] };
    setGoals(prev => [...prev, newGoal]);
    await commitOptimistic(setDoc(ref, stripUndefined({ ...goal, savedCents: 0, contributions: [] })));
  };

  const updateGoal = async (id: string, data: Partial<Goal>) => {
    if (!activeWorkspaceId || !canEdit) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/goals`, id);
    const cleanGoal = stripUndefined(data);
    setGoals(prev => prev.map(g => (g.id === id ? { ...g, ...cleanGoal } : g)));
    await commitOptimistic(updateDoc(ref, cleanGoal));
  };

  const addGoalContribution = async (goalId: string, amountCents: number, note?: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const target = goals.find(g => g.id === goalId);
    if (!target) return;

    const newContrib = {
      id: `contrib_${Date.now()}`,
      date: todayString(),
      amountCents,
      note: note || '',
    };

    const newContributions = [...(target.contributions || []), newContrib];
    const newSaved = (target.savedCents || 0) + amountCents;

    setGoals(prev =>
      prev.map(g => (g.id === goalId ? { ...g, savedCents: newSaved, contributions: newContributions } : g))
    );

    const ref = doc(db, `workspaces/${activeWorkspaceId}/goals`, goalId);
    await commitOptimistic(
      updateDoc(ref, {
        savedCents: newSaved,
        contributions: newContributions,
      })
    );
  };

  const deleteGoal = async (id: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const deletedAt = new Date().toISOString();
    setGoals(prev => prev.map(g => g.id === id ? { ...g, deletedAt } : g));
    const ref = doc(db, `workspaces/${activeWorkspaceId}/goals`, id);
    await commitOptimistic(updateDoc(ref, { deletedAt }));
  };

  const clearAllWorkspaceData = async () => {
    if (!activeWorkspaceId || !canEdit) return;
    const deletedAt = new Date().toISOString();

    setAccounts(prev => prev.map(a => ({ ...a, deletedAt })));
    setCategories(prev => prev.map(c => ({ ...c, deletedAt })));
    setTransactions(prev => prev.map(t => ({ ...t, deletedAt })));
    setBudgets(prev => prev.map(b => ({ ...b, deletedAt })));
    setGoals(prev => prev.map(g => ({ ...g, deletedAt })));

    const batch = writeBatch(db);
    accounts.forEach(a => batch.update(doc(db, `workspaces/${activeWorkspaceId}/accounts`, a.id), { deletedAt }));
    categories.forEach(c => batch.update(doc(db, `workspaces/${activeWorkspaceId}/categories`, c.id), { deletedAt }));
    transactions.forEach(t => batch.update(doc(db, `workspaces/${activeWorkspaceId}/transactions`, t.id), { deletedAt }));
    budgets.forEach(b => batch.update(doc(db, `workspaces/${activeWorkspaceId}/budgets`, b.id), { deletedAt }));
    goals.forEach(g => batch.update(doc(db, `workspaces/${activeWorkspaceId}/goals`, g.id), { deletedAt }));

    await commitOptimistic(batch.commit());
  };

  const restoreTrashItem = async (type: 'account' | 'category' | 'transaction' | 'budget' | 'goal', id: string) => {
    if (!activeWorkspaceId || !canEdit) return;
    const deletedAt = null;

    if (type === 'account') {
      setAccounts(prev => prev.map(a => a.id === id ? { ...a, deletedAt } : a));
      await commitOptimistic(updateDoc(doc(db, `workspaces/${activeWorkspaceId}/accounts`, id), { deletedAt }));
    } else if (type === 'category') {
      setCategories(prev => prev.map(c => c.id === id ? { ...c, deletedAt } : c));
      await commitOptimistic(updateDoc(doc(db, `workspaces/${activeWorkspaceId}/categories`, id), { deletedAt }));
    } else if (type === 'transaction') {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, deletedAt } : t));
      await commitOptimistic(updateDoc(doc(db, `workspaces/${activeWorkspaceId}/transactions`, id), { deletedAt }));
    } else if (type === 'budget') {
      setBudgets(prev => prev.map(b => b.id === id ? { ...b, deletedAt } : b));
      await commitOptimistic(updateDoc(doc(db, `workspaces/${activeWorkspaceId}/budgets`, id), { deletedAt }));
    } else if (type === 'goal') {
      setGoals(prev => prev.map(g => g.id === id ? { ...g, deletedAt } : g));
      await commitOptimistic(updateDoc(doc(db, `workspaces/${activeWorkspaceId}/goals`, id), { deletedAt }));
    }
  };

  const createInvite = async (role: 'editor' | 'viewer'): Promise<string> => {
    if (!currentUser || !activeWorkspaceId) {
      throw new Error('Usuário não autenticado.');
    }

    const code = `inv_${Math.random().toString(36).substring(2, 12)}_${Math.random().toString(36).substring(2, 12)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const inviteRef = doc(db, 'invites', code);
    const inviteData: Invite = {
      code,
      workspaceId: activeWorkspaceId,
      workspaceName: workspace?.name || 'Meu Bolso',
      role,
      createdBy: currentUser.uid,
      expiresAt,
    };

    await commitOptimistic(setDoc(inviteRef, inviteData));
    return code;
  };

  const joinWorkspaceByInvite = async (inviteCode: string): Promise<{ success: boolean; message: string }> => {
    if (!currentUser || !userProfile) {
      return { success: false, message: 'Você precisa estar autenticado para aceitar um convite.' };
    }

    const cleanCode = inviteCode.trim();
    const inviteRef = doc(db, 'invites', cleanCode);
    const snap = await getDoc(inviteRef);

    if (!snap.exists()) {
      return { success: false, message: 'Código de convite inválido ou expirado.' };
    }

    const invite = snap.data() as Invite;
    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return { success: false, message: 'Este convite expirou.' };
    }

    const memberRef = doc(db, `workspaces/${invite.workspaceId}/members`, currentUser.uid);
    await commitOptimistic(
      setDoc(memberRef, {
        uid: currentUser.uid,
        role: invite.role,
        name: userProfile.name || currentUser.displayName || 'Membro Convidado',
        email: currentUser.email || '',
        joinedAt: new Date().toISOString(),
        inviteCode: cleanCode,
      })
    );

    const newWsIds = Array.from(new Set([...(userProfile.workspaceIds || []), invite.workspaceId]));
    await updateUserProfileData({
      workspaceIds: newWsIds,
      activeWorkspaceId: invite.workspaceId,
    });

    await switchActiveWorkspace(invite.workspaceId);
    return { success: true, message: `Você entrou no workspace "${invite.workspaceName}" com sucesso!` };
  };

  const updateMemberRole = async (memberUid: string, role: 'editor' | 'viewer') => {
    if (!activeWorkspaceId || !isOwner) return;
    setMembers(prev => prev.map(m => (m.uid === memberUid ? { ...m, role } : m)));
    const ref = doc(db, `workspaces/${activeWorkspaceId}/members`, memberUid);
    await commitOptimistic(updateDoc(ref, { role }));
  };

  const removeMember = async (memberUid: string) => {
    if (!activeWorkspaceId || !isOwner) return;
    setMembers(prev => prev.filter(m => m.uid !== memberUid));
    const ref = doc(db, `workspaces/${activeWorkspaceId}/members`, memberUid);
    await commitOptimistic(deleteDoc(ref));
  };

  const leaveWorkspace = async () => {
    if (!currentUser || !activeWorkspaceId) return;
    const ref = doc(db, `workspaces/${activeWorkspaceId}/members`, currentUser.uid);
    await commitOptimistic(deleteDoc(ref));
    const remaining = (userProfile?.workspaceIds || []).filter(w => w !== activeWorkspaceId);
    if (remaining.length > 0) {
      await updateUserProfileData({
        workspaceIds: remaining,
        activeWorkspaceId: remaining[0],
      });
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        activeWorkspaceId,
        workspace,
        members,
        accounts: activeAccounts,
        categories: activeCategories,
        transactions: activeTransactions,
        recurrences,
        budgets: activeBudgets,
        goals: activeGoals,
        trashItems,
        loading,
        userRole,
        canEdit,
        isOwner,
        isOfflineMode,
        lastSyncTime,
        pendingOfflineCount,
        createWorkspace,
        updateWorkspaceName,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        markAsPaid,
        payCreditCardInvoice,
        addAccount,
        updateAccount,
        archiveAccount,
        deleteAccount,
        addCategory,
        updateCategory,
        deleteCategory,
        restoreDefaultCategories,
        setBudgetLimit,
        setBudgetMode,
        deleteBudget,
        addGoal,
        updateGoal,
        addGoalContribution,
        deleteGoal,
        clearAllWorkspaceData,
        restoreTrashItem,
        createInvite,
        joinWorkspaceByInvite,
        updateMemberRole,
        removeMember,
        leaveWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}