import * as jspdfModule from 'jspdf';
import * as autoTableModule from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Transaction, Category, Account } from '../types';
import { formatMoney } from './money';
import { formatDisplayDate } from './dates';
import { APP_NAME } from './constants';

const jsPDFConstructor =
  (jspdfModule as unknown as { jsPDF?: typeof jspdfModule.jsPDF; default?: typeof jspdfModule.jsPDF }).jsPDF ||
  (jspdfModule as unknown as { default: typeof jspdfModule.jsPDF }).default;

const autoTable =
  (autoTableModule as unknown as { default?: typeof autoTableModule.default }).default ||
  (autoTableModule as unknown as typeof autoTableModule.default);

export interface ExportReportData {
  title: string;
  periodText: string;
  transactions: Transaction[];
  categories: Category[];
  accounts: Account[];
  summary: {
    totalIncomeCents: number;
    totalExpenseCents: number;
    balanceCents: number;
  };
}

/**
 * Export filtered transactions to formatted PDF with summary, category totals & autotable.
 */
export function exportReportToPDF(data: ExportReportData) {
  const doc = new jsPDFConstructor();
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));
  const accountMap = new Map(data.accounts.map(a => [a.id, a.name]));

  // Brand Header
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, 210, 32, 'F');
  
  doc.setTextColor(217, 119, 87); // #D97757
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(APP_NAME, 14, 18);

  doc.setTextColor(245, 245, 245);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Relatório Financeiro - ${data.periodText}`, 14, 26);

  // Summary box
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.text(`Receitas: ${formatMoney(data.summary.totalIncomeCents)}`, 14, 42);
  doc.text(`Despesas: ${formatMoney(data.summary.totalExpenseCents)}`, 74, 42);
  doc.text(`Saldo do Período: ${formatMoney(data.summary.balanceCents)}`, 134, 42);

  // Totals by Category
  const catTotals = new Map<string, { type: string; totalCents: number }>();
  data.transactions.forEach(t => {
    if (t.type === 'transfer') return;
    const catName = categoryMap.get(t.categoryId || '') || 'Sem Categoria';
    const key = `${t.type}:${catName}`;
    const existing = catTotals.get(key) || {
      type: t.type === 'income' ? 'Receita' : 'Despesa',
      totalCents: 0,
    };
    existing.totalCents += t.amountCents;
    catTotals.set(key, existing);
  });

  const categoryRows = Array.from(catTotals.entries())
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .map(([key, info]) => [
      key.split(':')[1],
      info.type,
      formatMoney(info.totalCents),
    ]);

  let nextStartY = 48;

  if (categoryRows.length > 0) {
    autoTable(doc, {
      startY: nextStartY,
      head: [['Categoria', 'Natureza', 'Total no Período']],
      body: categoryRows,
      theme: 'grid',
      headStyles: {
        fillColor: [43, 43, 43],
        textColor: [245, 245, 245],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
      },
    });
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
    nextStartY = (lastTable?.finalY || 48) + 8;
  }

  // Table of transactions
  const tableRows = data.transactions.map(t => [
    formatDisplayDate(t.date),
    t.description,
    categoryMap.get(t.categoryId || '') || 'Sem Categoria',
    accountMap.get(t.accountId) || 'Conta',
    t.type === 'income' ? 'Receita' : (t.type === 'expense' ? 'Despesa' : 'Transferência'),
    t.status === 'paid' ? 'Pago/Recebido' : 'Pendente',
    (t.type === 'expense' ? '-' : (t.type === 'income' ? '+' : '')) + formatMoney(t.amountCents),
  ]);

  autoTable(doc, {
    startY: nextStartY,
    head: [['Data', 'Descrição', 'Categoria', 'Conta', 'Tipo', 'Situação', 'Valor']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [217, 119, 87],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 248, 248],
    },
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
  });

  doc.save(`${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
}

/**
 * Export transactions to Excel (.xlsx) workbook.
 */
export function exportReportToExcel(data: ExportReportData) {
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));
  const accountMap = new Map(data.accounts.map(a => [a.id, a.name]));

  const rows = data.transactions.map(t => ({
    'Data': formatDisplayDate(t.date),
    'Descrição': t.description,
    'Categoria': categoryMap.get(t.categoryId || '') || 'Sem Categoria',
    'Conta': accountMap.get(t.accountId) || 'Conta',
    'Tipo': t.type === 'income' ? 'Receita' : (t.type === 'expense' ? 'Despesa' : 'Transferência'),
    'Situação': t.status === 'paid' ? 'Pago' : 'Pendente',
    'Valor (R$)': (t.type === 'expense' ? -1 : 1) * (t.amountCents / 100),
    'Data Vencimento': t.dueDate ? formatDisplayDate(t.dueDate) : '',
    'Data Pagamento': t.paidDate ? formatDisplayDate(t.paidDate) : '',
    'Forma de Pagamento': t.paymentMethod,
    'Tags': t.tags?.join(', ') || '',
    'Observações': t.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lançamentos');

  XLSX.writeFile(workbook, `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_extrato_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Export to CSV with semicolon separator and UTF-8 BOM for Brazilian Excel.
 */
export function exportReportToCSV(data: ExportReportData) {
  const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));
  const accountMap = new Map(data.accounts.map(a => [a.id, a.name]));

  const headers = ['Data', 'Descricao', 'Categoria', 'Conta', 'Tipo', 'Situacao', 'Valor_Centavos', 'Valor_Formatado', 'Metodo'];
  const lines: string[] = [headers.join(';')];

  data.transactions.forEach(t => {
    const row = [
      formatDisplayDate(t.date),
      `"${(t.description || '').replace(/"/g, '""')}"`,
      `"${categoryMap.get(t.categoryId || '') || ''}"`,
      `"${accountMap.get(t.accountId) || ''}"`,
      t.type,
      t.status,
      t.amountCents,
      `"${formatMoney(t.amountCents)}"`,
      t.paymentMethod,
    ];
    lines.push(row.join(';'));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_extrato_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Full Workspace JSON backup.
 */
export function exportBackupJSON(backupData: object) {
  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${APP_NAME.toLowerCase().replace(/\s+/g, '_')}_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}