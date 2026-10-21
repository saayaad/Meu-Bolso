import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  PieChart as PieChartIcon,
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
  CartesianGrid,
} from 'recharts';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { formatMoney } from '../lib/money';
import {
  currentMonthYearString,
  formatMonthYear,
  getPreviousMonth,
  todayString,
  addDays,
} from '../lib/dates';
import { calculateFinancialSummary } from '../lib/balances';
import { generateInsights } from '../lib/insights';
import {
  exportReportToPDF,
  exportReportToExcel,
  exportReportToCSV,
  exportBackupJSON,
} from '../lib/export';

export const ReportsPage: React.FC = () => {
  const {
    workspace,
    categories,
    transactions,
    accounts,
    budgets,
    goals,
  } = useWorkspace();

  const [periodPreset, setPeriodPreset] = useState<string>('this_month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  const curMonthYear = currentMonthYearString();
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  // Compute date range
  const { startDate, endDate, periodLabel } = useMemo(() => {
    const today = todayString();
    switch (periodPreset) {
      case 'this_month':
        return {
          startDate: `${curMonthYear}-01`,
          endDate: `${curMonthYear}-31`,
          periodLabel: formatMonthYear(curMonthYear),
        };
      case 'last_month': {
        const prev = getPreviousMonth(curMonthYear);
        return {
          startDate: `${prev}-01`,
          endDate: `${prev}-31`,
          periodLabel: formatMonthYear(prev),
        };
      }
      case '90days':
        return {
          startDate: addDays(today, -90),
          endDate: today,
          periodLabel: 'Últimos 90 Dias',
        };
      case 'year': {
        const y = today.split('-')[0];
        return {
          startDate: `${y}-01-01`,
          endDate: `${y}-12-31`,
          periodLabel: `Ano ${y}`,
        };
      }
      case 'custom':
        return {
          startDate: customStart || '1970-01-01',
          endDate: customEnd || '2099-12-31',
          periodLabel: 'Período Personalizado',
        };
      default:
        return {
          startDate: `${curMonthYear}-01`,
          endDate: `${curMonthYear}-31`,
          periodLabel: formatMonthYear(curMonthYear),
        };
    }
  }, [periodPreset, curMonthYear, customStart, customEnd]);

  // Filter transactions
  const periodTransactions = useMemo(
    () => transactions.filter(t => t.date >= startDate && t.date <= endDate),
    [transactions, startDate, endDate]
  );

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    periodTransactions.forEach(t => {
      if (t.type === 'income') income += t.amountCents;
      if (t.type === 'expense') expense += t.amountCents;
    });
    return {
      totalIncomeCents: income,
      totalExpenseCents: expense,
      balanceCents: income - expense,
    };
  }, [periodTransactions]);

  // Generate smart local insights
  const { insights, suggestions } = useMemo(() => {
    const monthSummary = calculateFinancialSummary(curMonthYear, accounts, transactions);
    return generateInsights(curMonthYear, monthSummary, transactions, categories, budgets);
  }, [curMonthYear, accounts, transactions, categories, budgets]);

  // Expenses by Category Chart
  const categoryExpensesChartData = useMemo(() => {
    const catTotals = new Map<string, number>();
    periodTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const cid = t.categoryId || 'sem_cat';
        catTotals.set(cid, (catTotals.get(cid) || 0) + t.amountCents);
      });

    return Array.from(catTotals.entries())
      .map(([cid, totalCents]) => {
        const cat = categoryMap.get(cid);
        return {
          name: cat?.name || 'Sem Categoria',
          color: cat?.color || '#D97757',
          amount: totalCents / 100,
          amountCents: totalCents,
          percent: summary.totalExpenseCents > 0 ? Math.round((totalCents / summary.totalExpenseCents) * 100) : 0,
        };
      })
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [periodTransactions, categoryMap, summary.totalExpenseCents]);

  // Export handlers
  const handleExportPDF = () => {
    exportReportToPDF({
      title: 'Relatório Financeiro',
      periodText: periodLabel,
      transactions: periodTransactions,
      categories,
      accounts,
      summary,
    });
  };

  const handleExportExcel = () => {
    exportReportToExcel({
      title: 'Extrato Financeiro',
      periodText: periodLabel,
      transactions: periodTransactions,
      categories,
      accounts,
      summary,
    });
  };

  const handleExportCSV = () => {
    exportReportToCSV({
      title: 'Extrato CSV',
      periodText: periodLabel,
      transactions: periodTransactions,
      categories,
      accounts,
      summary,
    });
  };

  const handleExportBackup = () => {
    exportBackupJSON({
      workspace,
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      exportedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">Relatórios e Insights Financeiros</h2>
          <p className="text-xs text-[#A3A3A3]">
            Análises aprofundadas, diagnósticos locais e exportações de dados
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
          >
            <FileText className="w-4 h-4 text-[#F87171]" />
            <span>PDF</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-[#4ADE80]" />
            <span>Excel (.xlsx)</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
          >
            <Download className="w-4 h-4 text-[#D97757]" />
            <span>CSV (Excel BR)</span>
          </button>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-xs font-bold text-[#0A0A0A] rounded-xl transition-colors shadow-md"
          >
            <FileCode className="w-4 h-4" />
            <span>Backup JSON</span>
          </button>
        </div>
      </div>

      {/* Period Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#D97757]" />
          <span className="text-xs font-bold text-[#F5F5F5]">Período do Relatório:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {['this_month', 'last_month', '90days', 'year'].map(p => (
            <button
              key={p}
              onClick={() => setPeriodPreset(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                periodPreset === p
                  ? 'bg-[#D97757] text-[#0A0A0A]'
                  : 'bg-[#1C1C1C] text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              {p === 'this_month' ? 'Este Mês' : p === 'last_month' ? 'Mês Passado' : p === '90days' ? '90 Dias' : 'Este Ano'}
            </button>
          ))}
        </div>
      </div>

      {/* Period Totals Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl">
          <span className="text-xs text-[#A3A3A3]">Receitas no Período</span>
          <p className="text-xl font-bold text-[#4ADE80] tabular-nums mt-1">{formatMoney(summary.totalIncomeCents)}</p>
        </div>
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl">
          <span className="text-xs text-[#A3A3A3]">Despesas no Período</span>
          <p className="text-xl font-bold text-[#F87171] tabular-nums mt-1">{formatMoney(summary.totalExpenseCents)}</p>
        </div>
        <div className="p-4 bg-[#141414] border border-[#2B2B2B] rounded-2xl">
          <span className="text-xs text-[#A3A3A3]">Resultado Líquido</span>
          <p className={`text-xl font-bold tabular-nums mt-1 ${summary.balanceCents >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
            {summary.balanceCents >= 0 ? '+' : ''}{formatMoney(summary.balanceCents)}
          </p>
        </div>
      </div>

      {/* 1. SMART FINANCIAL INSIGHTS CARDS */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-[#D97757]" />
          <h3 className="font-bold text-sm text-[#F5F5F5]">Insights Automáticos (Regras Inteligentes)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {insights.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                item.type === 'danger'
                  ? 'bg-[#F87171]/10 border-[#F87171]/30'
                  : item.type === 'warning'
                  ? 'bg-[#FBBF24]/10 border-[#FBBF24]/30'
                  : item.type === 'success'
                  ? 'bg-[#4ADE80]/10 border-[#4ADE80]/30'
                  : 'bg-[#141414] border-[#2B2B2B]'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  item.type === 'danger'
                    ? 'text-[#F87171]'
                    : item.type === 'warning'
                    ? 'text-[#FBBF24]'
                    : item.type === 'success'
                    ? 'text-[#4ADE80]'
                    : 'text-[#D97757]'
                }`}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <h4 className="font-bold text-xs text-[#F5F5F5]">{item.title}</h4>
                <p className="text-[11px] text-[#A3A3A3] leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. SPENDING REDUCTION SUGGESTIONS */}
      {suggestions.length > 0 && (
        <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#4ADE80]" />
            <h3 className="font-bold text-sm text-[#F5F5F5]">Oportunidades de Economia (Gastos Variáveis)</h3>
          </div>
          <p className="text-xs text-[#A3A3A3]">
            Veja o impacto no seu bolso ao reduzir 10% ou 20% nas categorias com maior gasto flexível neste mês:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {suggestions.map(s => (
              <div key={s.categoryId} className="p-4 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl space-y-2">
                <h5 className="font-bold text-xs text-[#F5F5F5]">{s.categoryName}</h5>
                <p className="text-[11px] text-[#A3A3A3]">Gasto atual: <strong className="text-[#F87171]">{formatMoney(s.currentExpenseCents)}</strong></p>
                <div className="pt-2 border-t border-[#2B2B2B] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#A3A3A3]">Corte de 10%:</span>
                    <span className="font-bold text-[#4ADE80]">+{formatMoney(s.savings10Cents)}/mês</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A3A3A3]">Corte de 20%:</span>
                    <span className="font-bold text-[#4ADE80]">+{formatMoney(s.savings20Cents)}/mês</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Category Expenses Breakdown Chart */}
      <div className="p-5 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
        <h3 className="font-bold text-sm text-[#F5F5F5]">Distribuição de Despesas por Categoria</h3>

        {categoryExpensesChartData.length === 0 ? (
          <p className="text-xs text-[#A3A3A3] py-12 text-center">Nenhuma despesa no período selecionado.</p>
        ) : (
          <div className="space-y-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryExpensesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2B2B2B" vertical={false} />
                  <XAxis dataKey="name" stroke="#666" fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="#666" fontSize={11} tickFormatter={v => `R$ ${v}`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="p-2.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs">
                            <p className="font-bold text-[#F5F5F5]">{data.name}</p>
                            <p className="text-[#F87171] font-bold tabular-nums">{formatMoney(data.amountCents)} ({data.percent}%)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                    {categoryExpensesChartData.map((e, idx) => (
                      <Cell key={`bar-${idx}`} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-2">
              {categoryExpensesChartData.map((e, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-[#1C1C1C] rounded-xl text-xs">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                    <span className="truncate text-[#F5F5F5]">{e.name}</span>
                  </div>
                  <span className="font-bold text-[#F87171] tabular-nums ml-2">{formatMoney(e.amountCents)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
