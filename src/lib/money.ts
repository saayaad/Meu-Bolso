import { CurrencyCode } from '../types';

let activeCurrency: CurrencyCode = 'BRL';

export function setDefaultCurrency(currency: CurrencyCode): void {
  activeCurrency = currency;
}

export function getDefaultCurrency(): CurrencyCode {
  return activeCurrency;
}

export function getCurrencySymbol(currency: CurrencyCode = activeCurrency): string {
  switch (currency) {
    case 'USD':
      return 'US$';
    case 'EUR':
      return '€';
    default:
      return 'R$';
  }
}

/**
 * Format integer cents into formatted currency string.
 * Example: 12500 -> "R$ 125,00" (for BRL)
 */
export function formatMoney(amountCents: number, currency: CurrencyCode = activeCurrency): string {
  const value = (amountCents || 0) / 100;
  
  const locales: Record<CurrencyCode, string> = {
    BRL: 'pt-BR',
    USD: 'en-US',
    EUR: 'de-DE',
  };

  return new Intl.NumberFormat(locales[currency] || 'pt-BR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format cents as a plain decimal number with comma.
 * Example: 12500 -> "125,00"
 */
export function formatMoneyWithoutSymbol(amountCents: number): string {
  const value = (amountCents || 0) / 100;
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Converts right-to-left numeric input into integer cents.
 * Keeps only digits, parses as integer cents.
 * E.g. user typed "1", "2", "5", "0", "0" -> digits "12500" -> 12500 cents.
 */
export function parseCentsFromDigits(rawInput: string): number {
  const cleanDigits = rawInput.replace(/\D/g, '');
  if (!cleanDigits) return 0;
  const parsed = parseInt(cleanDigits, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Converts decimal float (like from OFX or CSV) safely into integer cents without rounding errors.
 */
export function decimalToCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converts integer cents to float.
 */
export function centsToDecimal(cents: number): number {
  return cents / 100;
}

/**
 * Parses user typed input or CSV string like "1.234,56" or "1234.56" into integer cents.
 */
export function parseStringToCents(valueStr: string): number {
  if (!valueStr) return 0;
  let clean = valueStr.trim();
  clean = clean.replace(/R\$|US\$|\$|€/g, '').trim();

  // If both dot and comma exist: determine which is decimal
  const lastDot = clean.lastIndexOf('.');
  const lastComma = clean.lastIndexOf(',');

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      // Brazilian format: 1.234,56
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: 1,234.56
      clean = clean.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Has only comma: 1234,56
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}