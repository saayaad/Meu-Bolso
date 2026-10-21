import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PiggyBank,
  Calendar,
  Layers,
  PieChart as PieChartIcon,
  BarChart2,
  LineChart as LineChartIcon,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatMoney } from '../lib/money';
import {
  currentMonthYearString,
  formatMonthYear,
  getPreviousMonth,
  getNextMonth,
  formatDisplayDate,
  isSameMonth,
  todayString,
} from '../lib/dates';
import { calculateFinancialSummary } from '../lib/balances';
import { TransactionItem } from '../components/transactions/TransactionItem';
import { Transaction } from '../types';

interface DashboardPageProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer', editTx?: Transaction) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenTransactionModal,
  onNavigateTab,
}) => {
  const {
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    members,
    markAsPaid,
  } = useWorkspace();

  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthYearString());
  const [spendingChartView, setSpendingChartView] = useState<'transactions' | 'categories' | 'daily'>('transactions');
  const [showAllExpenses, setShowAllExpenses] = useState<boolean>(false);

  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);
  const accountMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts]);
  const memberMap = useMemo(() => new Map(members.map(m => [m.uid, m.name])), [members]);

  // Financial summary for selected month
  const summary = useMemo(
    () => calculateFinancialSummary(selectedMonth, accounts, transactions),
    [selectedMonth, accounts, transactions]
  );

  // Month transactions
  const monthTransactions = useMemo(
    () => transactions.filter(t => isSameMonth(t.date, selectedMonth)),
    [transactions, selectedMonth]
  );

  const monthExpenses = useMemo(
    () => monthTransactions.filter(t => t.type === 'expense'),
    [monthTransactions]
  );

  // Data for "Por Lançamento" horizontal bar chart
  const transactionChartData = useMemo(() => {
    // Sort expenses descending by amount
    const sorted = [...monthExpenses].sort((a, b) => b.amountCents - a.amountCents);
    const sliced = showAllExpenses ? sorted : sorted.slice(0, 30);
    return sliced.map(t => {
      const cat = categoryMap.get(t.categoryId || '');
      return {
        id: t.id,
        name: t.description.length > 20 ? t.description.substring(0, 18) + '...' : t.description,
        fullName: t.description,
        amount: t.amountCents / 100,
        amountCents: t.amountCents,
        categoryName: cat?.name || 'Geral',
        categoryColor: cat?.color || '#D97757',
        date: formatDisplayDate(t.date),
        paymentMethod: t.paymentMethod,
        status: t.status === 'paid' ? 'Pago' : 'Pendente',
      };
    });
  }, [monthExpenses, showAllExpenses, categoryMap]);

  // Data for "Por Categoria" Donut Chart
  const categoryChartData = useMemo(() => {
    const catTotals = new Map<string, number>();
    monthExpenses.forEach(t => {
      const cid = t.categoryId || 'sem_cat';
      catTotals.set(cid, (catTotals.get(cid) || 0) + t.amountCents);
    });

    return Array.from(catTotals.entries())
      .map(([cid, totalCents]) => {
        const cat = categoryMap.get(cid);
        return {
          id: cid,
          name: cat?.name || 'Sem Categoria',
          color: cat?.color || '#71717A',
          value: totalCents / 100,
          valueCents: totalCents,
          percent: summary.totalExpenseCents > 0 ? Math.round((totalCents / summary.totalExpenseCents) * 100) : 0,
        };
      })
      .sort((a, b) => b.valueCents - a.valueCents);
  }, [monthExpenses, categoryMap, summary.totalExpenseCents]);

  // Data for "Por Dia" Daily Spending Bar Chart
  const dailyChartData = useMemo(() => {
    const dayTotals = new Map<string, number>();
    monthExpenses.forEach(t => {
      const day = t.date.split('-')[2];
      dayTotals.set(day, (dayTotals.get(day) || 0) + t.amountCents);
    });

    const [y, m] = selectedMonth.split('-').map(Number);
    const totalDays = new Date(y, m, 0).getDate();
    const result = [];
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const valCents = dayTotals.get(dayStr) || 0;
      result.push({
        day: dayStr,
        amount: valCents / 100,
        amountCents: valCents,
      });
    }
    return result;
  }, [monthExpenses, selectedMonth]);

  // 6-Month Net Worth & Cashflow Evolution
  const evolutionChartData = useMemo(() => {
    const result = [];
    let cur = selectedMonth;
    const months = [cur];
    for (let i = 0; i < 5; i++) {
      cur = getPreviousMonth(cur);
      months.unshift(cur);
    }

    for (const mStr of months) {
      const mSummary = calculateFinancialSummary(mStr, accounts, transactions);
      result.push({
        month: formatMonthYear(mStr).split(' de ')[0],
        receitas: mSummary.totalIncomeCents / 100,
        despesas: mSummary.totalExpenseCents / 100,
        saldo: mSummary.monthBalanceCents / 100,
      });
    }
    return result;
  }, [selectedMonth, accounts, transactions]);

  // Next 5 upcoming expenses
  const upcomingBills = useMemo(() => {
    const today = todayString();
    return transactions
      .filter(t => t.type === 'expense' && t.status === 'pending' && t.dueDate && t.dueDate >= today)
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 5);
  }, [transactions]);

  // Recent 6 transactions
  const recentTransactions = useMemo(
    () => transactions.slice(0, 6),
    [transactions]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Month Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedMonth(getPreviousMonth(selectedMonth))}
            className="p-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#F5F5F5] rounded-xl transition-colors"
            title="Mês Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center sm:text-left">
            <h2 className="text-lg font-bold text-[#F5F5F5] capitalize">
              {formatMonthYear(selectedMonth)}
            </h2>
            <p className="text-xs text-[#A3A3A3]">
              {monthTransactions.length} lançamentos neste período
            </p>
          </div>

          <button
            onClick={() => setSelectedMonth(getNextMonth(selectedMonth))}
            className="p-2 bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#F5F5F5] rounded-xl transition-colors"
            title="Próximo Mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={() => setSelectedMonth(currentMonthYearString())}
          className="px-3.5 py-1.5 text-xs font-semibold bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#D97757] border border-[#2B2B2B] rounded-xl transition-colors"
        >
          Mês Atual
        </button>
      </div>

      {/* 1. Overview Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Saldo Atual Total */}
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A3A3A3] mb-2">
            <span className="text-xs font-medium">Saldo Atual (Contas)</span>
            <Wallet className="w-4 h-4 text-[#D97757]" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-[#F5F5F5] tabular-nums">
              {formatMoney(summary.currentBalanceCents)}
            </p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">Patrimônio Líquido</p>
          </div>
        </div>

        {/* Total de Entradas */}
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#4ADE80] mb-2">
            <span className="text-xs font-medium">Entradas do Mês</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-[#4ADE80] tabular-nums">
              {formatMoney(summary.totalIncomeCents)}
            </p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              A receber: {formatMoney(summary.toReceiveCents)}
            </p>
          </div>
        </div>

        {/* TOTAL GASTO (Com divisão pago e a pagar) */}
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#F87171] mb-2">
            <span className="text-xs font-medium">Total Gasto no Mês</span>
            <ArrowDownRight className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold text-[#F87171] tabular-nums">
              {formatMoney(summary.totalExpenseCents)}
            </p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Pago: {formatMoney(summary.paidExpenseCents)} • A pagar: {formatMoney(summary.pendingExpenseCents)}
            </p>
          </div>
        </div>

        {/* Saldo do Mês */}
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#A3A3A3] mb-2">
            <span className="text-xs font-medium">Resultado do Mês</span>
            <TrendingUp className="w-4 h-4 text-[#D97757]" />
          </div>
          <div>
            <p
              className={`text-lg sm:text-xl font-bold tabular-nums ${
                summary.monthBalanceCents >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'
              }`}
            >
              {summary.monthBalanceCents >= 0 ? '+' : ''}{formatMoney(summary.monthBalanceCents)}
            </p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Taxa de poupança: {summary.savingsRatePercent}%
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Previsão Fim do Mês */}
        <div className="p-3 bg-[#141414] border border-[#2B2B2B] rounded-xl">
          <span className="text-[11px] text-[#A3A3A3]">Previsão Fim do Mês</span>
          <p
            className={`text-sm font-bold tabular-nums mt-1 ${
              summary.forecastEndMonthCents >= 0 ? 'text-[#F5F5F5]' : 'text-[#F87171]'
            }`}
          >
            {formatMoney(summary.forecastEndMonthCents)}
          </p>
        </div>

        {/* Média Diária */}
        <div className="p-3 bg-[#141414] border border-[#2B2B2B] rounded-xl">
          <span className="text-[11px] text-[#A3A3A3]">Média Diária de Gastos</span>
          <p className="text-sm font-bold text-[#F5F5F5] tabular-nums mt-1">
            {formatMoney(summary.dailyAverageExpenseCents)}/dia
          </p>
        </div>

        {/* Maior Gasto */}
        <div className="p-3 bg-[#141414] border border-[#2B2B2B] rounded-xl">
          <span className="text-[11px] text-[#A3A3A3]">Maior Despesa</span>
          <p className="text-sm font-bold text-[#F87171] tabular-nums mt-1 truncate" title={summary.largestExpense?.description}>
            {summary.largestExpense ? formatMoney(summary.largestExpense.amountCents) : 'R$ 0,00'}
          </p>
        </div>

        {/* Total Contas a Pagar */}
        <div className="p-3 bg-[#141414] border border-[#2B2B2B] rounded-xl">
          <span className="text-[11px] text-[#A3A3A3]">Total a Pagar</span>
          <p className="text-sm font-bold text-[#FBBF24] tabular-nums mt-1">
            {formatMoney(summary.toPayCents)}
          </p>
        </div>
      </div>

      {/* 2. GRÁFICO GERAL DE GASTOS (PRINCIPAL) */}
      <div className="p-5 sm:p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        {/* Highlight Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#2B2B2B]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D97757]" />
              <h3 className="font-bold text-base text-[#F5F5F5]">Gráfico Geral de Gastos</h3>
            </div>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              Total gasto no mês em destaque: <strong className="text-[#F87171] tabular-nums">{formatMoney(summary.totalExpenseCents)}</strong>
            </p>
          </div>

          {/* View switcher */}
          <div className="flex items-center gap-1 bg-[#1C1C1C] p-1 rounded-xl border border-[#2B2B2B]">
            <button
              onClick={() => setSpendingChartView('transactions')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                spendingChartView === 'transactions' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Por Lançamento</span>
            </button>
            <button
              onClick={() => setSpendingChartView('categories')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                spendingChartView === 'categories' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>Por Categoria</span>
            </button>
            <button
              onClick={() => setSpendingChartView('daily')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                spendingChartView === 'daily' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Por Dia</span>
            </button>
          </div>
        </div>

        {/* Chart Render */}
        {monthExpenses.length === 0 ? (
          <div className="py-16 text-center text-[#A3A3A3] text-xs">
            Nenhuma despesa registrada em {formatMonthYear(selectedMonth)}.
          </div>
        ) : (
          <div>
            {spendingChartView === 'transactions' && (
              <div className="space-y-3">
                <div style={{ height: Math.max(280, transactionChartData.length * 28) }} className="w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={transactionChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <XAxis type="number" tickFormatter={v => `R$ ${v}`} stroke="#666" fontSize={11} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        stroke="#A3A3A3"
                        fontSize={11}
                        width={95}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-3 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl shadow-xl text-xs space-y-1">
                                <p className="font-bold text-[#F5F5F5]">{data.fullName}</p>
                                <p className="text-[#A3A3A3]">Categoria: <span className="text-[#F5F5F5] font-semibold">{data.categoryName}</span></p>
                                <p className="text-[#A3A3A3]">Data: {data.date}</p>
                                <p className="text-[#A3A3A3]">Forma: {data.paymentMethod}</p>
                                <p className="text-[#A3A3A3]">Situação: {data.status}</p>
                                <p className="font-bold text-[#F87171] tabular-nums pt-1 border-t border-[#2B2B2B]">
                                  {formatMoney(data.amountCents)}
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                        {transactionChartData.map(entry => (
                          <Cell key={entry.id} fill={entry.categoryColor} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {monthExpenses.length > 30 && (
                  <div className="text-center pt-2">
                    <button
                      onClick={() => setShowAllExpenses(!showAllExpenses)}
                      className="px-4 py-1.5 text-xs font-semibold bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#D97757] rounded-xl transition-colors"
                    >
                      {showAllExpenses ? 'Mostrar apenas as 30 maiores' : `Ver todas (${monthExpenses.length} despesas)`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {spendingChartView === 'categories' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {categoryChartData.map(entry => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="p-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs">
                                <p className="font-bold text-[#F5F5F5]">{data.name}</p>
                                <p className="text-[#F87171] font-bold tabular-nums">{formatMoney(data.valueCents)} ({data.percent}%)</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Categories Breakdown List */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {categoryChartData.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between text-xs p-2 rounded-xl bg-[#1C1C1C]/60 border border-[#2B2B2B]/40">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="text-[#F5F5F5] font-medium">{cat.name}</span>
                      </div>
                      <div className="text-right tabular-nums">
                        <span className="font-bold text-[#F5F5F5]">{formatMoney(cat.valueCents)}</span>
                        <span className="text-[#A3A3A3] text-[11px] ml-2">({cat.percent}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {spendingChartView === 'daily' && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2B2B2B" vertical={false} />
                    <XAxis dataKey="day" stroke="#666" fontSize={11} />
                    <YAxis stroke="#666" fontSize={11} tickFormatter={v => `R$ ${v}`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs">
                              <p className="font-bold text-[#F5F5F5]">Dia {data.day}</p>
                              <p className="text-[#F87171] font-bold tabular-nums">{formatMoney(data.amountCents)}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" fill="#D97757" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Evolution Chart: Cashflow & Net Worth */}
      <div className="p-5 sm:p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-[#D97757]" />
            <h3 className="font-bold text-base text-[#F5F5F5]">Evolução dos Últimos 6 Meses</h3>
          </div>
          <span className="text-xs text-[#A3A3A3]">Receitas vs Despesas</span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={evolutionChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2B2B2B" vertical={false} />
              <XAxis dataKey="month" stroke="#666" fontSize={11} />
              <YAxis stroke="#666" fontSize={11} tickFormatter={v => `R$ ${v}`} />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="p-3 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs space-y-1 shadow-xl">
                        <p className="font-bold text-[#F5F5F5]">{label}</p>
                        <p className="text-[#4ADE80]">Receitas: R$ {payload[0]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                        <p className="text-[#F87171]">Despesas: R$ {payload[1]?.value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line type="monotone" dataKey="receitas" stroke="#4ADE80" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="despesas" stroke="#F87171" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Bottom Grid: Upcoming Bills, Budgets progress, Recent items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Upcoming Bills */}
        <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
            <h4 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D97757]" />
              Próximos Vencimentos
            </h4>
            <button
              onClick={() => onNavigateTab('payables')}
              className="text-xs text-[#D97757] hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-2">
            {upcomingBills.length === 0 ? (
              <p className="text-xs text-[#A3A3A3] py-6 text-center">Nenhuma conta pendente nos próximos dias.</p>
            ) : (
              upcomingBills.map(bill => (
                <div key={bill.id} className="p-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F5F5F5] truncate">{bill.description}</p>
                    <p className="text-[11px] text-[#A3A3A3]">Venc.: {formatDisplayDate(bill.dueDate || '')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-[#F87171] tabular-nums">{formatMoney(bill.amountCents)}</p>
                    <button
                      onClick={() => markAsPaid(bill.id)}
                      className="text-[10px] text-[#4ADE80] hover:underline"
                    >
                      Pagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Budgets Progress */}
        <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
            <h4 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-[#D97757]" />
              Orçamentos do Mês
            </h4>
            <button
              onClick={() => onNavigateTab('budgets')}
              className="text-xs text-[#D97757] hover:underline"
            >
              Gerenciar
            </button>
          </div>

          <div className="space-y-2.5">
            {budgets.length === 0 ? (
              <p className="text-xs text-[#A3A3A3] py-6 text-center">Nenhum teto de orçamento configurado.</p>
            ) : (
              budgets.slice(0, 4).map(b => {
                const cat = categoryMap.get(b.categoryId);
                const spent = monthExpenses
                  .filter(t => t.categoryId === b.categoryId)
                  .reduce((sum, t) => sum + t.amountCents, 0);
                const pct = b.limitCents > 0 ? Math.min(100, Math.round((spent / b.limitCents) * 100)) : 0;
                const isOver = spent > b.limitCents;

                return (
                  <div key={b.id} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-[#F5F5F5]">{cat?.name || 'Categoria'}</span>
                      <span className={`tabular-nums font-semibold ${isOver ? 'text-[#F87171]' : 'text-[#A3A3A3]'}`}>
                        {formatMoney(spent)} / {formatMoney(b.limitCents)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-[#1C1C1C] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          isOver ? 'bg-[#F87171]' : pct >= b.alertPercent ? 'bg-[#FBBF24]' : 'bg-[#4ADE80]'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#2B2B2B]">
            <h4 className="font-bold text-sm text-[#F5F5F5] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D97757]" />
              Últimos Lançamentos
            </h4>
            <button
              onClick={() => onNavigateTab('transactions')}
              className="text-xs text-[#D97757] hover:underline"
            >
              Ver todos
            </button>
          </div>

          <div className="space-y-2">
            {recentTransactions.length === 0 ? (
              <p className="text-xs text-[#A3A3A3] py-6 text-center">Nenhum lançamento recente.</p>
            ) : (
              recentTransactions.map(tx => (
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
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
