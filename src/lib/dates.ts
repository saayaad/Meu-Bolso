/**
 * Local date handling without UTC conversion discrepancies.
 * All calendar dates are represented as "YYYY-MM-DD" strings.
 */

export function parseLocalDate(dateString: string): Date {
  const parts = dateString.split('-');
  if (parts.length !== 3) {
    return new Date();
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day, 12, 0, 0); // safe noon
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayString(): string {
  return formatLocalDate(new Date());
}

export function currentMonthYearString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function formatDisplayDate(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

export function formatDisplayDateShort(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;
  const [, month, day] = parts;
  return `${day}/${month}`;
}

export function formatMonthYear(monthYearString: string): string {
  if (!monthYearString) return '';
  const [yearStr, monthStr] = monthYearString.split('-');
  const monthIndex = parseInt(monthStr, 10) - 1;
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return `${monthNames[monthIndex] || monthStr} de ${yearStr}`;
}

export function getPreviousMonth(monthYearString: string): string {
  const [year, month] = monthYearString.split('-').map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getNextMonth(monthYearString: string): string {
  const [year, month] = monthYearString.split('-').map(Number);
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function addDays(dateString: string, days: number): string {
  const d = parseLocalDate(dateString);
  d.setDate(d.getDate() + days);
  return formatLocalDate(d);
}

export function addMonths(dateString: string, months: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  // Calculate target year and month
  const targetDate = new Date(y, m - 1 + months, 1);
  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  
  // Find maximum days in target month
  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
  const day = Math.min(d, maxDays);
  
  const finalDate = new Date(targetYear, targetMonth, day);
  return formatLocalDate(finalDate);
}

export function isPastDue(dueDate: string | null | undefined, referenceDate = todayString()): boolean {
  if (!dueDate) return false;
  return dueDate < referenceDate;
}

export function isDueToday(dueDate: string | null | undefined, referenceDate = todayString()): boolean {
  if (!dueDate) return false;
  return dueDate === referenceDate;
}

export function isDueInDays(dueDate: string | null | undefined, days: number, referenceDate = todayString()): boolean {
  if (!dueDate) return false;
  const targetDate = addDays(referenceDate, days);
  return dueDate > referenceDate && dueDate <= targetDate;
}

export function isSameMonth(dateString: string, targetMonthYear: string): boolean {
  if (!dateString || !targetMonthYear) return false;
  return dateString.startsWith(targetMonthYear);
}

export function getDaysInMonth(monthYearString: string): number {
  const [year, month] = monthYearString.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

export function getMonthStartDate(monthYearString: string): string {
  return `${monthYearString}-01`;
}

export function getMonthEndDate(monthYearString: string): string {
  const days = getDaysInMonth(monthYearString);
  return `${monthYearString}-${String(days).padStart(2, '0')}`;
}
