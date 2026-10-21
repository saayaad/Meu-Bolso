import { Transaction, Category, Budget, FinancialSummary } from '../types';
import { formatMoney } from './money';
import { getPreviousMonth, isSameMonth, todayString } from './dates';

export interface FinancialInsight {
  id: string;
  type: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  description: string;
  iconName: string;
}

export interface SpendingReductionSuggestion {
  categoryId: string;
  categoryName: string;
  currentExpenseCents: number;
  savings10Cents: number;
  savings20Cents: number;
}

export function generateInsights(
  currentMonthYear: string,
  summary: FinancialSummary,
  transactions: Transaction[],
  categories: Category[],
  budgets: Budget[]
): {
  insights: FinancialInsight[];
  suggestions: SpendingReductionSuggestion[];
} {
  const insights: FinancialInsight[] = [];
  const categoryMap = new Map(categories.map(c => [c.id, c]));

  // 1. Forecast end of month warning
  if (summary.forecastEndMonthCents < 0) {
    insights.push({
      id: 'forecast-negative',
      type: 'danger',
      title: 'Atenção ao Saldo Previsto',
      description: `A previsão indica saldo negativo de ${formatMoney(Math.abs(summary.forecastEndMonthCents))} no fim do mês considerando as contas pendentes.`,
      iconName: 'AlertTriangle',
    });
  } else if (summary.forecastEndMonthCents > 0 && summary.toPayCents > 0) {
    insights.push({
      id: 'forecast-positive',
      type: 'success',
      title: 'Previsão Positiva',
      description: `Após quitar todas as contas a pagar deste mês, seu saldo projetado será de ${formatMoney(summary.forecastEndMonthCents)}.`,
      iconName: 'TrendingUp',
    });
  }

  // 2. Overdue bills
  const today = todayString();
  const overdueTransactions = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && t.dueDate && t.dueDate < today
  );
  if (overdueTransactions.length > 0) {
    const overdueTotal = overdueTransactions.reduce((acc, t) => acc + t.amountCents, 0);
    insights.push({
      id: 'overdue-bills',
      type: 'danger',
      title: `${overdueTransactions.length} Conta(s) Vencida(s)`,
      description: `Você tem ${formatMoney(overdueTotal)} em contas pendentes com data de vencimento ultrapassada.`,
      iconName: 'Clock',
    });
  }

  // 3. Category comparison with previous month (> 20% change)
  const prevMonthYear = getPreviousMonth(currentMonthYear);
  const currentMonthExpenses = transactions.filter(
    t => t.type === 'expense' && isSameMonth(t.date, currentMonthYear)
  );
  const prevMonthExpenses = transactions.filter(
    t => t.type === 'expense' && isSameMonth(t.date, prevMonthYear)
  );

  const currCatTotals = new Map<string, number>();
  const prevCatTotals = new Map<string, number>();

  currentMonthExpenses.forEach(t => {
    const cid = t.categoryId || 'sem_categoria';
    currCatTotals.set(cid, (currCatTotals.get(cid) || 0) + t.amountCents);
  });
  prevMonthExpenses.forEach(t => {
    const cid = t.categoryId || 'sem_categoria';
    prevCatTotals.set(cid, (prevCatTotals.get(cid) || 0) + t.amountCents);
  });

  // Find biggest category in current month
  let topCategoryId = '';
  let topCategoryAmount = 0;
  currCatTotals.forEach((val, cid) => {
    if (val > topCategoryAmount) {
      topCategoryAmount = val;
      topCategoryId = cid;
    }
  });

  if (topCategoryId && topCategoryAmount > 0) {
    const catName = categoryMap.get(topCategoryId)?.name || 'Sem Categoria';
    const percentOfTotal =
      summary.totalExpenseCents > 0
        ? Math.round((topCategoryAmount / summary.totalExpenseCents) * 100)
        : 0;
    insights.push({
      id: 'top-spending-category',
      type: 'info',
      title: `Maior Gasto: ${catName}`,
      description: `${catName} representa ${percentOfTotal}% do seu total gasto no mês (${formatMoney(topCategoryAmount)}).`,
      iconName: 'PieChart',
    });
  }

  // Check variation vs previous month
  currCatTotals.forEach((currAmount, cid) => {
    const prevAmount = prevCatTotals.get(cid) || 0;
    const catName = categoryMap.get(cid)?.name || 'Outros';
    
    // Only check if relevant (more than R$ 50,00)
    if (currAmount > 5000 && prevAmount > 5000) {
      const diff = currAmount - prevAmount;
      const ratio = (diff / prevAmount) * 100;
      if (ratio > 20) {
        insights.push({
          id: `var-up-${cid}`,
          type: 'warning',
          title: `Gastos em alta: ${catName}`,
          description: `Você gastou ${Math.round(ratio)}% a mais com ${catName} em relação ao mês anterior (+${formatMoney(diff)}).`,
          iconName: 'TrendingUp',
        });
      } else if (ratio < -20) {
        insights.push({
          id: `var-down-${cid}`,
          type: 'success',
          title: `Economia em ${catName}`,
          description: `Você gastou ${Math.round(Math.abs(ratio))}% a menos com ${catName} em relação ao mês anterior (-${formatMoney(Math.abs(diff))}).`,
          iconName: 'TrendingDown',
        });
      }
    }
  });

  // 4. Budget limits and alerts
  budgets.forEach(b => {
    const spent = currCatTotals.get(b.categoryId) || 0;
    const catName = categoryMap.get(b.categoryId)?.name || 'Categoria';
    const pct = b.limitCents > 0 ? (spent / b.limitCents) * 100 : 0;

    if (spent >= b.limitCents) {
      insights.push({
        id: `budget-exceeded-${b.id}`,
        type: 'danger',
        title: `Orçamento Estourado: ${catName}`,
        description: `Você ultrapassou o teto definido (${formatMoney(b.limitCents)}) tendo gasto ${formatMoney(spent)} (${Math.round(pct)}%).`,
        iconName: 'AlertOctagon',
      });
    } else if (pct >= b.alertPercent) {
      insights.push({
        id: `budget-warning-${b.id}`,
        type: 'warning',
        title: `Atenção ao Orçamento: ${catName}`,
        description: `Você atingiu ${Math.round(pct)}% do orçamento de ${formatMoney(b.limitCents)}. Restam ${formatMoney(b.limitCents - spent)}.`,
        iconName: 'AlertCircle',
      });
    }
  });

  // 5. Subscriptions and Recurring expenses
  const recurringTxs = currentMonthExpenses.filter(t => {
    const catName = categoryMap.get(t.categoryId || '')?.name || '';
    return t.recurrenceId != null || /assinatura|streaming/i.test(catName);
  });
  if (recurringTxs.length > 0) {
    const recurringSum = recurringTxs.reduce((sum, t) => sum + t.amountCents, 0);
    insights.push({
      id: 'subscriptions-insight',
      type: 'info',
      title: 'Assinaturas e Recorrências',
      description: `Identificamos ${recurringTxs.length} gastos recorrentes/assinaturas totalizando ${formatMoney(recurringSum)} neste mês.`,
      iconName: 'Repeat',
    });
  }

  // 6. Savings rate
  if (summary.totalIncomeCents > 0) {
    if (summary.savingsRatePercent >= 20) {
      insights.push({
        id: 'high-savings',
        type: 'success',
        title: 'Excelente Taxa de Poupança!',
        description: `Você economizou ${summary.savingsRatePercent}% das suas receitas deste mês. Continue assim!`,
        iconName: 'Sparkles',
      });
    } else if (summary.savingsRatePercent > 0) {
      insights.push({
        id: 'mod-savings',
        type: 'info',
        title: 'Economia Positiva',
        description: `Taxa de poupança atual de ${summary.savingsRatePercent}%. Tente alcançar os 20% recomendados.`,
        iconName: 'PiggyBank',
      });
    }
  }

  // 7. Spending reduction suggestions for top 3 variable expense categories (desejos / variable)
  const variableCategories: SpendingReductionSuggestion[] = [];
  const sortedCategories = Array.from(currCatTotals.entries())
    .map(([cid, amount]) => ({
      categoryId: cid,
      category: categoryMap.get(cid),
      amountCents: amount,
    }))
    .filter(item => item.category?.bucket !== 'necessidades' && item.amountCents > 1000)
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, 3);

  sortedCategories.forEach(item => {
    variableCategories.push({
      categoryId: item.categoryId,
      categoryName: item.category?.name || 'Gastos Variáveis',
      currentExpenseCents: item.amountCents,
      savings10Cents: Math.round(item.amountCents * 0.1),
      savings20Cents: Math.round(item.amountCents * 0.2),
    });
  });

  return {
    insights: insights.slice(0, 8),
    suggestions: variableCategories,
  };
}