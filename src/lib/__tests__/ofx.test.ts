import { describe, it, expect } from 'vitest';
import { parseOFX, suggestCategoryByKeyword } from '../ofx';

describe('lib/ofx unit tests', () => {
  const sampleOFX = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <STMTRS>
        <BANKTRANLIST>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261014120000[-03:EST]
            <TRNAMT>-154.50
            <FITID>20261014001
            <MEMO>SUPERMERCADO EXTRA
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261015120000[-03:EST]
            <TRNAMT>3500.00
            <FITID>20261015002
            <NAME>PAGTO SALARIO EMPRESA
          </STMTTRN>
        </BANKTRANLIST>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
  `;

  it('parses OFX SGML tags into debit and credit transactions with proper cents', () => {
    const transactions = parseOFX(sampleOFX);
    expect(transactions).toHaveLength(2);

    // Expense
    expect(transactions[0].type).toBe('expense');
    expect(transactions[0].amountCents).toBe(15450);
    expect(transactions[0].date).toBe('2026-10-14');
    expect(transactions[0].fitId).toBe('20261014001');

    // Income
    expect(transactions[1].type).toBe('income');
    expect(transactions[1].amountCents).toBe(350000);
    expect(transactions[1].date).toBe('2026-10-15');
    expect(transactions[1].fitId).toBe('20261015002');
  });

  it('suggests category by keyword', () => {
    expect(suggestCategoryByKeyword('UBER *TRIP BR')).toBe('Transporte');
    expect(suggestCategoryByKeyword('SUPERMERCADO CARREFOUR')).toBe('Alimentação');
    expect(suggestCategoryByKeyword('PAGTO SALARIO EMPRESA')).toBe('Salário');
    expect(suggestCategoryByKeyword('DROGASIL FARMACIA')).toBe('Saúde');
    expect(suggestCategoryByKeyword('NETFLIX.COM')).toBe('Lazer');
  });
});
