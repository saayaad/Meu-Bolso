import * as PapaNamespace from 'papaparse';
import { ParsedBankTransaction } from '../types';
import { parseStringToCents } from './money';
import { suggestCategoryByKeyword } from './ofx';

const Papa =
  (PapaNamespace as unknown as { default?: typeof PapaNamespace }).default ||
  PapaNamespace;

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  suggestedMapping: {
    dateCol: number;
    descCol: number;
    amountCol: number;
    typeCol?: number;
  };
}

export function parseCSVFile(content: string): CSVParseResult {
  const parsed = Papa.parse<string[]>(content, {
    skipEmptyLines: true,
  });

  const data = parsed.data;
  if (!data || data.length === 0) {
    return {
      headers: [],
      rows: [],
      suggestedMapping: { dateCol: 0, descCol: 1, amountCol: 2 },
    };
  }

  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1);

  // Guess columns
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let typeCol = -1;

  headers.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (/data|date|dt/i.test(lower) && dateCol === -1) dateCol = idx;
    else if (/descri|historico|memo|estabelecimento|title/i.test(lower) && descCol === -1) descCol = idx;
    else if (/valor|amount|total|quantia/i.test(lower) && amountCol === -1) amountCol = idx;
    else if (/tipo|type|natureza/i.test(lower) && typeCol === -1) typeCol = idx;
  });

  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = 1 < headers.length ? 1 : 0;
  if (amountCol === -1) amountCol = 2 < headers.length ? 2 : (1 < headers.length ? 1 : 0);

  return {
    headers,
    rows,
    suggestedMapping: {
      dateCol,
      descCol,
      amountCol,
      typeCol: typeCol > -1 ? typeCol : undefined,
    },
  };
}

export function convertMappedRowsToTransactions(
  rows: string[][],
  mapping: { dateCol: number; descCol: number; amountCol: number; typeCol?: number }
): ParsedBankTransaction[] {
  const items: ParsedBankTransaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawDate = row[mapping.dateCol] || '';
    const rawDesc = row[mapping.descCol] || 'Transação CSV';
    const rawAmount = row[mapping.amountCol] || '0';
    const rawType = mapping.typeCol !== undefined ? (row[mapping.typeCol] || '').toLowerCase() : '';

    if (!rawDate.trim() && !rawDesc.trim() && !rawAmount.trim()) continue;

    // Normalize date: dd/mm/yyyy or yyyy-mm-dd
    let normalizedDate = '';
    const brDateMatch = rawDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    const isoDateMatch = rawDate.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);

    if (brDateMatch) {
      const day = brDateMatch[1].padStart(2, '0');
      const month = brDateMatch[2].padStart(2, '0');
      const year = brDateMatch[3];
      normalizedDate = `${year}-${month}-${day}`;
    } else if (isoDateMatch) {
      const year = isoDateMatch[1];
      const month = isoDateMatch[2].padStart(2, '0');
      const day = isoDateMatch[3].padStart(2, '0');
      normalizedDate = `${year}-${month}-${day}`;
    } else {
      continue; // Skip invalid date rows
    }

    const isExplicitNegative = rawAmount.includes('-') || rawType.includes('deb') || rawType.includes('saida') || rawType.includes('despesa');
    const isExplicitPositive = rawAmount.includes('+') || rawType.includes('cred') || rawType.includes('entrada') || rawType.includes('receita');

    const amountCents = Math.abs(parseStringToCents(rawAmount));
    if (amountCents === 0) continue;

    const type: 'income' | 'expense' = isExplicitPositive ? 'income' : (isExplicitNegative ? 'expense' : 'expense');

    items.push({
      id: `csv_${i}_${normalizedDate}_${amountCents}`,
      date: normalizedDate,
      description: rawDesc.trim(),
      amountCents,
      type,
      suggestedCategoryId: suggestCategoryByKeyword(rawDesc),
      selected: true,
    });
  }

  return items;
}