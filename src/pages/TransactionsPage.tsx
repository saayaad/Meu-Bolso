import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  Minus,
  ArrowLeftRight,
  Calendar,
  X,
  WifiOff,
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { Transaction } from '../types';
import { formatMoney } from '../lib/money';
import {
  todayString,
  currentMonthYearString,
  formatDisplayDate,
  getPreviousMonth,
  addDays,
  isPastDue,
} from '../lib/dates';
import { PAYMENT_METHOD_LABELS } from '../lib/constants';

interface TransactionsPageProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer', editTx?: Transaction) => void;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ onOpenTransactionModal }) => {
  const {
    transactions,
    categories,
    accounts,
    members,
    canEdit,
    markAsPaid,
    deleteTransaction,
    isOfflineMode,
    lastSyncTime,
    pendingOfflineCount,
  } = useWorkspace();

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [periodPreset, setPeriodPreset] = useState<string>('this_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all'); // all, paid, pending, overdue
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(50);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const memberMap = useMemo(() => new Map(members.map(m => [m.uid, m.name])), [members]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => t.tags?.forEach(tag => set.add(tag)));
    return Array.from(set);
  }, [transactions]);

  // Date ranges computation
  const { startDate, endDate } = useMemo(() => {
    const today = todayString();
    const curMonth = currentMonthYearString();

    switch (periodPreset) {
      case 'this_month':
        return { startDate: `${curMonth}-01`, endDate: `${curMonth}-31` };
      case 'last_month': {
        const prevMonth = getPreviousMonth(curMonth);
        return { startDate: `${prevMonth}-01`, endDate: `${prevMonth}-31` };
      }
      case '7days':
        return { startDate: addDays(today, -7), endDate: today };
      case '30days':
        return { startDate: addDays(today, -30), endDate: today };
      case '90days':
        return { startDate: addDays(today, -90), endDate: today };
      case 'year': {
        const y = today.split('-')[0];
        return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
      }
      case 'custom':
        return { startDate: customStartDate || '1970-01-01', endDate: customEndDate || '2099-12-31' };
      default:
        return { startDate: '1970-01-01', endDate: '2099-12-31' };
    }
  }, [periodPreset, customStartDate, customEndDate]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    const today = todayString();
    const cleanSearch = searchTerm.trim().toLowerCase();
    const minCents = minAmount ? parseFloat(minAmount.replace(',', '.')) * 100 : 0;
    const maxCents = maxAmount ? parseFloat(maxAmount.replace(',', '.')) * 100 : Infinity;

    return transactions.filter(t => {
      // Date range
      if (t.date < startDate || t.date > endDate) return false;

      // Type filter
      if (selectedType !== 'all' && t.type !== selectedType) return false;

      // Category filter
      if (selectedCategory !== 'all' && t.categoryId !== selectedCategory) return false;

      // Account filter
      if (selectedAccount !== 'all' && t.accountId !== selectedAccount && t.toAccountId !== selectedAccount) return false;

      // Payment method
      if (selectedPaymentMethod !== 'all' && t.paymentMethod !== selectedPaymentMethod) return false;

      // Status filter
      if (selectedStatus === 'paid' && t.status !== 'paid') return false;
      if (selectedStatus === 'pending' && t.status !== 'pending') return false;
      if (selectedStatus === 'overdue' && (t.status !== 'pending' || !isPastDue(t.dueDate, today))) return false;

      // Tag filter
      if (selectedTag !== 'all' && !t.tags?.includes(selectedTag)) return false;

      // Amount range
      if (t.amountCents < minCents || t.amountCents > maxCents) return false;

      // Search term (description, amount, notes, or category)
      if (cleanSearch) {
        const descMatch = t.description.toLowerCase().includes(cleanSearch);
        const notesMatch = (t.notes || '').toLowerCase().includes(cleanSearch);
        const catMatch = (categoryMap.get(t.categoryId || '')?.name || '').toLowerCase().includes(cleanSearch);
        const amountStr = (t.amountCents / 100).toFixed(2);
        const amountMatch = amountStr.includes(cleanSearch) || formatMoney(t.amountCents).toLowerCase().includes(cleanSearch);
        if (!descMatch && !notesMatch && !catMatch && !amountMatch) return false;
      }

      return true;
    });
  }, [
    transactions,
    startDate,
    endDate,
    selectedType,
    selectedCategory,
    selectedAccount,
    selectedPaymentMethod,
    selectedStatus,
    selectedTag,
    minAmount,
    maxAmount,
    searchTerm,
    categoryMap,
  ]);

  // Group filtered transactions by day
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, Transaction[]>();
    const limited = filteredTransactions.slice(0, displayLimit);

    limited.forEach(t => {
      const day = t.date;
      if (!groups.has(day)) {
        groups.set(day, []);
      }
      groups.get(day)!.push(t);
    });

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredTransactions, displayLimit]);

  // Filter summary totals
  const filterTotals = useMemo(() => {
    let incomeCents = 0;
    let expenseCents = 0;
    filteredTransactions.forEach(t => {
      if (t.type === 'income') incomeCents += t.amountCents;
      if (t.type === 'expense') expenseCents += t.amountCents;
    });
    return {
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const resetFilters = () => {
    setSearchTerm('');
    setPeriodPreset('this_month');
    setSelectedType('all');
    setSelectedCategory('all');
    setSelectedAccount('all');
    setSelectedPaymentMethod('all');
    setSelectedStatus('all');
    setSelectedTag('all');
    setMinAmount('');
    setMaxAmount('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Title & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">Lançamentos</h2>
          <p className="text-xs text-[#A3A3A3]">
            Histórico completo de entradas, saídas e transferências
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenTransactionModal('income')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#4ADE80]/15 hover:bg-[#4ADE80]/25 text-[#4ADE80] border border-[#4ADE80]/30 rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Entrada</span>
            </button>
            <button
              onClick={() => onOpenTransactionModal('expense')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/30 rounded-xl text-xs font-semibold"
            >
              <Minus className="w-4 h-4" />
              <span>Saída</span>
            </button>
            <button
              onClick={() => onOpenTransactionModal('transfer')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#D97757]/15 hover:bg-[#D97757]/25 text-[#D97757] border border-[#D97757]/30 rounded-xl text-xs font-semibold"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transferência</span>
            </button>
          </div>
        )}
      </div>

      {/* Offline Cache Notice Banner */}
      {isOfflineMode && (
        <div className="p-3.5 bg-[#1C1C1C] border border-[#FBBF24]/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#FBBF24] shadow-md animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 shrink-0 text-[#FBBF24]" />
            <span>
              <strong>Modo Offline Ativo:</strong> Visualizando transações salvas localmente via Cache API.
              {lastSyncTime ? ` Último cache em ${lastSyncTime}.` : ''}
            </span>
          </div>
          {pendingOfflineCount > 0 ? (
            <span className="text-[11px] font-bold text-[#D97757] bg-[#D97757]/15 px-2.5 py-1 rounded-lg w-fit">
              {pendingOfflineCount} nova(s) pendente(s) de envio
            </span>
          ) : (
            <span className="text-[11px] text-[#A3A3A3] w-fit">
              Novos lançamentos serão sincronizados automaticamente
            </span>
          )}
        </div>
      )}

      {/* Search & Quick Filters Bar */}
      <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              type="text"
              placeholder="Buscar por descrição, valor ou observação..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs sm:text-sm text-[#F5F5F5] placeholder-[#666] focus:outline-none focus:border-[#D97757]"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] hover:text-[#F5F5F5]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Period Presets */}
          <select
            value={periodPreset}
            onChange={e => setPeriodPreset(e.target.value)}
            className="px-3.5 py-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
          >
            <option value="this_month">Este Mês</option>
            <option value="last_month">Mês Passado</option>
            <option value="7days">Últimos 7 dias</option>
            <option value="30days">Últimos 30 dias</option>
            <option value="90days">Últimos 90 dias</option>
            <option value="year">Este Ano</option>
            <option value="all">Todo o período</option>
            <option value="custom">Personalizado...</option>
          </select>

          {/* Toggle Full Filters Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              showFilters
                ? 'bg-[#D97757] text-[#0A0A0A] border-[#D97757]'
                : 'bg-[#1C1C1C] text-[#F5F5F5] border-[#2B2B2B] hover:bg-[#2B2B2B]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtros</span>
          </button>
        </div>

        {/* Custom date range if selected */}
        {periodPreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#2B2B2B]">
            <span className="text-xs text-[#A3A3A3]">De:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
            />
            <span className="text-xs text-[#A3A3A3]">Até:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
            />
          </div>
        )}

        {/* Collapsible Detailed Filters */}
        {showFilters && (
          <div className="pt-3 border-t border-[#2B2B2B] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 animate-in fade-in">
            {/* Type */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Tipo</label>
              <select
                value={selectedType}
                onChange={e => setSelectedType(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todos os tipos</option>
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
                <option value="transfer">Transferência</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Categoria</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todas as categorias</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Account */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Conta / Carteira</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todas as contas</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Forma de Pagamento</label>
              <select
                value={selectedPaymentMethod}
                onChange={e => setSelectedPaymentMethod(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todas</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Situação</label>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todas as situações</option>
                <option value="paid">Pagas / Recebidas</option>
                <option value="pending">Pendentes</option>
                <option value="overdue">Vencidas</option>
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Tag</label>
              <select
                value={selectedTag}
                onChange={e => setSelectedTag(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
              >
                <option value="all">Todas as tags</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>#{tag}</option>
                ))}
              </select>
            </div>

            {/* Min Amount */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Valor Mín. (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={minAmount}
                onChange={e => setMinAmount(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            {/* Max Amount */}
            <div>
              <label className="block text-[10px] text-[#A3A3A3] mb-1">Valor Máx. (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Sem limite"
                value={maxAmount}
                onChange={e => setMaxAmount(e.target.value)}
                className="w-full px-2 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            {/* Reset Filters button */}
            <div className="col-span-full pt-1 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-xs text-[#D97757] hover:underline"
              >
                Limpar todos os filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Summary Banner */}
      <div className="flex flex-wrap items-center justify-between p-3.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#A3A3A3]">Total do filtro:</span>
          <span className="font-bold text-[#F5F5F5]">{filterTotals.count} itens</span>
        </div>
        <div className="flex items-center gap-4 tabular-nums">
          <span className="text-[#4ADE80] font-semibold">
            Entradas: +{formatMoney(filterTotals.incomeCents)}
          </span>
          <span className="text-[#F87171] font-semibold">
            Saídas: -{formatMoney(filterTotals.expenseCents)}
          </span>
          <span className={`font-bold ${filterTotals.balanceCents >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
            Resultado: {filterTotals.balanceCents >= 0 ? '+' : ''}{formatMoney(filterTotals.balanceCents)}
          </span>
        </div>
      </div>

      {/* Grouped Transactions List */}
      <div className="space-y-6">
        {groupedByDay.length === 0 ? (
          <div className="py-20 text-center bg-[#141414] border border-[#2B2B2B] rounded-2xl p-8 space-y-3">
            <p className="text-sm font-semibold text-[#F5F5F5]">Nenhum lançamento encontrado</p>
            <p className="text-xs text-[#A3A3A3]">
              Tente alterar os filtros ou adicione uma nova entrada ou saída.
            </p>
            {canEdit && (
              <button
                onClick={() => onOpenTransactionModal('expense')}
                className="mt-2 px-4 py-2 bg-[#D97757] text-[#0A0A0A] font-bold text-xs rounded-xl"
              >
                Adicionar Lançamento
              </button>
            )}
          </div>
        ) : (
          groupedByDay.map(([day, items]) => {
            const dayTotal = items.reduce((sum, t) => {
              if (t.type === 'income') return sum + t.amountCents;
              if (t.type === 'expense') return sum - t.amountCents;
              return sum;
            }, 0);

            return (
              <div key={day} className="space-y-2">
                {/* Day Header */}
                <div className="flex items-center justify-between px-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#D97757]" />
                    <span className="font-bold text-[#F5F5F5]">{formatDisplayDate(day)}</span>
                  </div>
                  <span className={`tabular-nums font-semibold ${dayTotal >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                    {dayTotal >= 0 ? '+' : ''}{formatMoney(dayTotal)}
                  </span>
                </div>

                {/* Day Items */}
                <div className="space-y-2">
                  {items.map(tx => (
                    <TransactionItem
                      key={tx.id}
                      transaction={tx}
                      category={categoryMap.get(tx.categoryId || '')}
                      account={accountMap.get(tx.accountId)}
                      toAccount={accountMap.get(tx.toAccountId || '')}
                      creatorName={memberMap.get(tx.createdBy)}
                      showCreator={members.length > 1}
                      onSelect={t => onOpenTransactionModal(t.type, t)}
                      onMarkPaid={id => markAsPaid(id)}
                      onDelete={canEdit ? (id, scope) => deleteTransaction(id, scope) : undefined}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Pagination / Show more */}
        {filteredTransactions.length > displayLimit && (
          <div className="text-center pt-4">
            <button
              onClick={() => setDisplayLimit(prev => prev + 50)}
              className="px-6 py-2.5 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] text-xs font-semibold text-[#D97757] rounded-xl transition-colors"
            >
              Carregar mais 50 itens ({filteredTransactions.length - displayLimit} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};