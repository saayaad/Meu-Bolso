import React, { useState, useEffect } from 'react';
import {
  X,
  Trash2,
  Copy,
  Calendar,
  AlertCircle,
  FileText,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { CurrencyInput } from '../ui/CurrencyInput';
import { DatePicker } from '../ui/DatePicker';
import { CategorySelector } from '../ui/CategorySelector';
import {
  Transaction,
  TransactionType,
  PaymentMethod,
  TransactionStatus,
  TransactionAttachment,
} from '../../types';
import { todayString, addMonths } from '../../lib/dates';
import { formatMoney } from '../../lib/money';
import { compressImage } from '../../lib/images';
import { PAYMENT_METHOD_LABELS } from '../../lib/constants';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: TransactionType;
  editingTransaction?: Transaction | null;
}

const LAST_ACCOUNT_STORAGE_KEY = 'meu_bolso_last_account_id';

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  initialType = 'expense',
  editingTransaction = null,
}) => {
  const {
    accounts,
    categories,
    canEdit,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useWorkspace();

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountCents, setAmountCents] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [date, setDate] = useState<string>(todayString());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [dueDate, setDueDate] = useState<string>('');
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [recurrenceEnd, setRecurrenceEnd] = useState<string>('');
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(2);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [attachments, setAttachments] = useState<TransactionAttachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [showScopeDialog, setShowScopeDialog] = useState<boolean>(false);
  const [scopeAction, setScopeAction] = useState<'delete' | 'update'>('update');

  useEffect(() => {
    if (!isOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setAmountCents(editingTransaction.amountCents);
      setDescription(editingTransaction.description);
      setCategoryId(editingTransaction.categoryId || '');
      setSubcategoryId(editingTransaction.subcategoryId || '');
      setAccountId(editingTransaction.accountId);
      setToAccountId(editingTransaction.toAccountId || '');
      setDate(editingTransaction.date);
      setPaymentMethod(editingTransaction.paymentMethod);
      setStatus(editingTransaction.status);
      setDueDate(editingTransaction.dueDate || '');
      setTags(editingTransaction.tags || []);
      setNotes(editingTransaction.notes || '');
      setAttachments(editingTransaction.attachments || []);
      setIsRecurring(!!editingTransaction.recurrenceId);
      setIsInstallment(!!editingTransaction.installment);
      setInstallmentCount(editingTransaction.installment?.total || 2);
    } else {
      setType(initialType);
      setAmountCents(0);
      setDescription('');
      setSubcategoryId('');
      setDate(todayString());
      setDueDate('');
      setTags([]);
      setNotes('');
      setAttachments([]);
      setIsRecurring(false);
      setIsInstallment(false);
      setInstallmentCount(2);

      const savedLastAccId = localStorage.getItem(LAST_ACCOUNT_STORAGE_KEY);
      const savedAcc = accounts.find(a => !a.archived && a.id === savedLastAccId);
      const defaultAcc = savedAcc || accounts.find(a => !a.archived);
      if (defaultAcc) {
        setAccountId(defaultAcc.id);
      }

      if (initialType === 'income') {
        setStatus('paid');
        setPaymentMethod('pix');
      } else if (initialType === 'expense') {
        setStatus('paid');
        setPaymentMethod('pix');
      } else {
        setStatus('paid');
        setPaymentMethod('transferencia');
      }
    }
    setErrorMsg('');
    setShowScopeDialog(false);
  }, [editingTransaction, initialType, isOpen, accounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      const defaultAcc = accounts.find(a => !a.archived);
      if (defaultAcc) setAccountId(defaultAcc.id);
    }
  }, [accounts, accountId]);

  const availableCategories = categories.filter(c => {
    if (type === 'transfer') return false;
    return c.type === type && !c.parentId;
  });

  const subcategories = categories.filter(c => c.parentId === categoryId);

  useEffect(() => {
    if (type !== 'transfer' && (!categoryId || !availableCategories.some(c => c.id === categoryId))) {
      if (availableCategories.length > 0) {
        setCategoryId(availableCategories[0].id);
        setSubcategoryId('');
      }
    }
  }, [type, availableCategories, categoryId]);

  useEffect(() => {
    const selectedAcc = accounts.find(a => a.id === accountId);
    if (selectedAcc?.type === 'cartao_credito' && type === 'expense' && !editingTransaction) {
      setPaymentMethod('credito');
      setStatus('pending');

      const closingDay = selectedAcc.closingDay || 20;
      const dueDay = selectedAcc.dueDay || 28;
      const [year, month, day] = date.split('-').map(Number);

      let targetMonthOffset = day > closingDay ? 1 : 0;
      if (dueDay < closingDay) {
        targetMonthOffset += 1;
      }

      const invoiceMonth = addMonths(`${year}-${String(month).padStart(2, '0')}-01`, targetMonthOffset);
      const invoiceDueDate = `${invoiceMonth.substring(0, 7)}-${String(dueDay).padStart(2, '0')}`;
      setDueDate(invoiceDueDate);
    }
  }, [accountId, date, type, accounts, editingTransaction]);

  if (!isOpen) return null;

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '');
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O anexo deve ter no máximo 5 MB.');
      return;
    }

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file, 1600, 1600, 0.85);
      const reader = new FileReader();
      reader.readAsDataURL(compressedBlob);
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setAttachments([
          ...attachments,
          {
            path: `receipt_${Date.now()}_${file.name}`,
            url: dataUrl,
            name: file.name,
            contentType: file.type || 'image/jpeg',
          },
        ]);
        setIsUploading(false);
      };
    } catch {
      setErrorMsg('Falha ao processar arquivo.');
      setIsUploading(false);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const validateForm = () => {
    if (amountCents <= 0) {
      setErrorMsg('O valor deve ser maior que zero.');
      return false;
    }
    if (!description.trim()) {
      setErrorMsg('Informe uma descrição.');
      return false;
    }
    if (description.length > 120) {
      setErrorMsg('A descrição deve ter no máximo 120 caracteres.');
      return false;
    }
    if (!accountId) {
      setErrorMsg('Selecione uma conta.');
      return false;
    }
    if (type === 'transfer' && (!toAccountId || toAccountId === accountId)) {
      setErrorMsg('Selecione uma conta de destino diferente da conta de origem.');
      return false;
    }
    if (type !== 'transfer' && !categoryId) {
      setErrorMsg('Selecione uma categoria.');
      return false;
    }
    if (status === 'pending' && !dueDate) {
      setErrorMsg('A data de vencimento é obrigatória para lançamentos pendentes.');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleSave = async (addAnother = false) => {
    if (!canEdit) return;
    if (!validateForm()) return;

    if (editingTransaction && (editingTransaction.installment || editingTransaction.recurrenceId)) {
      setScopeAction('update');
      setShowScopeDialog(true);
      return;
    }

    await executeSave('single', addAnother);
  };

  const executeSave = async (scope: 'single' | 'future' | 'all' = 'single', addAnother = false) => {
    try {
      localStorage.setItem(LAST_ACCOUNT_STORAGE_KEY, accountId);
    } catch {}

    const baseData = {
      type,
      amountCents,
      description: description.trim(),
      categoryId: type === 'transfer' ? null : categoryId,
      subcategoryId: type === 'transfer' ? null : (subcategoryId || null),
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      date,
      paymentMethod,
      status,
      dueDate: status === 'pending' ? dueDate || date : null,
      paidDate: status === 'paid' ? date : null,
      paidFromAccountId: status === 'paid' ? accountId : null,
      tags,
      notes: notes.trim(),
      attachments,
    };

    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, baseData, scope);
    } else {
      await addTransaction(baseData, {
        installmentCount: isInstallment ? installmentCount : undefined,
        isRecurring,
        recurrenceFreq,
        recurrenceEnd: recurrenceEnd || undefined,
      });
    }

    if (addAnother) {
      setAmountCents(0);
      setDescription('');
      setNotes('');
      setAttachments([]);
      setDate(todayString());
      setErrorMsg('');
    } else {
      onClose();
    }
  };

  const handleDelete = () => {
    if (!editingTransaction || !canEdit) return;
    if (editingTransaction.installment || editingTransaction.recurrenceId) {
      setScopeAction('delete');
      setShowScopeDialog(true);
      return;
    }
    if (confirm('Deseja realmente excluir este lançamento?')) {
      deleteTransaction(editingTransaction.id, 'single');
      onClose();
    }
  };

  const executeScopeAction = async (scope: 'single' | 'future' | 'all') => {
    setShowScopeDialog(false);
    if (!editingTransaction) return;

    if (scopeAction === 'delete') {
      await deleteTransaction(editingTransaction.id, scope);
      onClose();
    } else {
      await executeSave(scope, false);
    }
  };

  const handleDuplicate = () => {
    if (!editingTransaction || !canEdit) return;
    const today = todayString();
    setDate(today);
    if (status === 'pending') {
      setDueDate(today);
    }
    setDescription(`${description.trim()} (Cópia)`.slice(0, 120));
    setIsInstallment(false);
    setIsRecurring(false);
    executeDuplicateNow(today);
  };

  const executeDuplicateNow = async (today: string) => {
    if (!validateForm()) return;
    const duplicatedData = {
      type,
      amountCents,
      description: `${description.trim()}`.slice(0, 120),
      categoryId: type === 'transfer' ? null : categoryId,
      subcategoryId: type === 'transfer' ? null : (subcategoryId || null),
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      date: today,
      paymentMethod,
      status,
      dueDate: status === 'pending' ? dueDate || today : null,
      paidDate: status === 'paid' ? today : null,
      paidFromAccountId: status === 'paid' ? accountId : null,
      tags,
      notes: notes.trim(),
      attachments,
    };

    await addTransaction(duplicatedData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[#1C1C1C] border border-[#2B2B2B] w-full max-w-xl rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2B2B2B] shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#F5F5F5]">
              {editingTransaction ? (canEdit ? 'Editar Lançamento' : 'Detalhes do Lançamento') : 'Novo Lançamento'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#2B2B2B] rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {errorMsg && (
            <div className="p-3 bg-[#F87171]/15 border border-[#F87171]/30 rounded-xl text-xs text-[#F87171] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#141414] border border-[#2B2B2B] rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setStatus('paid');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                type === 'expense'
                  ? 'bg-[#F87171] text-[#0A0A0A] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              Saída
            </button>
            <button
              type="button"
              onClick={() => {
                setType('income');
                setStatus('paid');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                type === 'income'
                  ? 'bg-[#4ADE80] text-[#0A0A0A] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              Entrada
            </button>
            <button
              type="button"
              onClick={() => {
                setType('transfer');
                setStatus('paid');
                setPaymentMethod('transferencia');
              }}
              className={`py-2 text-xs font-bold rounded-lg transition-all ${
                type === 'transfer'
                  ? 'bg-[#D97757] text-[#0A0A0A] shadow-sm'
                  : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
              }`}
            >
              Transferência
            </button>
          </div>

          {/* Valor */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Valor *
            </label>
            <CurrencyInput
              valueCents={amountCents}
              onChangeCents={setAmountCents}
              autoFocus={!editingTransaction}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Descrição *
            </label>
            <input
              type="text"
              maxLength={120}
              placeholder="Ex: Supermercado, Aluguel, Salário..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] placeholder-[#666] focus:outline-none focus:border-[#D97757] transition-colors"
            />
          </div>

          {/* Categoria e Subcategoria */}
          {type !== 'transfer' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Categoria *
                </label>
                <CategorySelector
                  categories={availableCategories}
                  selectedCategoryId={categoryId}
                  onSelect={id => {
                    setCategoryId(id);
                    setSubcategoryId('');
                  }}
                  type={type}
                />
              </div>

              {subcategories.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                    Subcategoria (opcional)
                  </label>
                  <select
                    value={subcategoryId}
                    onChange={e => setSubcategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                  >
                    <option value="">Nenhuma subcategoria</option>
                    {subcategories.map(sub => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Conta / Carteira & Conta Destino */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                {type === 'transfer' ? 'Conta de Origem *' : 'Conta ou Carteira *'}
              </label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757] transition-colors"
              >
                {accounts
                  .filter(a => !a.archived)
                  .map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
              </select>
            </div>

            {type === 'transfer' && (
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Conta de Destino *
                </label>
                <select
                  value={toAccountId}
                  onChange={e => setToAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757] transition-colors"
                >
                  <option value="">Selecione destino</option>
                  {accounts
                    .filter(a => !a.archived && a.id !== accountId)
                    .map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {type !== 'transfer' && (
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757] transition-colors"
                >
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Data & Situação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Data do Lançamento
              </label>
              <DatePicker value={date} onChange={val => setDate(val)} />
            </div>

            {type !== 'transfer' && (
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Situação
                </label>
                <div className="grid grid-cols-2 gap-1 p-1 bg-[#141414] border border-[#2B2B2B] rounded-xl">
                  <button
                    type="button"
                    onClick={() => setStatus('paid')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      status === 'paid'
                        ? 'bg-[#2B2B2B] text-[#F5F5F5]'
                        : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                    }`}
                  >
                    {type === 'income' ? 'Recebido agora' : 'Pago na hora'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus('pending');
                      if (!dueDate) setDueDate(date);
                    }}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                      status === 'pending'
                        ? 'bg-[#2B2B2B] text-[#D97757]'
                        : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                    }`}
                  >
                    {type === 'income' ? 'A receber' : 'Pagar depois'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Data de Vencimento Obrigatória se Pendente */}
          {status === 'pending' && (
            <div>
              <label className="block text-xs font-semibold text-[#D97757] mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>{type === 'income' ? 'Data Prevista de Recebimento *' : 'Data de Vencimento *'}</span>
              </label>
              <DatePicker value={dueDate} onChange={val => setDueDate(val)} />
            </div>
          )}

          {/* Parcelamento */}
          {type === 'expense' && !editingTransaction && (
            <div className="p-3.5 bg-[#141414] border border-[#2B2B2B] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#F5F5F5]">Lançamento Parcelado</p>
                  <p className="text-[11px] text-[#A3A3A3]">Dividir esta despesa em parcelas mensais</p>
                </div>
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={e => setIsInstallment(e.target.checked)}
                />
              </div>

              {isInstallment && (
                <div className="pt-2 border-t border-[#2B2B2B] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#A3A3A3]">Número de parcelas:</span>
                    <select
                      value={installmentCount}
                      onChange={e => setInstallmentCount(parseInt(e.target.value, 10))}
                      className="px-3 py-1 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      {Array.from({ length: 47 }, (_, i) => i + 2).map(n => (
                        <option key={n} value={n}>
                          {n}x de {amountCents > 0 ? formatMoney(Math.floor(amountCents / n)) : 'R$ 0,00'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recorrência */}
          {!editingTransaction && !isInstallment && (
            <div className="p-3.5 bg-[#141414] border border-[#2B2B2B] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#F5F5F5]">Lançamento Recorrente</p>
                  <p className="text-[11px] text-[#A3A3A3]">Repetir este lançamento periodicamente</p>
                </div>
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                />
              </div>

              {isRecurring && (
                <div className="pt-2 border-t border-[#2B2B2B] grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-[#A3A3A3] mb-1">Frequência</label>
                    <select
                      value={recurrenceFreq}
                      onChange={e => setRecurrenceFreq(e.target.value as 'weekly' | 'monthly' | 'yearly')}
                      className="w-full px-2.5 py-1.5 bg-[#1C1C1C] border border-[#2B2B2B] rounded-lg text-xs text-[#F5F5F5]"
                    >
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#A3A3A3] mb-1">Data Final (opcional)</label>
                    <DatePicker value={recurrenceEnd} onChange={val => setRecurrenceEnd(val)} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Tags (pressione Enter)
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2B2B2B] text-xs font-medium text-[#F5F5F5]"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-[#F87171]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              placeholder="Adicionar tag (ex: viagem, mercado)..."
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="w-full px-3.5 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666] focus:outline-none focus:border-[#D97757]"
            />
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Observações
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              placeholder="Notas adicionais sobre a transação..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] placeholder-[#666] focus:outline-none focus:border-[#D97757]"
            />
          </div>

          {/* Anexo */}
          <div>
            <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
              Comprovante / Anexo (Foto ou PDF até 5 MB)
            </label>
            <div className="space-y-2">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {att.contentType.startsWith('image/') ? (
                      <img src={att.url} alt="Comprovante" className="w-9 h-9 rounded-lg object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#2B2B2B] flex items-center justify-center text-[#D97757]">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <span className="text-xs text-[#F5F5F5] truncate max-w-[200px]">{att.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 text-[11px] text-[#D97757] hover:underline"
                    >
                      Abrir
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        className="p-1 text-[#A3A3A3] hover:text-[#F87171]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {attachments.length === 0 && canEdit && (
                <label className="flex items-center justify-center gap-2 p-3 bg-[#141414] hover:bg-[#1C1C1C] border border-dashed border-[#2B2B2B] hover:border-[#D97757] rounded-xl cursor-pointer text-xs text-[#A3A3A3] transition-colors">
                  <Upload className="w-4 h-4 text-[#D97757]" />
                  <span>{isUploading ? 'Processando imagem...' : 'Adicionar comprovante'}</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        {canEdit ? (
          <div className="p-4 bg-[#141414] border-t border-[#2B2B2B] shrink-0 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {editingTransaction && (
                <>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="p-2 text-[#F87171] hover:bg-[#F87171]/10 rounded-xl transition-colors"
                    title="Excluir Lançamento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="p-2 text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#2B2B2B] rounded-xl transition-colors"
                    title="Duplicar para hoje"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {!editingTransaction && (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  className="px-3.5 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
                >
                  Salvar e adicionar outro
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="px-5 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-xs font-bold text-[#0A0A0A] rounded-xl transition-all shadow-md active:scale-95"
              >
                Salvar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#141414] border-t border-[#2B2B2B] shrink-0 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-[#2B2B2B] text-xs font-bold text-[#F5F5F5] rounded-xl"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Scope Dialog for Installments / Recurrence updates or deletion */}
        {showScopeDialog && (
          <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <h3 className="font-bold text-sm text-[#F5F5F5]">
                {scopeAction === 'delete' ? 'Excluir lançamento agrupado' : 'Atualizar lançamento agrupado'}
              </h3>
              <p className="text-xs text-[#A3A3A3]">
                Este lançamento faz parte de uma {editingTransaction?.installment ? 'compra parcelada' : 'recorrência'}. Como deseja aplicar a alteração?
              </p>
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => executeScopeAction('single')}
                  className="w-full py-2 px-3 text-xs font-semibold bg-[#2B2B2B] hover:bg-[#3B3B3B] text-[#F5F5F5] rounded-xl text-left"
                >
                  Somente este lançamento
                </button>
                <button
                  type="button"
                  onClick={() => executeScopeAction('future')}
                  className="w-full py-2 px-3 text-xs font-semibold bg-[#2B2B2B] hover:bg-[#3B3B3B] text-[#F5F5F5] rounded-xl text-left"
                >
                  Este e os próximos lançamentos
                </button>
                <button
                  type="button"
                  onClick={() => executeScopeAction('all')}
                  className="w-full py-2 px-3 text-xs font-semibold bg-[#2B2B2B] hover:bg-[#3B3B3B] text-[#F5F5F5] rounded-xl text-left"
                >
                  Todos os lançamentos do grupo
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowScopeDialog(false)}
                className="w-full py-2 text-xs text-[#A3A3A3] hover:text-[#F5F5F5] text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};