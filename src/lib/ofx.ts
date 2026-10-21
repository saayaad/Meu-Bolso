import { ParsedBankTransaction } from '../types';
import { decimalToCents } from './money';

/**
 * Custom OFX parser supporting both SGML (OFX 1.x without closing tags) and XML (OFX 2.x).
 * Extracts transactions from <STMTTRN> blocks:
 * - DTPOSTED: Date (YYYYMMDD...)
 * - TRNAMT: Amount (+ for income, - for expense)
 * - NAME or MEMO: Description
 * - FITID: Unique bank transaction id
 */
export function parseOFX(ofxContent: string): ParsedBankTransaction[] {
  const transactions: ParsedBankTransaction[] = [];

  // Match each <STMTTRN>...</STMTTRN> block or up to the next <STMTTRN> if SGML tags aren't closed
  const trnRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>|<\/BANKTRANLIST>|$))/gi;
  let match: RegExpExecArray | null;

  while ((match = trnRegex.exec(ofxContent)) !== null) {
    const block = match[1];

    const getTagValue = (tagName: string): string => {
      // Regex for <TAG>VALUE or <TAG>VALUE</TAG>
      const tagRegex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i');
      const tagMatch = tagRegex.exec(block);
      return tagMatch ? tagMatch[1].trim() : '';
    };

    const rawDate = getTagValue('DTPOSTED');
    const rawAmt = getTagValue('TRNAMT');
    const name = getTagValue('NAME') || getTagValue('MEMO') || 'Transação OFX';
    const memo = getTagValue('MEMO');
    const fitId = getTagValue('FITID');

    if (!rawDate || !rawAmt) continue;

    // Parse date: e.g. "20261015120000[-03:EST]" -> "2026-10-15"
    let dateStr = '';
    const dateMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    if (dateMatch) {
      dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    } else {
      continue;
    }

    // Parse amount: clean commas if used
    const cleanAmtStr = rawAmt.replace(',', '.');
    const floatAmt = parseFloat(cleanAmtStr);
    if (isNaN(floatAmt)) continue;

    const isExpense = floatAmt < 0;
    const amountCents = Math.abs(decimalToCents(floatAmt));

    const description = memo && memo !== name ? `${name} - ${memo}` : name;

    transactions.push({
      id: fitId || `ofx_${dateStr}_${amountCents}_${Math.random().toString(36).substring(2, 7)}`,
      date: dateStr,
      amountCents,
      type: isExpense ? 'expense' : 'income',
      description,
      fitId: fitId || undefined,
      selected: true,
    });
  }

  return transactions;
}

/**
 * Keyword-based heuristic to suggest category for imported bank items.
 */
export function suggestCategoryByKeyword(description: string): string | undefined {
  const desc = description.toLowerCase();

  if (/uber|99app|posto|gasolina|combustivel|estacionamento|pedagio|auto|mecanica/i.test(desc)) {
    return 'Transporte';
  }
  if (/mercado|supermercado|carrefour|extra|pao de acucar|assai|atacadao|hortifruti|padaria|restaurante|ifood|rappi|lanchonete|burger|pizza|cafe/i.test(desc)) {
    return 'Alimentação';
  }
  if (/farmacia|droga|hospital|consulta|medico|laboratorio|dentista|otica/i.test(desc)) {
    return 'Saúde';
  }
  if (/netflix|spotify|amazon|prime|hbo|disney|apple|youtube|steam|cinema/i.test(desc)) {
    return 'Lazer';
  }
  if (/aluguel|condominio|imob|iptu/i.test(desc)) {
    return 'Moradia';
  }
  if (/enel|luz|cpfl|sabesp|agua|claro|vivo|tim|internet|gas/i.test(desc)) {
    return 'Contas e serviços';
  }
  if (/escola|faculdade|curso|udemy|livraria/i.test(desc)) {
    return 'Educação';
  }
  if (/pet|veterinario|racao|cobasi|petz/i.test(desc)) {
    return 'Pets';
  }
  if (/salario|pro labore|remuneracao|adiantamento/i.test(desc)) {
    return 'Salário';
  }

  return undefined;
}
