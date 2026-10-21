import React, { useState } from 'react';
import { Plus, Minus, ArrowLeftRight, X } from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface MobileFABProps {
  onOpenTransactionModal: (type: 'income' | 'expense' | 'transfer') => void;
}

export const MobileFAB: React.FC<MobileFABProps> = ({ onOpenTransactionModal }) => {
  const { canEdit } = useWorkspace();
  const [expanded, setExpanded] = useState(false);

  if (!canEdit) return null;

  const handleSelect = (type: 'income' | 'expense' | 'transfer') => {
    setExpanded(false);
    onOpenTransactionModal(type);
  };

  return (
    <div className="lg:hidden fixed bottom-18 right-4 z-40 flex flex-col items-end gap-2.5">
      {/* Expanded sub-options */}
      {expanded && (
        <div className="flex flex-col items-end gap-2 mb-1 animate-in fade-in slide-in-from-bottom-3 duration-150">
          {/* Transferência */}
          <div className="flex items-center gap-2">
            <span className="bg-[#1C1C1C] text-[#F5F5F5] text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#2B2B2B] shadow-lg">
              Transferência
            </span>
            <button
              onClick={() => handleSelect('transfer')}
              className="w-11 h-11 rounded-full bg-[#1C1C1C] hover:bg-[#2B2B2B] text-[#D97757] border border-[#2B2B2B] shadow-xl flex items-center justify-center transition-transform active:scale-95"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>
          </div>

          {/* Saída */}
          <div className="flex items-center gap-2">
            <span className="bg-[#1C1C1C] text-[#F87171] text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#2B2B2B] shadow-lg">
              Nova Saída
            </span>
            <button
              onClick={() => handleSelect('expense')}
              className="w-11 h-11 rounded-full bg-[#F87171] hover:bg-[#EF4444] text-[#0A0A0A] shadow-xl flex items-center justify-center transition-transform active:scale-95"
            >
              <Minus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Entrada */}
          <div className="flex items-center gap-2">
            <span className="bg-[#1C1C1C] text-[#4ADE80] text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#2B2B2B] shadow-lg">
              Nova Entrada
            </span>
            <button
              onClick={() => handleSelect('income')}
              className="w-11 h-11 rounded-full bg-[#4ADE80] hover:bg-[#22C55E] text-[#0A0A0A] shadow-xl flex items-center justify-center transition-transform active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>
      )}

      {/* Main trigger button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-13 h-13 rounded-full bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] shadow-2xl flex items-center justify-center transition-all duration-200 active:scale-90"
        title="Novo Lançamento"
        aria-label="Abrir opções de lançamento"
      >
        {expanded ? <X className="w-6 h-6 stroke-[2.5]" /> : <Plus className="w-6 h-6 stroke-[2.5]" />}
      </button>
    </div>
  );
};