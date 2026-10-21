import { describe, it, expect } from 'vitest';
import {
  calculateAccountBalance,
  calculateCreditCardUsedLimit,
  calculateTotalNetWorth,
  calculateFinancialSummary,
} from '../balances';
import { Account, Transaction } from '../../types';

describe('lib/balances unit tests', () => {
  const mockAccount1: Account = {
    id: 'acc_1',
    name: 'Conta Corrente',
    type: 'corrente',
    initialBalanceCents: 100000, // R$ 1.000,00
    color: '#4ADE80',
    icon: 'Wallet',
    archived: false,
  };

  const mockCard: Account = {
    id: 'card_1',
    name: 'Cartão de Crédito',
    type: 'cartao_credito',
    initialBalanceCents: 0,
    creditLimitCents: 300000, // R$ 3.000,00
    closingDay: 20,
    dueDay: 28,
    color: '#D97757',
    icon: 'CreditCard',
    archived: false,
  };

  const mockTransactions: Transaction[] = [
    {
      id: 'tx_1',
      type: 'income',
      amountCents: 50000, // + R$ 500
      description: 'Freelance',
      accountId: 'acc_1',
      date: '2026-10-05',
      paymentMethod: 'pix',
      status: 'paid',
      tags: [],
      attachments: [],
      createdBy: 'u1',
    },
    {
      id: 'tx_2',
      type: 'expense',
      amountCents: 20000, // - R$ 200
      description: 'Supermercado',
      accountId: 'acc_1',
      date: '2026-10-10',
      paymentMethod: 'debito',
      status: 'paid',
      tags: [],
      attachments: [],
      createdBy: 'u1',
    },
    {
      id: 'tx_3',
      type: 'expense',
      amountCents: 15000, // Pending doesn't affect current balance
      description: 'Conta Luz',
      accountId: 'acc_1',
      date: '2026-10-25',
      paymentMethod: 'boleto',
      status: 'pending',
      dueDate: '2026-10-25',
      tags: [],
      attachments: [],
      createdBy: 'u1',
    },
    {
      id: 'tx_4',
      type: 'expense',
      amountCents: 45000, // Credit card pending charge
      description: 'Restaurante',
      accountId: 'card_1',
      date: '2026-10-12',
      paymentMethod: 'credito',
      status: 'pending',
      dueDate: '2026-10-28',
      tags: [],
      attachments: [],
      createdBy: 'u1',
    },
  ];

  it('calculates account balance: initial + paid incomes - paid expenses', () => {
    // 100000 + 50000 - 20000 = 130000 (R$ 1.300,00)
    const balance = calculateAccountBalance(mockAccount1, mockTransactions);
    expect(balance).toBe(130000);
  });

  it('calculates credit card used limit based on pending card expenses', () => {
    const used = calculateCreditCardUsedLimit(mockCard, mockTransactions);
    expect(used).toBe(45000); // R$ 450,00
  });

  it('calculates total net worth excluding credit card accounts', () => {
    const netWorth = calculateTotalNetWorth([mockAccount1, mockCard], mockTransactions);
    expect(netWorth).toBe(130000);
  });

  it('calculates monthly financial summary with paid and pending breakdown', () => {
    const summary = calculateFinancialSummary('2026-10', [mockAccount1, mockCard], mockTransactions);
    expect(summary.totalIncomeCents).toBe(50000);
    expect(summary.totalExpenseCents).toBe(80000); // 20000 + 15000 + 45000
    expect(summary.paidExpenseCents).toBe(20000);
    expect(summary.pendingExpenseCents).toBe(60000);
    expect(summary.toPayCents).toBe(60000);
  });
});
