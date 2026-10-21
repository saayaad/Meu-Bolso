import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Plus,
  Minus,
  Briefcase,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  WifiOff,
  FolderPlus,
  Settings,
  X,
  PiggyBank,
  Target,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { formatMoney } from '../../lib/money';
import {
  todayString,
  currentMonthYearString,
  isPastDue,
  isDueToday,
  isDueInDays,
  isSameMonth,
  formatDisplayDate,
} from '../../lib/dates';
import { APP_NAME } from '../../lib/constants';
import { PWAInstallButton } from '../ui/PWAInstallButton';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface HeaderProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer') => void;
  onNavigateTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenTransactionModal, onNavigateTab }) => {
  const { userProfile, switchActiveWorkspace } = useAuth();
  const {
    workspace,
    transactions,
    budgets,
    goals,
    categories,
    canEdit,
    isOfflineMode,
    createWorkspace,
  } = useWorkspace();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showNewWsModal, setShowNewWsModal] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [workspaceNames, setWorkspaceNames] = useState<Record<string, string>>({});

  const notifRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (wsRef.current && !wsRef.current.contains(e.target as Node)) {
        setShowWorkspaceMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const today = todayString();
  const currentMonth = currentMonthYearString();
  const overdueItems = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && isPastDue(t.dueDate, today)
  );
  const todayItems = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && isDueToday(t.dueDate, today)
  );
  const soonDays = userProfile?.notificationSettings?.daysBefore || 3;
  const soonItems = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && isDueInDays(t.dueDate, soonDays, today)
  );

  const budgetAlerts = budgets
    .map(b => {
      const spent = transactions
        .filter(
          t =>
            t.type === 'expense' &&
            t.categoryId === b.categoryId &&
            isSameMonth(t.date, currentMonth)
        )
        .reduce((acc, t) => acc + t.amountCents, 0);
      const pct = b.limitCents > 0 ? Math.round((spent / b.limitCents) * 100) : 0;
      const catName = categories.find(c => c.id === b.categoryId)?.name || 'Categoria';
      return {
        ...b,
        spent,
        pct,
        catName,
        isExceeded: spent >= b.limitCents,
        isWarning: pct >= b.alertPercent && spent < b.limitCents,
      };
    })
    .filter(b => b.isExceeded || b.isWarning);

  const goalAlerts = goals.filter(
    g => g.targetCents > 0 && (g.savedCents >= g.targetCents || isDueInDays(g.deadline, 7, today))
  );

  const totalAlertsCount =
    overdueItems.length +
    todayItems.length +
    soonItems.length +
    budgetAlerts.length +
    goalAlerts.length;

  useEffect(() => {
    if (
      !userProfile?.notificationSettings?.browserNotifications ||
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return;
    }

    const notifiedKey = `meu_bolso_notified_${today}`;
    if (!sessionStorage.getItem(notifiedKey) && (overdueItems.length > 0 || todayItems.length > 0)) {
      sessionStorage.setItem(notifiedKey, 'true');
      try {
        new Notification(`${APP_NAME} - Alerta de Vencimentos`, {
          body: `Você possui ${overdueItems.length} conta(s) vencida(s) e ${todayItems.length} vencendo hoje.`,
          icon: '/favicon.svg',
        });
      } catch {}
    }

    if (userProfile?.notificationSettings?.dailyReminder) {
      const reminderKey = `meu_bolso_daily_reminder_${today}`;
      if (!sessionStorage.getItem(reminderKey)) {
        sessionStorage.setItem(reminderKey, 'true');
        try {
          new Notification(APP_NAME, {
            body: 'Já registrou seus gastos de hoje?',
            icon: '/favicon.svg',
          });
        } catch {}
      }
    }
  }, [
    userProfile?.notificationSettings?.browserNotifications,
    userProfile?.notificationSettings?.dailyReminder,
    overdueItems.length,
    todayItems.length,
    today,
  ]);

  const workspaceList = (userProfile?.workspaceIds || [workspace?.id]).filter(
    (wid): wid is string => Boolean(wid)
  );

  useEffect(() => {
    let active = true;
    const fetchNames = async () => {
      const names: Record<string, string> = {};
      for (const wid of workspaceList) {
        if (wid === workspace?.id && workspace?.name) {
          names[wid] = workspace.name;
          continue;
        }
        try {
          const snap = await getDoc(doc(db, 'workspaces', wid));
          if (snap.exists() && snap.data().name) {
            names[wid] = snap.data().name;
          } else {
            names[wid] = (wid === workspace?.id && workspace?.name) ? workspace.name : 'Workspace';
          }
        } catch {
          names[wid] = (wid === workspace?.id && workspace?.name) ? workspace.name : 'Workspace';
        }
      }
      if (active) {
        setWorkspaceNames(names);
      }
    };
    fetchNames();
    return () => {
      active = false;
    };
  }, [workspaceList, workspace?.id, workspace?.name]);

  const handleCreateNewWs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    try {
      await createWorkspace(newWsName.trim());
      setNewWsName('');
      setShowNewWsModal(false);
      setShowWorkspaceMenu(false);
    } catch (err) {
      console.error('Erro ao criar workspace:', err);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 py-3 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-color)] transition-colors duration-200">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D97757] flex items-center justify-center text-[#0A0A0A] font-bold text-sm shadow-sm">
              MB
            </div>
            <span className="font-bold text-lg text-[var(--text-primary)] tracking-tight hidden sm:inline">
              {APP_NAME}
            </span>
          </div>

          <div className="relative" ref={wsRef}>
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm font-medium text-[var(--text-primary)] transition-colors"
            >
              <Briefcase className="w-3.5 h-3.5 text-[#D97757]" />
              <span className="max-w-[130px] truncate">{workspace?.name || 'Workspace'}</span>
              <ChevronDown className="w-3 h-3 text-[var(--text-secondary)]" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute left-0 mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-2 z-50 text-[var(--text-primary)] space-y-1">
                <div className="px-3 py-1.5 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center justify-between">
                  <span>Seus Workspaces</span>
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(false);
                      onNavigateTab('sharing');
                    }}
                    className="text-[10px] text-[#D97757] hover:underline"
                    title="Gerenciar todos"
                  >
                    Gerenciar
                  </button>
                </div>

                <div className="space-y-0.5 max-h-48 overflow-y-auto">
                  {workspaceList.map(wid => {
                    const isActive = wid === workspace?.id;
                    const displayName =
                      (wid === workspace?.id && workspace?.name)
                        ? workspace.name
                        : workspaceNames[wid] || (wid === workspace?.id ? workspace?.name : null) || 'Workspace';
                    return (
                      <button
                        key={wid}
                        onClick={() => {
                          switchActiveWorkspace(wid);
                          setShowWorkspaceMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs rounded-xl transition-colors flex items-center justify-between ${
                          isActive
                            ? 'bg-[#D97757]/15 text-[#D97757] font-semibold'
                            : 'hover:bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="truncate">{displayName}</span>
                        {isActive && <span className="text-[10px] font-bold">Ativo</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[var(--border-color)] space-y-1">
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(false);
                      setShowNewWsModal(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#D97757] hover:bg-[#D97757]/10 rounded-xl transition-colors"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>+ Criar Novo Workspace</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowWorkspaceMenu(false);
                      onNavigateTab('sharing');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] rounded-xl transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Gerenciar e Convidar Membros</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {isOfflineMode && (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FBBF24]/15 border border-[#FBBF24]/30 rounded-xl text-xs font-semibold text-[#FBBF24] cursor-default animate-pulse">
              <WifiOff className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Offline</span>
            </div>
          )}

          <PWAInstallButton />

          {canEdit && (
            <>
              <button
                onClick={() => onOpenTransactionModal('income')}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#4ADE80]/15 hover:bg-[#4ADE80]/25 text-[#4ADE80] border border-[#4ADE80]/30 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Entrada</span>
              </button>

              <button
                onClick={() => onOpenTransactionModal('expense')}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/30 rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 shadow-sm"
              >
                <Minus className="w-4 h-4" />
                <span className="hidden sm:inline">Saída</span>
              </button>
            </>
          )}

          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] rounded-xl text-[var(--text-primary)] transition-colors"
              aria-label="Abrir central de avisos"
            >
              <Bell className="w-4 h-4 text-[var(--text-secondary)]" />
              {totalAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D97757] text-[#0A0A0A] font-bold text-[10px] rounded-full flex items-center justify-center animate-pulse">
                  {totalAlertsCount > 9 ? '9+' : totalAlertsCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl shadow-2xl p-4 z-50 text-[var(--text-primary)]">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#D97757]" />
                    <h4 className="font-semibold text-sm">Central de Avisos</h4>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{totalAlertsCount} alertas</span>
                </div>
                <div className="mt-3 space-y-2 max-h-80 overflow-y-auto pr-1">
                  {totalAlertsCount === 0 ? (
                    <div className="py-8 text-center text-xs text-[var(--text-secondary)] flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-[#4ADE80]" />
                      <p>Tudo em dia! Nenhum alerta pendente no momento.</p>
                    </div>
                  ) : (
                    <>
                      {overdueItems.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-[#F87171]/10 border border-[#F87171]/20 rounded-xl flex items-start gap-2.5"
                        >
                          <AlertTriangle className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#F87171] truncate">{item.description}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Venceu em {formatDisplayDate(item.dueDate || '')}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-[#F87171] tabular-nums shrink-0">
                            {formatMoney(item.amountCents)}
                          </span>
                        </div>
                      ))}
                      {todayItems.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-xl flex items-start gap-2.5"
                        >
                          <Clock className="w-4 h-4 text-[#FBBF24] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#FBBF24] truncate">{item.description}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Vence hoje ({formatDisplayDate(item.dueDate || '')})
                            </p>
                          </div>
                          <span className="text-xs font-bold text-[#FBBF24] tabular-nums shrink-0">
                            {formatMoney(item.amountCents)}
                          </span>
                        </div>
                      ))}
                      {soonItems.map(item => (
                        <div
                          key={item.id}
                          className="p-2.5 bg-[#D97757]/10 border border-[#D97757]/20 rounded-xl flex items-center gap-2.5"
                        >
                          <Clock className="w-4 h-4 text-[#D97757] shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-[#D97757] truncate">{item.description}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              Vence em {formatDisplayDate(item.dueDate || '')}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-[#D97757] tabular-nums shrink-0">
                            {formatMoney(item.amountCents)}
                          </span>
                        </div>
                      ))}
                      {budgetAlerts.map(b => (
                        <div
                          key={`bud-${b.id}`}
                          className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                            b.isExceeded
                              ? 'bg-[#F87171]/10 border-[#F87171]/20'
                              : 'bg-[#FBBF24]/10 border-[#FBBF24]/20'
                          }`}
                        >
                          <PiggyBank
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              b.isExceeded ? 'text-[#F87171]' : 'text-[#FBBF24]'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-xs font-semibold truncate ${
                                b.isExceeded ? 'text-[#F87171]' : 'text-[#FBBF24]'
                              }`}
                            >
                              Orçamento: {b.catName} ({b.pct}%)
                            </p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {formatMoney(b.spent)} de {formatMoney(b.limitCents)}
                            </p>
                          </div>
                        </div>
                      ))}
                      {goalAlerts.map(g => {
                        const completed = g.savedCents >= g.targetCents;
                        return (
                          <div
                            key={`goal-${g.id}`}
                            className="p-2.5 bg-[#4ADE80]/10 border border-[#4ADE80]/20 rounded-xl flex items-start gap-2.5"
                          >
                            <Target className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#4ADE80] truncate">
                                Meta: {g.name}
                              </p>
                              <p className="text-[11px] text-[var(--text-secondary)]">
                                {completed
                                  ? 'Meta concluída com sucesso!'
                                  : `Prazo próximo: ${formatDisplayDate(g.deadline)}`}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showNewWsModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleCreateNewWs}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-[var(--text-primary)]"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-base">Criar Novo Workspace</h3>
              <button
                type="button"
                onClick={() => setShowNewWsModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Nome do Workspace *
              </label>
              <input
                type="text"
                placeholder="Ex: Trabalho, Empresa, Família..."
                value={newWsName}
                onChange={e => setNewWsName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                autoFocus
                required
              />
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNewWsModal(false)}
                className="px-4 py-2 bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#D97757] text-xs font-bold text-[#0A0A0A] rounded-xl"
              >
                Criar Workspace
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};