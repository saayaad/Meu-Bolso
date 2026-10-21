import React, { useState } from 'react';
import { Check, AlertTriangle, Paperclip, Trash2, AlertCircle } from 'lucide-react';
import { Transaction, Category, Account } from '../../types';
import { formatMoney } from '../../lib/money';
import { formatDisplayDate, isPastDue, isDueToday } from '../../lib/dates';
import { DynamicIcon } from '../ui/DynamicIcon';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface TransactionItemProps {
  transaction: Transaction;
  category?: Category;
  account?: Account;
  toAccount?: Account;
  creatorName?: string;
  showCreator?: boolean;
  onSelect: (t: Transaction) => void;
  onMarkPaid: (id: string) => void;
  onDelete?: (id: string, scope?: 'single' | 'future' | 'all') => void;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  category,
  account,
  toAccount,
  creatorName,
  showCreator = false,
  onSelect,
  onMarkPaid,
  onDelete,
}) => {
  const { canEdit } = useWorkspace();
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [showScopeDialog, setShowScopeDialog] = useState<boolean>(false);

  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';
  const isPending = transaction.status === 'pending';
  const pastDue = isPending && isPastDue(transaction.dueDate);
  const dueToday = isPending && isDueToday(transaction.dueDate);

  const iconName = isTransfer ? 'ArrowLeftRight' : (category?.icon || (isIncome ? 'Plus' : 'Minus'));
  const iconColor = isTransfer ? '#D97757' : (category?.color || (isIncome ? '#4ADE80' : '#F87171'));

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    if (transaction.installment || transaction.recurrenceId) {
      setShowScopeDialog(true);
    } else {
      setShowDeleteModal(true);
    }
  };

  const handleConfirmDelete = (scope: 'single' | 'future' | 'all' = 'single') => {
    setShowDeleteModal(false);
    setShowScopeDialog(false);
    if (onDelete) {
      onDelete(transaction.id, scope);
    }
  };

  return (
    <>
      <div
        onClick={() => canEdit && onSelect(transaction)}
        className={`group flex items-center justify-between p-3.5 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl transition-all gap-3 ${
          canEdit ? 'cursor-pointer active:scale-[0.99]' : 'cursor-default'
        }`}
      >
        {/* Icon & Details */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: `${iconColor}20`, color: iconColor }}
          >
            <DynamicIcon name={iconName} className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-[#F5F5F5] truncate group-hover:text-[#D97757] transition-colors">
                {transaction.description}
              </h4>

              {transaction.attachments?.length > 0 && (
                <Paperclip className="w-3 h-3 text-[#A3A3A3] shrink-0" />
              )}

              {/* Badges */}
              {pastDue && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#F87171]/20 text-[#F87171] border border-[#F87171]/30 rounded-md shrink-0 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  Vencida
                </span>
              )}
              {dueToday && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/30 rounded-md shrink-0">
                  Hoje
                </span>
              )}
              {isPending && !pastDue && !dueToday && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-[#2B2B2B] text-[#A3A3A3] rounded-md shrink-0">
                  Pendente
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[11px] text-[#A3A3A3]">
              <span>
                {isTransfer
                  ? `${account?.name || 'Origem'} ➔ ${toAccount?.name || 'Destino'}`
                  : `${account?.name || 'Conta'} • ${category?.name || 'Geral'}`}
              </span>
              {transaction.dueDate && isPending && (
                <>
                  <span>•</span>
                  <span className={pastDue ? 'text-[#F87171] font-semibold' : ''}>
                    Venc.: {formatDisplayDate(transaction.dueDate)}
                  </span>
                </>
              )}
              {showCreator && creatorName && (
                <>
                  <span>•</span>
                  <span className="text-[#D97757]">Por {creatorName}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Amount and Fast Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="text-right">
            <p
              className={`text-xs sm:text-sm font-bold tabular-nums ${
                isTransfer
                  ? 'text-[#F5F5F5]'
                  : isIncome
                  ? 'text-[#4ADE80]'
                  : 'text-[#F87171]'
              }`}
            >
              {isTransfer ? '' : isIncome ? '+' : '-'}{formatMoney(transaction.amountCents)}
            </p>
            <p className="text-[10px] text-[#A3A3A3] tabular-nums">
              {formatDisplayDate(transaction.date)}
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1">
              {/* Quick Mark Paid / Received Button */}
              {isPending && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onMarkPaid(transaction.id);
                  }}
                  className="p-1.5 bg-[#2B2B2B] hover:bg-[#4ADE80] text-[#A3A3A3] hover:text-[#0A0A0A] rounded-xl transition-all shadow-sm"
                  title={isIncome ? 'Marcar como recebido' : 'Marcar como pago'}
                >
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </button>
              )}

              {/* Quick Delete Button */}
              {onDelete && (
                <button
                  onClick={handleDeleteClick}
                  className="p-1.5 bg-[#2B2B2B] hover:bg-[#F87171]/20 text-[#A3A3A3] hover:text-[#F87171] rounded-xl transition-all shadow-sm"
                  title="Excluir Lançamento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Simple Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-[#F5F5F5]">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-base">Excluir Lançamento</h3>
            </div>
            <p className="text-xs text-[#A3A3A3]">
              Deseja realmente excluir o lançamento <strong className="text-[#F5F5F5]">"{transaction.description}"</strong>?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete('single')}
                className="px-5 py-2 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scope Dialog for Installments / Recurrence deletion */}
      {showScopeDialog && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-[#F5F5F5]">
            <h3 className="font-bold text-sm text-[#F5F5F5]">
              Excluir lançamento agrupado
            </h3>
            <p className="text-xs text-[#A3A3A3]">
              Este lançamento faz parte de uma {transaction.installment ? 'compra parcelada' : 'recorrência'}. Como deseja aplicar a exclusão?
            </p>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleConfirmDelete('single')}
                className="w-full py-2 px-3 text-xs font-semibold bg-[#2B2B2B] hover:bg-[#3B3B3B] text-[#F5F5F5] rounded-xl text-left"
              >
                Somente este lançamento
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete('future')}
                className="w-full py-2 px-3 text-xs font-semibold bg-[#2B2B2B] hover:bg-[#3B3B3B] text-[#F5F5F5] rounded-xl text-left"
              >
                Este e os próximos lançamentos
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDelete('all')}
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
    </>
  );
};