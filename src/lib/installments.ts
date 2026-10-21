import { Transaction } from '../types';
import { addMonths } from './dates';

export interface CreateInstallmentsParams {
  baseTransaction: Omit<Transaction, 'id' | 'installment'>;
  installmentCount: number; // 2 to 48
  groupId?: string;
}

/**
 * Generates N installment transactions with deterministic IDs:
 * inst_{groupId}_{n}
 * Remainder cents added to the first installment.
 * Description suffixed with (n/total).
 */
export function generateInstallmentTransactions(params: CreateInstallmentsParams): Transaction[] {
  const { baseTransaction, installmentCount } = params;
  const groupId = params.groupId || `grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  
  const totalCents = baseTransaction.amountCents;
  const baseCentsPerInstallment = Math.floor(totalCents / installmentCount);
  const remainderCents = totalCents % installmentCount;

  const results: Transaction[] = [];

  for (let n = 1; n <= installmentCount; n++) {
    const isFirst = n === 1;
    const amountCents = isFirst ? baseCentsPerInstallment + remainderCents : baseCentsPerInstallment;
    const date = addMonths(baseTransaction.date, n - 1);
    
    // For pending/due date
    let dueDate = baseTransaction.dueDate ? addMonths(baseTransaction.dueDate, n - 1) : null;
    if (baseTransaction.status === 'pending' && !dueDate) {
      dueDate = date;
    }

    const description = `${baseTransaction.description} (${n}/${installmentCount})`;
    const id = `inst_${groupId}_${n}`;

    results.push({
      ...baseTransaction,
      id,
      amountCents,
      description,
      date,
      dueDate,
      installment: {
        groupId,
        number: n,
        total: installmentCount,
      },
      status: n === 1 ? baseTransaction.status : 'pending', // Subsequent installments start pending
      paidDate: n === 1 ? baseTransaction.paidDate : null,
    });
  }

  return results;
}
