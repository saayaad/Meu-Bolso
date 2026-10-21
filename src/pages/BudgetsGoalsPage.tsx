import React, { useState, useMemo, useEffect } from 'react';
import {
  Target,
  PiggyBank,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import * as confettiModule from 'canvas-confetti';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { BudgetMode, Budget, Goal } from '../types';
import { formatMoney } from '../lib/money';
import {
  currentMonthYearString,
  todayString,
  formatDisplayDate,
  isSameMonth,
} from '../lib/dates';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { calculateFinancialSummary } from '../lib/balances';

const fireConfetti =
  (confettiModule as unknown as { default?: typeof confettiModule }).default ||
  (confettiModule as unknown as (opts?: Record<string, unknown>) => void);

export const BudgetsGoalsPage: React.FC = () => {
  const {
    workspace,
    categories,
    transactions,
    accounts,
    budgets,
    goals,
    canEdit,
    setBudgetLimit,
    setBudgetMode,
    deleteBudget,
    addGoal,
    updateGoal,
    addGoalContribution,
    deleteGoal,
  } = useWorkspace();

  const [activeSection, setActiveSection] = useState<'budgets' | 'goals'>('budgets');
  const [currentMonth] = useState<string>(currentMonthYearString());
  const [localBudgetMode, setLocalBudgetMode] = useState<BudgetMode>(workspace?.budgetMode || 'categoria');

  // Sync mode with context
  useEffect(() => {
    if (workspace?.budgetMode) {
      setLocalBudgetMode(workspace.budgetMode);
    }
  }, [workspace?.budgetMode]);

  const handleSetBudgetMode = (mode: BudgetMode) => {
    setLocalBudgetMode(mode);
    if (canEdit) {
      setBudgetMode(mode);
    }
  };

  // Budget Modal
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [selectedBudgetCatId, setSelectedBudgetCatId] = useState<string>('');
  const [budgetLimitCents, setBudgetLimitCents] = useState<number>(50000);
  const [alertPercent, setAlertPercent] = useState<number>(80);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);

  // Goal Modal
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState<string>('');
  const [goalTargetCents, setGoalTargetCents] = useState<number>(500000);
  const [goalDeadline, setGoalDeadline] = useState<string>('');
  const [goalAccountId, setGoalAccountId] = useState<string>('');
  const [goalToDelete, setGoalToDelete] = useState<Goal | null>(null);

  // Contribution Modal
  const [contributingGoal, setContributingGoal] = useState<Goal | null>(null);
  const [contributionCents, setContributionCents] = useState<number>(10000);
  const [contributionNote, setContributionNote] = useState<string>('');

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const currentSummary = useMemo(() => calculateFinancialSummary(currentMonth, accounts, transactions), [currentMonth, accounts, transactions]);

  const monthExpenses = useMemo(
    () => transactions.filter(t => t.type === 'expense' && isSameMonth(t.date, currentMonth)),
    [transactions, currentMonth]
  );

  // 50/30/20 Calculations
  const bucketTotals = useMemo(() => {
    let necessidades = 0;
    let desejos = 0;
    let poupanca = 0;

    monthExpenses.forEach(t => {
      const cat = categoryMap.get(t.categoryId || '');
      const b = cat?.bucket || 'desejos';
      if (b === 'necessidades') necessidades += t.amountCents;
      else if (b === 'desejos') desejos += t.amountCents;
      else if (b === 'poupanca') poupanca += t.amountCents;
    });

    const income = currentSummary.totalIncomeCents;
    const targetNec = Math.round(income * 0.5);
    const targetDes = Math.round(income * 0.3);
    const targetPou = Math.round(income * 0.2);

    return {
      necessidades,
      desejos,
      poupanca,
      targetNec,
      targetDes,
      targetPou,
    };
  }, [monthExpenses, categoryMap, currentSummary.totalIncomeCents]);

  // Zero-based budgeting calculations
  const zeroBasedAllocation = useMemo(() => {
    const totalAllocated = budgets.reduce((acc, b) => acc + b.limitCents, 0);
    const totalIncome = currentSummary.totalIncomeCents;
    const unallocated = totalIncome - totalAllocated;
    return {
      totalAllocated,
      totalIncome,
      unallocated,
    };
  }, [budgets, currentSummary.totalIncomeCents]);

  const handleOpenBudgetModal = (categoryId?: string, currentLimit?: number, currentAlert?: number) => {
    const expenseCats = categories.filter(c => c.type === 'expense');
    setSelectedBudgetCatId(categoryId || (expenseCats[0]?.id || ''));
    setBudgetLimitCents(currentLimit || 50000);
    setAlertPercent(currentAlert || 80);
    setShowBudgetModal(true);
  };

  const handleSaveBudget = async () => {
    if (!selectedBudgetCatId || budgetLimitCents <= 0) return;
    await setBudgetLimit(selectedBudgetCatId, budgetLimitCents, alertPercent);
    setShowBudgetModal(false);
  };

  const handleOpenGoalModal = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalName(goal.name);
      setGoalTargetCents(goal.targetCents);
      setGoalDeadline(goal.deadline);
      setGoalAccountId(goal.accountId || '');
    } else {
      setEditingGoal(null);
      setGoalName('');
      setGoalTargetCents(500000);
      setGoalDeadline(todayString());
      setGoalAccountId('');
    }
    setShowGoalModal(true);
  };

  const handleSaveGoal = async () => {
    if (!goalName.trim() || goalTargetCents <= 0 || !goalDeadline) return;

    if (editingGoal) {
      await updateGoal(editingGoal.id, {
        name: goalName.trim(),
        targetCents: goalTargetCents,
        deadline: goalDeadline,
        accountId: goalAccountId || null,
      });
    } else {
      await addGoal({
        name: goalName.trim(),
        targetCents: goalTargetCents,
        deadline: goalDeadline,
        accountId: goalAccountId || null,
      });
    }
    setShowGoalModal(false);
  };

  const handleMakeContribution = async () => {
    if (!contributingGoal || contributionCents <= 0) return;

    await addGoalContribution(contributingGoal.id, contributionCents, contributionNote);

    if (contributingGoal.savedCents + contributionCents >= contributingGoal.targetCents) {
      try {
        if (typeof fireConfetti === 'function') {
          fireConfetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        }
      } catch {}
    }

    setContributingGoal(null);
    setContributionCents(10000);
    setContributionNote('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">Orçamentos e Metas de Economia</h2>
          <p className="text-xs text-[#A3A3A3]">
            Planejamento inteligente, limites mensais e sonhos financeiros
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            {activeSection === 'budgets' ? (
              <button
                onClick={() => handleOpenBudgetModal()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Novo Teto de Categoria</span>
              </button>
            ) : (
              <button
                onClick={() => handleOpenGoalModal()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#4ADE80] hover:bg-[#22C55E] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Meta de Economia</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Section Switcher */}
      <div className="flex gap-2 p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-2xl w-full sm:w-80">
        <button
          onClick={() => setActiveSection('budgets')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeSection === 'budgets'
              ? 'bg-[#D97757] text-[#0A0A0A] shadow-sm'
              : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Orçamentos Mensais
        </button>
        <button
          onClick={() => setActiveSection('goals')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeSection === 'goals'
              ? 'bg-[#4ADE80] text-[#0A0A0A] shadow-sm'
              : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Metas de Economia
        </button>
      </div>

      {/* SECTION: BUDGETS */}
      {activeSection === 'budgets' && (
        <div className="space-y-6">
          {/* Budget Mode Selector */}
          <div className="p-4 sm:p-5 bg-[#141414] border border-[#2B2B2B] rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-[#F5F5F5]">Modo de Orçamento</h4>
              <p className="text-xs text-[#A3A3A3]">Escolha a metodologia financeira que melhor se adapta à sua rotina</p>
            </div>

            <div className="flex flex-wrap gap-1.5 bg-[#1C1C1C] p-1 rounded-xl border border-[#2B2B2B]">
              <button
                onClick={() => handleSetBudgetMode('categoria')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  localBudgetMode === 'categoria' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                }`}
              >
                Por Categoria
              </button>
              <button
                onClick={() => handleSetBudgetMode('50-30-20')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  localBudgetMode === '50-30-20' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                }`}
              >
                Regra 50/30/20
              </button>
              <button
                onClick={() => handleSetBudgetMode('base-zero')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  localBudgetMode === 'base-zero' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                }`}
              >
                Base Zero
              </button>
            </div>
          </div>

          {/* 1. MODO: 50-30-20 */}
          {localBudgetMode === '50-30-20' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Necessidades (50%) */}
              <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#F97316]">Necessidades (50%)</span>
                  <span className="text-xs text-[#A3A3A3]">Alvo: {formatMoney(bucketTotals.targetNec)}</span>
                </div>
                <p className="text-lg font-bold text-[#F5F5F5] tabular-nums">{formatMoney(bucketTotals.necessidades)}</p>
                <div className="w-full h-3 bg-[#1C1C1C] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      bucketTotals.targetNec > 0 && bucketTotals.necessidades > bucketTotals.targetNec
                        ? 'bg-[#EF4444]'
                        : 'bg-[#F97316]'
                    }`}
                    style={{
                      width: `${bucketTotals.targetNec > 0 ? Math.min(100, (bucketTotals.necessidades / bucketTotals.targetNec) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#A3A3A3]">
                  Aluguel, contas essenciais, supermercado e transporte básico.
                </p>
              </div>

              {/* Desejos (30%) */}
              <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#A855F7]">Desejos e Lazer (30%)</span>
                  <span className="text-xs text-[#A3A3A3]">Alvo: {formatMoney(bucketTotals.targetDes)}</span>
                </div>
                <p className="text-lg font-bold text-[#F5F5F5] tabular-nums">{formatMoney(bucketTotals.desejos)}</p>
                <div className="w-full h-3 bg-[#1C1C1C] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      bucketTotals.targetDes > 0 && bucketTotals.desejos > bucketTotals.targetDes
                        ? 'bg-[#EF4444]'
                        : 'bg-[#A855F7]'
                    }`}
                    style={{
                      width: `${bucketTotals.targetDes > 0 ? Math.min(100, (bucketTotals.desejos / bucketTotals.targetDes) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#A3A3A3]">
                  Restaurantes, compras pessoais, passeios e assinaturas.
                </p>
              </div>

              {/* Poupança (20%) */}
              <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#4ADE80]">Poupança & Dívidas (20%)</span>
                  <span className="text-xs text-[#A3A3A3]">Alvo: {formatMoney(bucketTotals.targetPou)}</span>
                </div>
                <p className="text-lg font-bold text-[#F5F5F5] tabular-nums">{formatMoney(bucketTotals.poupanca)}</p>
                <div className="w-full h-3 bg-[#1C1C1C] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#4ADE80] transition-all"
                    style={{
                      width: `${bucketTotals.targetPou > 0 ? Math.min(100, (bucketTotals.poupanca / bucketTotals.targetPou) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#A3A3A3]">
                  Reserva de emergência, amortização de dívidas e investimentos futuros.
                </p>
              </div>
            </div>
          )}

          {/* 2. MODO: BASE ZERO */}
          {localBudgetMode === 'base-zero' && (
            <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#2B2B2B]">
                <div>
                  <h4 className="font-bold text-sm text-[#F5F5F5]">Metodologia Base Zero</h4>
                  <p className="text-xs text-[#A3A3A3]">Cada real da sua renda mensal deve ter um destino específico.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#A3A3A3]">Valor não alocado:</span>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      zeroBasedAllocation.unallocated === 0
                        ? 'text-[#4ADE80]'
                        : zeroBasedAllocation.unallocated > 0
                        ? 'text-[#FBBF24]'
                        : 'text-[#F87171]'
                    }`}
                  >
                    {formatMoney(zeroBasedAllocation.unallocated)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#A3A3A3]">
                Total da renda do mês: <strong className="text-[#F5F5F5]">{formatMoney(zeroBasedAllocation.totalIncome)}</strong> | Total distribuído nos tetos: <strong className="text-[#D97757]">{formatMoney(zeroBasedAllocation.totalAllocated)}</strong>
              </p>
            </div>
          )}

          {/* LISTA DE TETOS DE CATEGORIAS (Presente em todos os modos) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[#A3A3A3] uppercase tracking-wider">
              Tetos por Categoria
            </h4>

            {budgets.length === 0 ? (
              <div className="p-12 text-center bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-2">
                <PiggyBank className="w-8 h-8 text-[#D97757] mx-auto" />
                <p className="font-semibold text-sm text-[#F5F5F5]">Nenhum teto orçamentário definido</p>
                <p className="text-xs text-[#A3A3A3]">Defina limites para suas categorias para receber alertas inteligentes.</p>
                {canEdit && (
                  <button
                    onClick={() => handleOpenBudgetModal()}
                    className="mt-2 px-4 py-2 bg-[#D97757] text-[#0A0A0A] font-bold text-xs rounded-xl"
                  >
                    Adicionar Teto
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgets.map(b => {
                  const cat = categoryMap.get(b.categoryId);
                  const spent = monthExpenses
                    .filter(t => t.categoryId === b.categoryId)
                    .reduce((sum, t) => sum + t.amountCents, 0);
                  const remaining = b.limitCents - spent;
                  const pct = b.limitCents > 0 ? (spent / b.limitCents) * 100 : 0;
                  const isOver = spent > b.limitCents;
                  const isWarning = pct >= b.alertPercent && !isOver;

                  return (
                    <div
                      key={b.id}
                      className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3 animate-in fade-in"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.color || '#D97757' }} />
                          <h5 className="font-bold text-sm text-[#F5F5F5]">{cat?.name || 'Categoria'}</h5>
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenBudgetModal(b.categoryId, b.limitCents, b.alertPercent)}
                              className="p-1.5 text-[#A3A3A3] hover:text-[#F5F5F5] rounded-lg"
                              title="Editar Teto"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setBudgetToDelete(b)}
                              className="p-1.5 text-[#A3A3A3] hover:text-[#F87171] rounded-lg"
                              title="Excluir Teto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-baseline text-xs">
                        <div>
                          <span className="text-[#A3A3A3]">Gasto: </span>
                          <span className={`font-bold tabular-nums ${isOver ? 'text-[#F87171]' : 'text-[#F5F5F5]'}`}>
                            {formatMoney(spent)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[#A3A3A3]">Teto: </span>
                          <span className="font-semibold text-[#F5F5F5] tabular-nums">
                            {formatMoney(b.limitCents)}
                          </span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full h-3 bg-[#1C1C1C] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOver ? 'bg-[#F87171]' : isWarning ? 'bg-[#FBBF24]' : 'bg-[#4ADE80]'
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A3A3A3]">
                          {isOver
                            ? `Estourado em ${formatMoney(Math.abs(remaining))}`
                            : `Resta ${formatMoney(remaining)}`}
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            isOver ? 'text-[#F87171]' : isWarning ? 'text-[#FBBF24]' : 'text-[#4ADE80]'
                          }`}
                        >
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION: GOALS */}
      {activeSection === 'goals' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {goals.map(g => {
              const pct = g.targetCents > 0 ? Math.min(100, Math.round((g.savedCents / g.targetCents) * 100)) : 0;
              const isCompleted = g.savedCents >= g.targetCents;
              const remainingCents = Math.max(0, g.targetCents - g.savedCents);

              // Calculate monthly savings needed based on deadline
              const [y, m, d] = g.deadline.split('-').map(Number);
              const targetDate = new Date(y, m - 1, d);
              const now = new Date();
              const monthsLeft = Math.max(1, Math.round((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.5)));
              const monthlyRequired = Math.round(remainingCents / monthsLeft);

              return (
                <div
                  key={g.id}
                  className={`p-5 bg-[#141414] border rounded-3xl space-y-4 flex flex-col justify-between transition-all animate-in fade-in ${
                    isCompleted ? 'border-[#4ADE80]/40' : 'border-[#2B2B2B]'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            isCompleted ? 'bg-[#4ADE80]/20 text-[#4ADE80]' : 'bg-[#D97757]/20 text-[#D97757]'
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-[#F5F5F5]">{g.name}</h4>
                          <p className="text-[11px] text-[#A3A3A3]">Prazo: {formatDisplayDate(g.deadline)}</p>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenGoalModal(g)}
                            className="p-1.5 text-[#A3A3A3] hover:text-[#F5F5F5]"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setGoalToDelete(g)}
                            className="p-1.5 text-[#A3A3A3] hover:text-[#F87171]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#A3A3A3]">Economizado</span>
                        <span className="font-bold text-[#4ADE80] tabular-nums">{formatMoney(g.savedCents)}</span>
                      </div>
                      <div className="w-full h-3 bg-[#1C1C1C] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#4ADE80] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[#A3A3A3] mt-1">
                        <span>{pct}% concluído</span>
                        <span>Alvo: {formatMoney(g.targetCents)}</span>
                      </div>
                    </div>

                    {!isCompleted && (
                      <div className="p-2.5 bg-[#1C1C1C] rounded-xl text-[11px] text-[#A3A3A3]">
                        Guarde <strong className="text-[#D97757]">{formatMoney(monthlyRequired)}/mês</strong> por {monthsLeft} meses para atingir no prazo.
                      </div>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      onClick={() => {
                        setContributingGoal(g);
                        setContributionCents(10000);
                      }}
                      className="w-full py-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-xs font-semibold text-[#4ADE80] border border-[#2B2B2B] rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Adicionar Aporte</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {goals.length === 0 && (
            <div className="p-16 text-center bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
              <Target className="w-10 h-10 text-[#4ADE80] mx-auto" />
              <p className="font-bold text-base text-[#F5F5F5]">Nenhuma meta cadastrada</p>
              <p className="text-xs text-[#A3A3A3]">
                Defina objetivos como Reserva de Emergência, Viagem, Carro Novo ou Casa Própria.
              </p>
              {canEdit && (
                <button
                  onClick={() => handleOpenGoalModal()}
                  className="mt-2 px-5 py-2.5 bg-[#4ADE80] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md"
                >
                  Criar Primeira Meta
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Budget Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <h3 className="font-bold text-base text-[#F5F5F5]">Configurar Teto da Categoria</h3>
              <button onClick={() => setShowBudgetModal(false)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Categoria</label>
                <select
                  value={selectedBudgetCatId}
                  onChange={e => setSelectedBudgetCatId(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                >
                  {categories
                    .filter(c => c.type === 'expense')
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Limite Mensal</label>
                <CurrencyInput valueCents={budgetLimitCents} onChangeCents={setBudgetLimitCents} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Alerta ao atingir (%)
                </label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={alertPercent}
                  onChange={e => setAlertPercent(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowBudgetModal(false)}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBudget}
                className="px-5 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Teto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <h3 className="font-bold text-base text-[#F5F5F5]">
                {editingGoal ? 'Editar Meta' : 'Nova Meta de Economia'}
              </h3>
              <button onClick={() => setShowGoalModal(false)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Nome da Meta *</label>
                <input
                  type="text"
                  placeholder="Ex: Viagem de Férias, Reserva de Emergência..."
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4ADE80]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Valor Alvo *</label>
                <CurrencyInput valueCents={goalTargetCents} onChangeCents={setGoalTargetCents} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Prazo / Data Limite *</label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={e => setGoalDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4ADE80]"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveGoal}
                className="px-5 py-2 bg-[#4ADE80] hover:bg-[#22C55E] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Salvar Meta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Contribution Modal */}
      {contributingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-base text-[#F5F5F5]">Aporte em "{contributingGoal.name}"</h3>
            <p className="text-xs text-[#A3A3A3]">
              Quanto você guardou para esta meta hoje?
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Valor do Aporte</label>
              <CurrencyInput valueCents={contributionCents} onChangeCents={setContributionCents} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Nota (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Sobra do freelance..."
                value={contributionNote}
                onChange={e => setContributionNote(e.target.value)}
                className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#4ADE80]"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setContributingGoal(null)}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleMakeContribution}
                className="px-5 py-2 bg-[#4ADE80] hover:bg-[#22C55E] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Registrar Aporte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Goal Modal */}
      {goalToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Excluir Meta</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Deseja realmente excluir a meta <strong className="text-[var(--text-primary)]">"{goalToDelete.name}"</strong>? Todo o histórico de aportes será perdido.
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setGoalToDelete(null)}
                className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteGoal(goalToDelete.id);
                  setGoalToDelete(null);
                }}
                className="px-5 py-2 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Budget Modal */}
      {budgetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Excluir Teto</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Deseja realmente excluir o teto de gastos para a categoria <strong className="text-[var(--text-primary)]">"{categoryMap.get(budgetToDelete.categoryId)?.name || 'Categoria'}"</strong>?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBudgetToDelete(null)}
                className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteBudget(budgetToDelete.id);
                  setBudgetToDelete(null);
                }}
                className="px-5 py-2 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};