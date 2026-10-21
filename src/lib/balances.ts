import { Account, Transaction, FinancialSummary } from '../types';
import { isSameMonth, todayString, getMonthEndDate } from './dates';

/**
 * Returns the effective account ID that paid or received the transaction.
 */
export function getEffectiveAccountId(t: Transaction): string {
  return t.paidFromAccountId || t.accountId;
}

/**
 * Pure calculation of account balance:
 * saldo = initialBalanceCents + entradas pagas − saídas pagas + transferências recebidas − transferências enviadas.
 */
export function calculateAccountBalance(account: Account, transactions: Transaction[]): number {
  if (account.type === 'cartao_credito') {
    // Credit card balance is conventionally 0, tracked via used limit
    return 0;
  }

  let balance = account.initialBalanceCents || 0;

  for (const t of transactions) {
    if (t.status !== 'paid') continue;

    const effAccountId = getEffectiveAccountId(t);

    if (t.type === 'income' && effAccountId === account.id) {
      balance += t.amountCents;
    } else if (t.type === 'expense' && effAccountId === account.id) {
      balance -= t.amountCents;
    } else if (t.type === 'transfer') {
      if (t.accountId === account.id) {
        // Sent from this account
        balance -= t.amountCents;
      }
      if (t.toAccountId === account.id) {
        // Received into this account
        balance += t.amountCents;
      }
    }
  }

  return balance;
}

/**
 * Calculate used credit card limit (sum of pending expenses charged to this card).
 */
export function calculateCreditCardUsedLimit(account: Account, transactions: Transaction[]): number {
  if (account.type !== 'cartao_credito') return 0;

  return transactions
    .filter(t => t.accountId === account.id && t.type === 'expense' && t.status === 'pending')
    .reduce((sum, t) => sum + t.amountCents, 0);
}

/**
 * Calculate available credit card limit.
 */
export function calculateCreditCardAvailableLimit(account: Account, transactions: Transaction[]): number {
  if (account.type !== 'cartao_credito') return 0;
  const limit = account.creditLimitCents || 0;
  const used = calculateCreditCardUsedLimit(account, transactions);
  return Math.max(0, limit - used);
}

/**
 * Total net worth across all non-credit card accounts.
 */
export function calculateTotalNetWorth(accounts: Account[], transactions: Transaction[]): number {
  return accounts
    .filter(a => !a.archived && a.type !== 'cartao_credito')
    .reduce((sum, acc) => sum + calculateAccountBalance(acc, transactions), 0);
}

/**
 * Pure financial summary for a given month ("YYYY-MM").
 */
export function calculateFinancialSummary(
  monthYear: string,
  accounts: Account[],
  transactions: Transaction[]
): FinancialSummary {
  const currentBalanceCents = calculateTotalNetWorth(accounts, transactions);
  
  // Transactions falling within the selected month
  const monthTransactions = transactions.filter(t => isSameMonth(t.date, monthYear));
  
  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let paidExpenseCents = 0;
  let pendingExpenseCents = 0;
  let toPayCents = 0;
  let toReceiveCents = 0;
  let largestExpense: { description: string; amountCents: number; date: string } | undefined;

  for (const t of monthTransactions) {
    if (t.type === 'income') {
      totalIncomeCents += t.amountCents;
      if (t.status === 'pending') {
        toReceiveCents += t.amountCents;
      }
    } else if (t.type === 'expense') {
      totalExpenseCents += t.amountCents;
      if (t.status === 'paid') {
        paidExpenseCents += t.amountCents;
      } else {
        pendingExpenseCents += t.amountCents;
        toPayCents += t.amountCents;
      }

      if (!largestExpense || t.amountCents > largestExpense.amountCents) {
        largestExpense = {
          description: t.description,
          amountCents: t.amountCents,
          date: t.date,
        };
      }
    }
  }

  // Month balance (total income - total expense)
  const monthBalanceCents = totalIncomeCents - totalExpenseCents;

  // Daily average expense
  const today = todayString();
  let daysPassed = 1;
  if (today.startsWith(monthYear)) {
    daysPassed = Math.max(1, parseInt(today.split('-')[2], 10));
  } else {
    const [y, m] = monthYear.split('-').map(Number);
    daysPassed = new Date(y, m, 0).getDate();
  }
  const dailyAverageExpenseCents = Math.round(totalExpenseCents / daysPassed);

  // Month end forecast: current balance + pending income - pending expenses until end of month
  const monthEnd = getMonthEndDate(monthYear);
  const futurePendingIncomes = transactions
    .filter(t => t.type === 'income' && t.status === 'pending' && t.date <= monthEnd && (!t.dueDate || t.dueDate <= monthEnd))
    .reduce((sum, t) => sum + t.amountCents, 0);

  const futurePendingExpenses = transactions
    .filter(t => t.type === 'expense' && t.status === 'pending' && t.date <= monthEnd && (!t.dueDate || t.dueDate <= monthEnd))
    .reduce((sum, t) => sum + t.amountCents, 0);

  const forecastEndMonthCents = currentBalanceCents + futurePendingIncomes - futurePendingExpenses;

  // Savings rate percent
  const savingsRatePercent = totalIncomeCents > 0
    ? Math.max(0, Math.round(((totalIncomeCents - totalExpenseCents) / totalIncomeCents) * 100))
    : 0;

  return {
    currentBalanceCents,
    totalIncomeCents,
    totalExpenseCents,
    paidExpenseCents,
    pendingExpenseCents,
    monthBalanceCents,
    toPayCents,
    toReceiveCents,
    largestExpense,
    dailyAverageExpenseCents,
    forecastEndMonthCents,
    savingsRatePercent,
    transactionCount: monthTransactions.length,
  };
}
