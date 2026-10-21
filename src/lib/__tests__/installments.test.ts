import { describe, it, expect } from 'vitest';
import { generateInstallmentTransactions } from '../installments';
import { Transaction } from '../../types';

describe('lib/installments unit tests', () => {
  const baseTx: Omit<Transaction, 'id' | 'installment'> = {
    type: 'expense',
    amountCents: 10000, // R$ 100,00 divided by 3 -> 33,34 (first) and 33,33 (next two)
    description: 'Curso Online',
    accountId: 'acc_1',
    date: '2026-10-15',
    dueDate: '2026-10-15',
    paymentMethod: 'credito',
    status: 'pending',
    tags: [],
    attachments: [],
    createdBy: 'user_1',
  };

  it('generates N deterministic installments with penny remainder added to the first installment', () => {
    const installments = generateInstallmentTransactions({
      baseTransaction: baseTx,
      installmentCount: 3,
      groupId: 'grp_test',
    });

    expect(installments).toHaveLength(3);
    expect(installments[0].id).toBe('inst_grp_test_1');
    expect(installments[1].id).toBe('inst_grp_test_2');
    expect(installments[2].id).toBe('inst_grp_test_3');

    // 10000 / 3 = 3333 with 1 remainder -> first is 3334, next two are 3333
    expect(installments[0].amountCents).toBe(3334);
    expect(installments[1].amountCents).toBe(3333);
    expect(installments[2].amountCents).toBe(3333);

    // Sum matches exactly
    const sum = installments.reduce((acc, t) => acc + t.amountCents, 0);
    expect(sum).toBe(10000);

    // Description suffix (n/total)
    expect(installments[0].description).toBe('Curso Online (1/3)');
    expect(installments[1].description).toBe('Curso Online (2/3)');
    expect(installments[2].description).toBe('Curso Online (3/3)');

    // Monthly dates
    expect(installments[0].date).toBe('2026-10-15');
    expect(installments[1].date).toBe('2026-11-15');
    expect(installments[2].date).toBe('2026-12-15');
  });
});
