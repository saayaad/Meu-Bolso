import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus } from 'lucide-react';
import { Category } from '../../types';
import { DynamicIcon } from './DynamicIcon';
import { useWorkspace } from '../../contexts/WorkspaceContext';

interface CategorySelectorProps {
  categories: Category[];
  selectedCategoryId: string;
  onSelect: (categoryId: string) => void;
  type: 'income' | 'expense';
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  categories,
  selectedCategoryId,
  onSelect,
  type,
}) => {
  const { addCategory } = useWorkspace();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [isCreatingQuick, setIsCreatingQuick] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCategories = categories.filter(
    c => c.type === type && c.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCat = categories.find(c => c.id === selectedCategoryId);

  // Get recent categories from localStorage
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`meu_bolso_recent_cats_${type}`);
      if (saved) setRecentIds(JSON.parse(saved));
    } catch {}
  }, [type]);

  const handleSelect = (catId: string) => {
    onSelect(catId);
    setIsOpen(false);
    setSearch('');
    setIsCreatingQuick(false);

    // Save to recent
    try {
      const updated = [catId, ...recentIds.filter(id => id !== catId)].slice(0, 4);
      setRecentIds(updated);
      localStorage.setItem(`meu_bolso_recent_cats_${type}`, JSON.stringify(updated));
    } catch {}
  };

  const handleQuickCreate = async () => {
    const trimmed = search.trim();
    if (!trimmed || isCreatingQuick) return;

    setIsCreatingQuick(true);
    try {
      const newCat: Omit<Category, 'id'> = {
        name: trimmed,
        type,
        icon: type === 'expense' ? 'ShoppingBag' : 'Briefcase',
        color: type === 'expense' ? '#D97757' : '#4ADE80',
        bucket: type === 'expense' ? 'necessidades' : null,
        isDefault: false,
      };

      // Adiciona temporariamente ou chama addCategory
      await addCategory(newCat);
      
      // Como o ID no addCategory é gerado via collection ref no context,
      // podemos aguardar o state do Workspace atualizar ou selecionar pelo nome recém criado no próximo render
    } catch (err) {
      console.error('Erro ao criar categoria rápida:', err);
    } finally {
      setIsCreatingQuick(false);
    }
  };

  // Auto-select newly created category if name matches search
  useEffect(() => {
    if (search.trim()) {
      const found = categories.find(
        c => c.type === type && c.name.toLowerCase() === search.trim().toLowerCase()
      );
      if (found && isOpen && !selectedCategoryId) {
        handleSelect(found.id);
      }
    }
  }, [categories, search, type]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentCategories = recentIds
    .map(id => categories.find(c => c.id === id))
    .filter((c): c is Category => !!c && c.type === type);

  const exactMatchExists = categories.some(
    c => c.type === type && c.name.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757] transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {selectedCat ? (
            <>
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${selectedCat.color}20`, color: selectedCat.color }}
              >
                <DynamicIcon name={selectedCat.icon} className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">{selectedCat.name}</span>
            </>
          ) : (
            <span className="text-[#666]">Selecione uma categoria...</span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-[#A3A3A3] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-2 bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl shadow-2xl p-3 z-60 animate-in fade-in zoom-in-95 space-y-3">
          {/* Search input with quick add */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              type="text"
              placeholder="Buscar ou digitar nova categoria..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim() && !exactMatchExists) {
                  e.preventDefault();
                  handleQuickCreate();
                }
              }}
              className="w-full pl-9 pr-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
              autoFocus
            />
          </div>

          {/* Quick Create Button if typing something new */}
          {search.trim() && !exactMatchExists && (
            <button
              type="button"
              onClick={handleQuickCreate}
              disabled={isCreatingQuick}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#D97757]/20 hover:bg-[#D97757]/30 text-[#D97757] border border-[#D97757]/40 rounded-xl text-xs font-bold transition-all active:scale-[0.99]"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingQuick ? 'Adicionando...' : `Adicionar "${search.trim()}" como nova categoria`}</span>
            </button>
          )}

          {/* Recent shortcuts */}
          {!search && recentCategories.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider px-1">
                Últimas usadas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {recentCategories.map(cat => (
                  <button
                    key={`recent-${cat.id}`}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#141414] hover:bg-[#2B2B2B] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5] transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All list */}
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            <span className="text-[10px] font-bold text-[#A3A3A3] uppercase tracking-wider px-1">
              Todas as categorias
            </span>
            {filteredCategories.map(cat => {
              const isSelected = cat.id === selectedCategoryId;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelect(cat.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                    isSelected ? 'bg-[#D97757]/20 text-[#D97757] font-semibold' : 'text-[#F5F5F5] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      <DynamicIcon name={cat.icon} className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-[#D97757] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};