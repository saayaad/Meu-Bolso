import { describe, it, expect } from 'vitest';
import {
  formatMoney,
  parseCentsFromDigits,
  parseStringToCents,
  decimalToCents,
  centsToDecimal,
} from '../money';

describe('lib/money unit tests', () => {
  it('formats integer cents to BRL currency string', () => {
    const formatted = formatMoney(12500, 'BRL');
    expect(formatted).toContain('125,00');
  });

  it('converts right-to-left numeric input to cents', () => {
    expect(parseCentsFromDigits('1')).toBe(1);
    expect(parseCentsFromDigits('10')).toBe(10);
    expect(parseCentsFromDigits('100')).toBe(100);
    expect(parseCentsFromDigits('12550')).toBe(12550);
  });

  it('parses brazilian decimal strings with dots and commas without floating point error', () => {
    expect(parseStringToCents('1.234,56')).toBe(123456);
    expect(parseStringToCents('R$ 99,90')).toBe(9990);
    expect(parseStringToCents('10,00')).toBe(1000);
  });

  it('converts float to cents safely with rounding', () => {
    expect(decimalToCents(19.99)).toBe(1999);
    expect(decimalToCents(0.1 + 0.2)).toBe(30);
  });

  it('converts cents to decimal', () => {
    expect(centsToDecimal(1500)).toBe(15);
  });
});
