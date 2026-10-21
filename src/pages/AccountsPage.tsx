import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CreditCard,
  Plus,
  ArrowLeftRight,
  Archive,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Account, AccountType, Transaction } from '../types';
import { formatMoney } from '../lib/money';
import {
  calculateAccountBalance,
  calculateCreditCardUsedLimit,
  calculateCreditCardAvailableLimit,
  calculateTotalNetWorth,
} from '../lib/balances';
import {
  currentMonthYearString,
  formatMonthYear,
  getPreviousMonth,
  getNextMonth,
  formatDisplayDate,
} from '../lib/dates';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { DynamicIcon } from '../components/ui/DynamicIcon';
import { ACCOUNT_TYPE_LABELS } from '../lib/constants';

interface AccountsPageProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer', editTx?: Transaction) => void;
}

const ACCOUNT_COLORS = [
  '#D97757', '#E58A6B', '#F97316', '#F59E0B', '#FBBF24',
  '#4ADE80', '#22C55E', '#10B981', '#14B8A6', '#06B6D4',
  '#38BDF8', '#3B82F6', '#2563EB', '#6366F1', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F43F5E', '#EF4444',
  '#A1A1AA', '#52525B', '#27272A', '#0A0A0A', '#F5F5F5'
];

const ACCOUNT_ICONS = [
  'Wallet', 'Landmark', 'CreditCard', 'PiggyBank', 'Coins', 'Building',
  'Briefcase', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤'
];

