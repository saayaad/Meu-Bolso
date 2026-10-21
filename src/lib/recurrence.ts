import { Recurrence, Transaction } from '../types';
import { addDays, addMonths, todayString } from './dates';

/**
 * Deterministically generates upcoming transactions for the next 3 months for an active recurrence.
 * ID format: rec_{recurrenceId}_{YYYY-MM-DD}
 */
export function generateUpcomingRecurrences(
  recurrences: Recurrence[],
  existingTransactionIds: Set<string>,
  referenceDate = todayString()
): Transaction[] {
  const generated: Transaction[] = [];
  const threeMonthsAhead = addMonths(referenceDate, 3);

  for (const rec of recurrences) {
    if (!rec.active) continue;

    let currentDate = rec.startDate;

    while (currentDate <= threeMonthsAhead) {
      if (rec.endDate && currentDate > rec.endDate) {
        break;
      }

      const txId = `rec_${rec.id}_${currentDate}`;

      // Only generate if not already existing (prevents overwriting edits or paid transactions)
      if (!existingTransactionIds.has(txId)) {
        generated.push({
          ...rec.template,
          id: txId,
          recurrenceId: rec.id,
          date: currentDate,
          dueDate: currentDate,
          status: 'pending',
          paidDate: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Next interval
      if (rec.frequency === 'weekly') {
        currentDate = addDays(currentDate, 7);
      } else if (rec.frequency === 'monthly') {
        currentDate = addMonths(currentDate, 1);
      } else if (rec.frequency === 'yearly') {
        currentDate = addMonths(currentDate, 12);
      } else {
        break;
      }
    }
  }

  return generated;
}
