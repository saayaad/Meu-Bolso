import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Transaction } from '../types';
import { formatMoney } from '../lib/money';
import {
  todayString,
  currentMonthYearString,
  formatMonthYear,
  formatDisplayDate,
  addDays,
  getPreviousMonth,
  getNextMonth,
} from '../lib/dates';
import { TransactionItem } from '../components/transactions/TransactionItem';

interface PayablesReceivablesPageProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer', editTx?: Transaction) => void;
}

export const PayablesReceivablesPage: React.FC<PayablesReceivablesPageProps> = ({
  onOpenTransactionModal,
}) => {
  const {
    transactions,
    categories,
    accounts,
    members,
    canEdit,
    markAsPaid,
  } = useWorkspace();

  const [activeTab, setActiveTab] = useState<'payables' | 'receivables'>('payables');
  const [calendarMonth, setCalendarMonth] = useState<string>(currentMonthYearString());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const memberMap = useMemo(() => new Map(members.map(m => [m.uid, m.name])), [members]);

  const targetType = activeTab === 'payables' ? 'expense' : 'income';
  const pendingTransactions = useMemo(
    () => transactions.filter(t => t.type === targetType && t.status === 'pending'),
    [transactions, targetType]
  );

  const today = todayString();
  const next7DaysLimit = addDays(today, 7);
  const curMonth = currentMonthYearString();

  // Categorize sections
  const sections = useMemo(() => {
    const overdue: Transaction[] = [];
    const dueToday: Transaction[] = [];
    const next7Days: Transaction[] = [];
    const thisMonth: Transaction[] = [];
    const later: Transaction[] = [];

    pendingTransactions.forEach(t => {
      const d = t.dueDate || t.date;
      if (d < today) {
        overdue.push(t);
      } else if (d === today) {
        dueToday.push(t);
      } else if (d <= next7DaysLimit) {
        next7Days.push(t);
      } else if (d.startsWith(curMonth)) {
        thisMonth.push(t);
      } else {
        later.push(t);
      }
    });

    const sum = (items: Transaction[]) => items.reduce((acc, i) => acc + i.amountCents, 0);

    return [
      { id: 'overdue', title: 'Vencidas', color: '#F87171', items: overdue, total: sum(overdue), isUrgent: true },
      { id: 'today', title: 'Vencem Hoje', color: '#FBBF24', items: dueToday, total: sum(dueToday), isUrgent: true },
      { id: 'next7', title: 'Próximos 7 Dias', color: '#D97757', items: next7Days, total: sum(next7Days) },
      { id: 'thisMonth', title: 'Ainda Este Mês', color: '#A3A3A3', items: thisMonth, total: sum(thisMonth) },
      { id: 'later', title: 'Próximos Meses', color: '#666', items: later, total: sum(later) },
    ];
  }, [pendingTransactions, today, next7DaysLimit, curMonth]);

  // Calendar Day Dots & Data
  const calendarData = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month, 0).getDate();

    // Map day to count of payables & receivables
    const dayMap = new Map<string, { payablesCount: number; receivablesCount: number; payablesTotal: number; receivablesTotal: number }>();

    transactions.forEach(t => {
      if (t.status !== 'pending') return;
      const d = t.dueDate || t.date;
      if (d.startsWith(calendarMonth)) {
        const cur = dayMap.get(d) || { payablesCount: 0, receivablesCount: 0, payablesTotal: 0, receivablesTotal: 0 };
        if (t.type === 'expense') {
          cur.payablesCount += 1;
          cur.payablesTotal += t.amountCents;
        } else if (t.type === 'income') {
          cur.receivablesCount += 1;
          cur.receivablesTotal += t.amountCents;
        }
        dayMap.set(d, cur);
      }
    });

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarMonth}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateStr,
        isToday: dateStr === today,
        info: dayMap.get(dateStr),
      });
    }

    return days;
  }, [calendarMonth, transactions, today]);

  // Selected Day Transactions
  const selectedDayItems = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return transactions.filter(t => (t.dueDate === selectedCalendarDay || t.date === selectedCalendarDay));
  }, [transactions, selectedCalendarDay]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner and Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">Contas a Pagar e a Receber</h2>
          <p className="text-xs text-[#A3A3A3]">
            Acompanhamento de vencimentos, fluxo de caixa e calendário
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => onOpenTransactionModal(activeTab === 'payables' ? 'expense' : 'income')}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'payables' ? 'Nova Conta a Pagar' : 'Nova Conta a Receber'}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-2xl w-full sm:w-80">
        <button
          onClick={() => {
            setActiveTab('payables');
            setSelectedCalendarDay(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'payables'
              ? 'bg-[#F87171] text-[#0A0A0A] shadow-sm'
              : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          A Pagar
        </button>
        <button
          onClick={() => {
            setActiveTab('receivables');
            setSelectedCalendarDay(null);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'receivables'
              ? 'bg-[#4ADE80] text-[#0A0A0A] shadow-sm'
              : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          A Receber
        </button>
      </div>

      {/* Main Grid: Sectioned List on left, Interactive Calendar on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Sections: Vencidas, Hoje, 7 dias, Este mês, Depois */}
        <div className="lg:col-span-7 space-y-6">
          {sections.map(sec => {
            if (sec.items.length === 0) return null;

            return (
              <div key={sec.id} className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sec.color }} />
                    <h3 className="font-bold text-sm text-[#F5F5F5]">{sec.title}</h3>
                    <span className="text-xs text-[#A3A3A3]">({sec.items.length})</span>
                  </div>
                  <span className="font-bold text-xs tabular-nums text-[#F5F5F5]">
                    Total: {formatMoney(sec.total)}
                  </span>
                </div>

                <div className="space-y-2">
                  {sec.items.map(t => (
                    <TransactionItem
                      key={t.id}
                      transaction={t}
                      category={categoryMap.get(t.categoryId || '')}
                      account={accountMap.get(t.accountId)}
                      toAccount={accountMap.get(t.toAccountId || '')}
                      creatorName={memberMap.get(t.createdBy)}
                      showCreator={members.length > 1}
                      onSelect={item => onOpenTransactionModal(item.type, item)}
                      onMarkPaid={id => markAsPaid(id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {pendingTransactions.length === 0 && (
            <div className="py-20 text-center bg-[#141414] border border-[#2B2B2B] rounded-3xl p-8 space-y-2">
              <CheckCircle className="w-10 h-10 text-[#4ADE80] mx-auto" />
              <p className="font-bold text-sm text-[#F5F5F5]">
                {activeTab === 'payables'
                  ? 'Parabéns! Todas as contas a pagar estão quitadas.'
                  : 'Nenhuma receita pendente a receber.'}
              </p>
            </div>
          )}
        </div>

        {/* Monthly Calendar with Dots */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
            {/* Calendar Month Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <div className="flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-[#D97757]" />
                <h3 className="font-bold text-sm text-[#F5F5F5] capitalize">
                  {formatMonthYear(calendarMonth)}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCalendarMonth(getPreviousMonth(calendarMonth))}
                  className="p-1.5 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#F5F5F5] rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCalendarMonth(getNextMonth(calendarMonth))}
                  className="p-1.5 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#F5F5F5] rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[#A3A3A3] pb-1">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {calendarData.map((d, index) => {
                if (!d) {
                  return <div key={`empty-${index}`} className="h-10" />;
                }

                const isSelected = selectedCalendarDay === d.dateStr;
                const hasPayables = (d.info?.payablesCount || 0) > 0;
                const hasReceivables = (d.info?.receivablesCount || 0) > 0;

                return (
                  <button
                    key={d.dateStr}
                    onClick={() => setSelectedCalendarDay(isSelected ? null : d.dateStr)}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center p-1 transition-all ${
                      isSelected
                        ? 'bg-[#D97757] text-[#0A0A0A] font-bold shadow-md'
                        : d.isToday
                        ? 'bg-[#1C1C1C] text-[#D97757] border border-[#D97757]/40 font-bold'
                        : 'bg-[#1C1C1C]/60 hover:bg-[#1C1C1C] text-[#F5F5F5]'
                    }`}
                  >
                    <span className="text-xs">{d.dayNumber}</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      {hasPayables && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#0A0A0A]' : 'bg-[#F87171]'}`} />
                      )}
                      {hasReceivables && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#0A0A0A]' : 'bg-[#4ADE80]'}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-[#2B2B2B] text-[11px] text-[#A3A3A3]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F87171]" />
                Contas a pagar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                Contas a receber
              </span>
            </div>
          </div>

          {/* Selected Day Details Panel */}
          {selectedCalendarDay && (
            <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
                <h4 className="font-bold text-xs text-[#F5F5F5]">
                  Lançamentos de {formatDisplayDate(selectedCalendarDay)}
                </h4>
                <button
                  onClick={() => setSelectedCalendarDay(null)}
                  className="text-[11px] text-[#A3A3A3] hover:text-[#F5F5F5]"
                >
                  Fechar
                </button>
              </div>

              {selectedDayItems.length === 0 ? (
                <p className="text-xs text-[#A3A3A3] py-4 text-center">Nenhum lançamento agendado para este dia.</p>
              ) : (
                <div className="space-y-2">
                  {selectedDayItems.map(item => (
                    <TransactionItem
                      key={item.id}
                      transaction={item}
                      category={categoryMap.get(item.categoryId || '')}
                      account={accountMap.get(item.accountId)}
                      toAccount={accountMap.get(item.toAccountId || '')}
                      onSelect={t => onOpenTransactionModal(t.type, t)}
                      onMarkPaid={id => markAsPaid(id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};