export const AccountsPage: React.FC<AccountsPageProps> = ({ onOpenTransactionModal }) => {
  const {
    accounts,
    transactions,
    canEdit,
    addAccount,
    updateAccount,
    archiveAccount,
    deleteAccount,
    payCreditCardInvoice,
  } = useWorkspace();

  const [selectedInvoiceMonth, setSelectedInvoiceMonth] = useState<string>(currentMonthYearString());
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showPayInvoiceModal, setShowPayInvoiceModal] = useState<boolean>(false);
  const [payFromAccountId, setPayFromAccountId] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const isSavingRef = useRef<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Estado para exclusão de conta
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);

  // Account form fields
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<AccountType>('corrente');
  const [initialBalanceCents, setInitialBalanceCents] = useState<number>(0);
  const [creditLimitCents, setCreditLimitCents] = useState<number>(100000);
  const [closingDay, setClosingDay] = useState<number>(20);
  const [dueDay, setDueDay] = useState<number>(28);
  const [color, setColor] = useState<string>('#D97757');
  const [icon, setIcon] = useState<string>('Wallet');

  const regularAccounts = useMemo(() => accounts.filter(a => a.type !== 'cartao_credito'), [accounts]);
  const creditCards = useMemo(() => accounts.filter(a => a.type === 'cartao_credito'), [accounts]);
  const totalNetWorth = useMemo(() => calculateTotalNetWorth(accounts, transactions), [accounts, transactions]);

  const showMessage = (msgType: 'success' | 'error', text: string) => {
    setFeedback({ type: msgType, text });
    setTimeout(() => {
      setFeedback(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  useEffect(() => {
    if (creditCards.length > 0 && (!selectedCardId || !creditCards.some(c => c.id === selectedCardId))) {
      setSelectedCardId(creditCards[0].id);
    }
  }, [creditCards, selectedCardId]);

  const activeCard = useMemo(() => creditCards.find(c => c.id === selectedCardId), [creditCards, selectedCardId]);

  const invoiceTransactions = useMemo(() => {
    if (!activeCard) return [];
    return transactions.filter(t => {
      if (t.accountId !== activeCard.id || t.type !== 'expense') return false;
      const d = t.dueDate || t.date;
      return d.startsWith(selectedInvoiceMonth);
    });
  }, [transactions, activeCard, selectedInvoiceMonth]);

  const invoiceTotalCents = useMemo(
    () => invoiceTransactions.reduce((acc, t) => acc + t.amountCents, 0),
    [invoiceTransactions]
  );

  const invoicePendingCents = useMemo(
    () => invoiceTransactions.filter(t => t.status === 'pending').reduce((acc, t) => acc + t.amountCents, 0),
    [invoiceTransactions]
  );

  const openNewAccountModal = () => {
    setEditingAccount(null);
    setName('');
    setType('corrente');
    setInitialBalanceCents(0);
    setCreditLimitCents(200000);
    setClosingDay(20);
    setDueDay(28);
    setColor('#D97757');
    setIcon('Wallet');
    setShowAccountModal(true);
  };

  const openEditAccountModal = (acc: Account) => {
    setEditingAccount(acc);
    setName(acc.name);
    setType(acc.type);
    setInitialBalanceCents(acc.initialBalanceCents || 0);
    setCreditLimitCents(acc.creditLimitCents || 100000);
    setClosingDay(acc.closingDay || 20);
    setDueDay(acc.dueDay || 28);
    setColor(acc.color || '#D97757');
    setIcon(acc.icon || 'Wallet');
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || isSavingRef.current) return;

    if (!editingAccount && accounts.some(a => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      showMessage('error', 'Já existe uma conta com este nome.');
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const data: Omit<Account, 'id'> = {
        name: trimmedName,
        type,
        initialBalanceCents: type === 'cartao_credito' ? 0 : initialBalanceCents,
        color,
        icon,
        archived: editingAccount?.archived || false,
        creditLimitCents: type === 'cartao_credito' ? creditLimitCents : undefined,
        closingDay: type === 'cartao_credito' ? closingDay : undefined,
        dueDay: type === 'cartao_credito' ? dueDay : undefined,
      };

      const isEditing = Boolean(editingAccount);

      if (editingAccount) {
        await updateAccount(editingAccount.id, data);
      } else {
        await addAccount(data);
      }

      setShowAccountModal(false);
      setEditingAccount(null);
      showMessage(
        'success',
        isEditing
          ? `Conta "${trimmedName}" atualizada com sucesso!`
          : `Conta "${trimmedName}" salva com sucesso!`
      );
    } catch (err) {
      console.error('Erro ao salvar conta:', err);
      showMessage('error', 'Não foi possível salvar a conta. Tente novamente.');
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleArchiveToggle = async (acc: Account) => {
    try {
      const nextArchived = !acc.archived;
      await archiveAccount(acc.id, nextArchived);
      showMessage(
        'success',
        nextArchived
          ? `Conta "${acc.name}" arquivada.`
          : `Conta "${acc.name}" restaurada com sucesso!`
      );
    } catch {
      showMessage('error', 'Erro ao alterar o status da conta.');
    }
  };

  const handlePayInvoice = async () => {
    if (!activeCard || !payFromAccountId) return;
    try {
      const pendingItems = invoiceTransactions.filter(t => t.status === 'pending');
      await payCreditCardInvoice(activeCard.id, payFromAccountId, pendingItems);
      setShowPayInvoiceModal(false);
      showMessage('success', `Fatura do cartão "${activeCard.name}" paga com sucesso!`);
    } catch {
      showMessage('error', 'Erro ao registrar pagamento da fatura.');
    }
  };

  const handleRequestDeleteAccount = (acc: Account) => {
    const hasLinkedTransactions = transactions.some(
      t =>
        t.accountId === acc.id ||
        t.toAccountId === acc.id ||
        t.paidFromAccountId === acc.id
    );
    if (hasLinkedTransactions) {
      showMessage(
        'error',
        `A conta "${acc.name}" possui lançamentos vinculados e não pode ser excluída. Você pode arquivá-la.`
      );
      return;
    }
    setAccountToDelete(acc);
  };

  const confirmDeleteAccount = () => {
    if (!accountToDelete) return;

    deleteAccount(accountToDelete.id);
    
    if (accountToDelete.type === 'cartao_credito') {
      setSelectedCardId('');
    }
    
    showMessage('success', `Conta "${accountToDelete.name}" excluída com sucesso.`);
    setAccountToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto text-[var(--text-primary)]">
      {/* Toast / Feedback Fixo no Topo */}
      {feedback && (
        <div
          className={`fixed top-16 right-4 z-60 max-w-sm w-full p-3.5 rounded-2xl border shadow-2xl flex items-center justify-between text-xs font-semibold animate-in fade-in slide-in-from-top-4 duration-200 ${
            feedback.type === 'success'
              ? 'bg-[#141414] border-[#4ADE80]/50 text-[#4ADE80]'
              : 'bg-[#141414] border-[#F87171]/50 text-[#F87171]'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#4ADE80]" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-[#F87171]" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Contas, Carteiras e Cartões</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Saldo total de contas: <strong className="text-[#4ADE80] tabular-nums font-bold">{formatMoney(totalNetWorth)}</strong>
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenTransactionModal('transfer')}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[#D97757] rounded-xl text-xs font-semibold transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transferir</span>
            </button>
            <button
              onClick={openNewAccountModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Conta / Cartão</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. Accounts & Wallets Grid */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          Contas Bancárias e Carteiras
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {regularAccounts.map(acc => {
            const balance = calculateAccountBalance(acc, transactions);
            return (
              <div
                key={acc.id}
                className={`p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl flex flex-col justify-between transition-all shadow-sm ${
                  acc.archived ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${acc.color}20`, color: acc.color }}
                    >
                      <DynamicIcon name={acc.icon || 'Wallet'} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{acc.name}</h4>
                      <p className="text-[11px] text-[var(--text-secondary)]">{ACCOUNT_TYPE_LABELS[acc.type]}</p>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditAccountModal(acc)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        title="Editar Conta"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleArchiveToggle(acc)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#D97757]"
                        title={acc.archived ? 'Desarquivar' : 'Arquivar'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRequestDeleteAccount(acc)}
                        className="p-1.5 text-[var(--text-secondary)] hover:text-[#F87171]"
                        title="Excluir Conta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border-color)]">
                  <p className="text-[11px] text-[var(--text-secondary)]">Saldo Disponível</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      balance >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'
                    }`}
                  >
                    {formatMoney(balance)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Credit Cards Section */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-color)]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
            Cartões de Crédito e Faturas
          </h3>
          {creditCards.length > 1 && (
            <div className="flex gap-2">
              {creditCards.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold border ${
                    selectedCardId === c.id
                      ? 'bg-[#D97757] text-[#0A0A0A] border-[#D97757]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {creditCards.length === 0 ? (
          <div className="p-8 text-center bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl">
            <CreditCard className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2" />
            <p className="text-xs text-[var(--text-secondary)]">Nenhum cartão de crédito cadastrado.</p>
          </div>
        ) : activeCard ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${activeCard.color}20`, color: activeCard.color }}
                  >
                    <DynamicIcon name={activeCard.icon || 'CreditCard'} className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-base">{activeCard.name}</h4>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Fecha dia {activeCard.closingDay} • Vence dia {activeCard.dueDay}
                    </p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditAccountModal(activeCard)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      title="Editar Cartão"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRequestDeleteAccount(activeCard)}
                      className="p-1.5 text-[var(--text-secondary)] hover:text-[#F87171]"
                      title="Excluir Cartão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {(() => {
                const limit = activeCard.creditLimitCents || 0;
                const used = calculateCreditCardUsedLimit(activeCard, transactions);
                const available = calculateCreditCardAvailableLimit(activeCard, transactions);
                const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

                return (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[var(--text-secondary)]">Limite Utilizado ({pct}%)</span>
                        <span className="text-[#F87171] font-bold tabular-nums">{formatMoney(used)}</span>
                      </div>
                      <div className="w-full h-3 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct > 90 ? 'bg-[#EF4444]' : pct > 70 ? 'bg-[#FBBF24]' : 'bg-[#D97757]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-[var(--text-secondary)] pt-1">
                        <span>Disponível: <strong className="text-[#4ADE80]">{formatMoney(available)}</strong></span>
                        <span>Limite Total: {formatMoney(limit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="lg:col-span-7 p-5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedInvoiceMonth(getPreviousMonth(selectedInvoiceMonth))}
                    className="p-1 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-sm capitalize">
                    Fatura {formatMonthYear(selectedInvoiceMonth)}
                  </span>
                  <button
                    onClick={() => setSelectedInvoiceMonth(getNextMonth(selectedInvoiceMonth))}
                    className="p-1 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {canEdit && invoicePendingCents > 0 && (
                  <button
                    onClick={() => {
                      const firstRegular = regularAccounts.find(a => !a.archived);
                      if (firstRegular) setPayFromAccountId(firstRegular.id);
                      setShowPayInvoiceModal(true);
                    }}
                    className="px-3 py-1.5 bg-[#4ADE80] hover:bg-[#22C55E] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    Pagar Fatura
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-3 bg-[var(--bg-elevated)] rounded-xl text-xs">
                <div>
                  <span className="text-[var(--text-secondary)]">Total da Fatura:</span>
                  <p className="text-base font-bold text-[#F87171] tabular-nums">{formatMoney(invoiceTotalCents)}</p>
                </div>
                <div className="text-right">
                  <span className="text-[var(--text-secondary)]">Situação:</span>
                  <p className={`font-bold ${invoicePendingCents > 0 ? 'text-[#FBBF24]' : 'text-[#4ADE80]'}`}>
                    {invoicePendingCents > 0 ? 'Aberta / Pendente' : 'Fatura Quitada'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {invoiceTransactions.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)] py-6 text-center">Nenhum gasto registrado nesta fatura.</p>
                ) : (
                  invoiceTransactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-2.5 bg-[var(--bg-elevated)]/60 rounded-xl text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{tx.description}</p>
                        <p className="text-[10px] text-[var(--text-secondary)]">{formatDisplayDate(tx.date)}</p>
                      </div>
                      <span className="font-bold text-[#F87171] tabular-nums shrink-0">
                        {formatMoney(tx.amountCents)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Account Modal (Create / Edit) */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <form
            onSubmit={handleSaveAccount}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl text-[var(--text-primary)] max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h3 className="font-bold text-base">
                {editingAccount ? 'Editar Conta' : 'Nova Conta / Cartão'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Nome da Conta *</label>
                <input
                  type="text"
                  placeholder="Ex: Nubank, Banco do Brasil, Carteira..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Tipo de Conta</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as AccountType)}
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                >
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </div>

              {type !== 'cartao_credito' && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Saldo Inicial</label>
                  <CurrencyInput valueCents={initialBalanceCents} onChangeCents={setInitialBalanceCents} />
                </div>
              )}

              {type === 'cartao_credito' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Limite Total do Cartão</label>
                    <CurrencyInput valueCents={creditLimitCents} onChangeCents={setCreditLimitCents} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Dia do Fechamento</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={closingDay}
                        onChange={e => setClosingDay(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[var(--text-secondary)] mb-1">Dia do Vencimento</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dueDay}
                        onChange={e => setDueDay(parseInt(e.target.value, 10))}
                        className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Icon / Emoji Picker */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Ícone ou Logo (Emoji)</label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl max-h-32 overflow-y-auto">
                  {ACCOUNT_ICONS.map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform ${
                        icon === i ? 'bg-[#D97757] text-[#0A0A0A] scale-110 shadow-md' : 'text-[var(--text-secondary)] hover:bg-[var(--border-color)]'
                      }`}
                    >
                      <DynamicIcon name={i} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Cor de Destaque</label>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-110 border-[var(--text-primary)] shadow-md' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-color)] flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                disabled={isSaving}
                className="px-4 py-2 bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-xs font-bold text-[#0A0A0A] rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pay Invoice Modal */}
      {showPayInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-[var(--text-primary)]">
            <h3 className="font-bold text-base">Pagar Fatura de {activeCard?.name}</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Valor da fatura a pagar: <strong className="text-[#F87171]">{formatMoney(invoicePendingCents)}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Pagar com qual conta?
              </label>
              <select
                value={payFromAccountId}
                onChange={e => setPayFromAccountId(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-elevated)] border border-[var(--border-color)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#D97757]"
              >
                {regularAccounts
                  .filter(a => !a.archived)
                  .map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({formatMoney(calculateAccountBalance(a, transactions))})
                    </option>
                  ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPayInvoiceModal(false)}
                className="px-3.5 py-2 bg-[var(--bg-elevated)] text-xs text-[var(--text-primary)] rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handlePayInvoice}
                className="px-4 py-2 bg-[#4ADE80] hover:bg-[#22C55E] text-xs font-bold text-[#0A0A0A] rounded-xl transition-all shadow-md active:scale-95"
              >
                Confirmar Pagamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-[var(--text-primary)] animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Excluir Conta</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">
              Deseja realmente excluir a conta <strong className="text-[var(--text-primary)]">"{accountToDelete.name}"</strong>?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAccountToDelete(null)}
                className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteAccount}
                className="px-5 py-2 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};