import React, { useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Check,
  RefreshCw,
  X,
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { ParsedBankTransaction, Transaction } from '../types';
import { parseOFX } from '../lib/ofx';
import { parseCSVFile, convertMappedRowsToTransactions, CSVParseResult } from '../lib/csv';
import { formatMoney } from '../lib/money';
import { formatDisplayDate } from '../lib/dates';
import {
  exportReportToPDF,
  exportReportToExcel,
  exportReportToCSV,
  exportBackupJSON,
} from '../lib/export';

export const ImportExportPage: React.FC = () => {
  const {
    workspace,
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    addTransaction,
  } = useWorkspace();

  const [importMode, setImportMode] = useState<'ofx' | 'csv' | 'backup'>('ofx');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [importedItems, setImportedItems] = useState<ParsedBankTransaction[]>([]);
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [csvMapping, setCsvMapping] = useState({ dateCol: 0, descCol: 1, amountCol: 2 });
  const [ignoreDuplicates, setIgnoreDuplicates] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Set default account
  React.useEffect(() => {
    const regular = accounts.find(a => !a.archived);
    if (regular && !selectedAccountId) {
      setSelectedAccountId(regular.id);
    }
  }, [accounts, selectedAccountId]);

  // Read OFX file
  const handleOFXUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const parsed = parseOFX(text);
        if (parsed.length === 0) {
          setFeedbackMsg({ type: 'error', text: 'Nenhuma transação encontrada no arquivo OFX.' });
          return;
        }

        // Detect duplicates with existing transactions
        const tagged = parsed.map(item => {
          const isDuplicate = transactions.some(
            t => (item.fitId && t.id.includes(item.fitId)) || (t.date === item.date && t.amountCents === item.amountCents && t.description.toLowerCase() === item.description.toLowerCase())
          );
          return {
            ...item,
            selected: !isDuplicate,
          };
        });

        setImportedItems(tagged);
        setFeedbackMsg({ type: 'success', text: `${parsed.length} lançamentos lidos com sucesso do OFX.` });
      } catch (err) {
        setFeedbackMsg({ type: 'error', text: 'Erro ao interpretar o arquivo OFX.' });
      }
    };
    reader.readAsText(file);
  };

  // Read CSV file
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const text = event.target?.result as string;
        const result = parseCSVFile(text);
        setCsvResult(result);
        setCsvMapping({
          dateCol: result.suggestedMapping.dateCol,
          descCol: result.suggestedMapping.descCol,
          amountCol: result.suggestedMapping.amountCol,
        });

        // Convert immediately
        const items = convertMappedRowsToTransactions(result.rows, result.suggestedMapping);
        setImportedItems(items);
        setFeedbackMsg({ type: 'success', text: `${items.length} linhas lidas do CSV.` });
      } catch {
        setFeedbackMsg({ type: 'error', text: 'Erro ao interpretar o arquivo CSV.' });
      }
    };
    reader.readAsText(file);
  };

  // Re-apply CSV mapping
  const applyCsvMapping = () => {
    if (!csvResult) return;
    const items = convertMappedRowsToTransactions(csvResult.rows, csvMapping);
    setImportedItems(items);
  };

  // JSON Backup Restore
  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
          setFeedbackMsg({ type: 'error', text: 'Arquivo de backup inválido: formato incompatível.' });
          return;
        }

        setIsProcessing(true);
        let restoredCount = 0;
        for (const t of parsed.transactions) {
          // Add if not existing
          if (!transactions.some(existing => existing.id === t.id)) {
            await addTransaction({
              type: t.type,
              amountCents: t.amountCents,
              description: t.description,
              categoryId: t.categoryId || null,
              subcategoryId: null,
              accountId: t.accountId || selectedAccountId,
              toAccountId: t.toAccountId || null,
              date: t.date,
              paymentMethod: t.paymentMethod || 'outro',
              status: t.status || 'paid',
              dueDate: t.dueDate || null,
              paidDate: t.paidDate || null,
              paidFromAccountId: t.paidFromAccountId || null,
              tags: t.tags || [],
              notes: t.notes || '',
              attachments: t.attachments || [],
            });
            restoredCount++;
          }
        }

        setIsProcessing(false);
        setFeedbackMsg({ type: 'success', text: `Backup restaurado com sucesso! ${restoredCount} lançamentos adicionados.` });
      } catch {
        setIsProcessing(false);
        setFeedbackMsg({ type: 'error', text: 'Falha ao processar arquivo JSON de backup.' });
      }
    };
    reader.readAsText(file);
  };

  // Confirm import of selected items into Firestore
  const handleConfirmImport = async () => {
    if (!selectedAccountId) {
      setFeedbackMsg({ type: 'error', text: 'Selecione a conta destino para estes lançamentos.' });
      return;
    }

    const toImport = importedItems.filter(item => item.selected);
    if (toImport.length === 0) {
      setFeedbackMsg({ type: 'error', text: 'Nenhum lançamento selecionado para importação.' });
      return;
    }

    setIsProcessing(true);
    let count = 0;

    for (const item of toImport) {
      // Find category by suggested name or default
      let categoryId: string | null = null;
      if (item.suggestedCategoryId) {
        const found = categories.find(c => c.name.toLowerCase() === item.suggestedCategoryId?.toLowerCase());
        if (found) categoryId = found.id;
      }
      if (!categoryId) {
        const defaultCat = categories.find(c => c.type === item.type);
        if (defaultCat) categoryId = defaultCat.id;
      }

      await addTransaction({
        type: item.type,
        amountCents: item.amountCents,
        description: item.description,
        categoryId,
        subcategoryId: null,
        accountId: selectedAccountId,
        toAccountId: null,
        date: item.date,
        paymentMethod: 'outro',
        status: 'paid',
        dueDate: null,
        paidDate: item.date,
        paidFromAccountId: selectedAccountId,
        tags: ['importado'],
        notes: item.fitId ? `FITID: ${item.fitId}` : '',
        attachments: [],
      });
      count++;
    }

    setIsProcessing(false);
    setImportedItems([]);
    setFeedbackMsg({ type: 'success', text: `Sucesso! ${count} lançamentos foram importados para sua conta.` });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-[#F5F5F5]">Importação e Exportação de Dados</h2>
        <p className="text-xs text-[#A3A3A3]">
          Importe extratos OFX de bancos, arquivos CSV e faça backups completos em JSON
        </p>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            feedbackMsg.type === 'success'
              ? 'bg-[#4ADE80]/15 border-[#4ADE80]/30 text-[#4ADE80]'
              : 'bg-[#F87171]/15 border-[#F87171]/30 text-[#F87171]'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedbackMsg.text}</span>
          </div>
          <button onClick={() => setFeedbackMsg(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-2xl w-full sm:w-96">
        <button
          onClick={() => {
            setImportMode('ofx');
            setImportedItems([]);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            importMode === 'ofx' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Extrato OFX
        </button>
        <button
          onClick={() => {
            setImportMode('csv');
            setImportedItems([]);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            importMode === 'csv' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Extrato CSV
        </button>
        <button
          onClick={() => {
            setImportMode('backup');
            setImportedItems([]);
          }}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            importMode === 'backup' ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Backup JSON
        </button>
      </div>

      {/* 1. OFX Import Section */}
      {importMode === 'ofx' && (
        <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-5">
          <div>
            <h3 className="font-bold text-sm text-[#F5F5F5]">Importar Extrato Bancário (.OFX)</h3>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              Suporta arquivos OFX de bancos como Nubank, Itaú, Bradesco, Inter, Santander, Caixa e Banco do Brasil.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center p-8 bg-[#1C1C1C] hover:bg-[#2B2B2B]/60 border-2 border-dashed border-[#2B2B2B] hover:border-[#D97757] rounded-2xl cursor-pointer transition-colors text-center">
            <Upload className="w-8 h-8 text-[#D97757] mb-2" />
            <span className="text-sm font-semibold text-[#F5F5F5]">Clique para selecionar o arquivo .ofx</span>
            <span className="text-xs text-[#A3A3A3] mt-1">Lê transações bancárias e detecta duplicadas automaticamente</span>
            <input type="file" accept=".ofx" onChange={handleOFXUpload} className="hidden" />
          </label>
        </div>
      )}

      {/* 2. CSV Import Section */}
      {importMode === 'csv' && (
        <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-5">
          <div>
            <h3 className="font-bold text-sm text-[#F5F5F5]">Importar Planilha ou Extrato (.CSV)</h3>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              Compatível com formato brasileiro de data (DD/MM/AAAA) e valores monetários (1.234,56).
            </p>
          </div>

          <label className="flex flex-col items-center justify-center p-8 bg-[#1C1C1C] hover:bg-[#2B2B2B]/60 border-2 border-dashed border-[#2B2B2B] hover:border-[#D97757] rounded-2xl cursor-pointer transition-colors text-center">
            <FileSpreadsheet className="w-8 h-8 text-[#4ADE80] mb-2" />
            <span className="text-sm font-semibold text-[#F5F5F5]">Clique para selecionar o arquivo .csv</span>
            <span className="text-xs text-[#A3A3A3] mt-1">Mapeamento de colunas com detecção inteligente</span>
            <input type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          </label>

          {csvResult && csvResult.headers.length > 0 && (
            <div className="p-4 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl space-y-3">
              <h4 className="font-bold text-xs text-[#F5F5F5]">Mapeamento de Colunas do CSV</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-[#A3A3A3] mb-1">Coluna da Data</label>
                  <select
                    value={csvMapping.dateCol}
                    onChange={e => setCsvMapping({ ...csvMapping, dateCol: parseInt(e.target.value, 10) })}
                    className="w-full px-2.5 py-1.5 bg-[#141414] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
                  >
                    {csvResult.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#A3A3A3] mb-1">Coluna da Descrição</label>
                  <select
                    value={csvMapping.descCol}
                    onChange={e => setCsvMapping({ ...csvMapping, descCol: parseInt(e.target.value, 10) })}
                    className="w-full px-2.5 py-1.5 bg-[#141414] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
                  >
                    {csvResult.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-[#A3A3A3] mb-1">Coluna do Valor</label>
                  <select
                    value={csvMapping.amountCol}
                    onChange={e => setCsvMapping({ ...csvMapping, amountCol: parseInt(e.target.value, 10) })}
                    className="w-full px-2.5 py-1.5 bg-[#141414] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
                  >
                    {csvResult.headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={applyCsvMapping}
                  className="px-4 py-1.5 bg-[#D97757] text-[#0A0A0A] font-bold text-xs rounded-xl"
                >
                  Atualizar Mapeamento
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. JSON Backup Section */}
      {importMode === 'backup' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Export full backup */}
          <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#D97757]/20 text-[#D97757] flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#F5F5F5]">Exportar Backup Completo</h3>
              <p className="text-xs text-[#A3A3A3]">
                Baixe todos os seus lançamentos, contas, categorias, orçamentos e metas em um arquivo JSON seguro.
              </p>
            </div>
            <button
              onClick={() => {
                exportBackupJSON({
                  workspace,
                  accounts,
                  categories,
                  transactions,
                  budgets,
                  goals,
                  exportedAt: new Date().toISOString(),
                });
              }}
              className="w-full py-2.5 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
            >
              Baixar Backup (.JSON)
            </button>
          </div>

          {/* Restore backup */}
          <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#4ADE80]/20 text-[#4ADE80] flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#F5F5F5]">Restaurar Backup</h3>
              <p className="text-xs text-[#A3A3A3]">
                Carregue um arquivo JSON gerado pelo Meu Bolso para restaurar seus dados.
              </p>
            </div>
            <label className="w-full py-2.5 bg-[#1C1C1C] hover:bg-[#2B2B2B] border border-[#2B2B2B] text-[#F5F5F5] font-semibold text-xs rounded-xl text-center cursor-pointer transition-colors block">
              {isProcessing ? 'Restaurando...' : 'Selecionar Arquivo de Backup'}
              <input type="file" accept=".json" onChange={handleRestoreJSON} disabled={isProcessing} className="hidden" />
            </label>
          </div>
        </div>
      )}

      {/* 4. PREVIEW AND CONFIRMATION OF IMPORTED ITEMS */}
      {importedItems.length > 0 && (
        <div className="p-6 bg-[#141414] border border-[#2B2B2B] rounded-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#2B2B2B]">
            <div>
              <h3 className="font-bold text-sm text-[#F5F5F5]">
                Pré-visualização dos Lançamentos ({importedItems.filter(i => i.selected).length} selecionados)
              </h3>
              <p className="text-xs text-[#A3A3A3]">
                Revise os lançamentos antes de salvar na sua conta.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-[10px] text-[#A3A3A3] mb-0.5">Conta de Destino:</label>
                <select
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                  className="px-3 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5]"
                >
                  {accounts.filter(a => !a.archived).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-[#4ADE80] hover:bg-[#22C55E] text-[#0A0A0A] font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 mt-3 sm:mt-0"
              >
                {isProcessing ? 'Importando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>

          {/* List of items */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {importedItems.map((item, idx) => (
              <div
                key={item.id || idx}
                className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  item.selected ? 'bg-[#1C1C1C] border-[#2B2B2B]' : 'bg-[#141414] border-[#2B2B2B]/40 opacity-40'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="checkbox"
                    checked={item.selected}
                    onChange={e => {
                      const updated = [...importedItems];
                      updated[idx].selected = e.target.checked;
                      setImportedItems(updated);
                    }}
                    className="w-4 h-4 rounded text-[#D97757] accent-[#D97757]"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#F5F5F5] truncate">{item.description}</p>
                    <div className="flex items-center gap-2 text-[11px] text-[#A3A3A3]">
                      <span>{formatDisplayDate(item.date)}</span>
                      {item.suggestedCategoryId && (
                        <>
                          <span>•</span>
                          <span className="text-[#D97757]">Sugestão: {item.suggestedCategoryId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`font-bold tabular-nums ${
                      item.type === 'income' ? 'text-[#4ADE80]' : 'text-[#F87171]'
                    }`}
                  >
                    {item.type === 'income' ? '+' : '-'}{formatMoney(item.amountCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
