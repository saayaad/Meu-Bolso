import React, { useState } from 'react';
import { Plus, Edit2, Trash2, FolderTree, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { Category, BudgetBucket } from '../types';
import { DynamicIcon } from '../components/ui/DynamicIcon';

const AVAILABLE_ICONS = [
  'ShoppingCart', 'Utensils', 'Coffee', 'Croissant', 'Car', 'Fuel',
  'Bus', 'Wrench', 'Pill', 'HeartPulse', 'Home', 'Building',
  'Zap', 'Wifi', 'Tv', 'Dumbbell', 'ShoppingBag', 'Sparkles',
  'Gamepad2', 'GraduationCap', 'PawPrint', 'Plane', 'Gift', 'Receipt',
  'CreditCard', 'TrendingUp', 'Briefcase', 'Laptop', 'PieChart', 'Tag',
  'Coins', 'RotateCcw', 'PlusCircle', 'Book', 'Music', 'Smartphone',
  'Shield', 'HelpCircle'
];

const AVAILABLE_COLORS = [
  '#D97757', '#E58A6B', '#F97316', '#FB923C', '#F59E0B', '#FBBF24',
  '#4ADE80', '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#38BDF8', '#3B82F6', '#60A5FA', '#6366F1', '#818CF8', '#8B5CF6',
  '#A855F7', '#D946EF', '#EC4899', '#F472B6', '#F43F5E', '#EF4444',
  '#DC2626', '#64748B', '#94A3B8', '#71717A'
];

export const CategoriesPage: React.FC = () => {
  const {
    categories,
    transactions,
    canEdit,
    addCategory,
    updateCategory,
    deleteCategory,
    restoreDefaultCategories,
  } = useWorkspace();
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState<string>('Home');
  const [color, setColor] = useState<string>('#D97757');
  const [bucket, setBucket] = useState<BudgetBucket | ''>('necessidades');
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion modals
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [simpleDeleteCategory, setSimpleDeleteCategory] = useState<Category | null>(null);
  const [reassignCategoryId, setReassignCategoryId] = useState<string>('');

  const currentList = categories.filter(c => c.type === activeTab);

  const showMessage = (msgType: 'success' | 'error', text: string) => {
    setFeedback({ type: msgType, text });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleRestoreDefaults = async () => {
    setIsRestoring(true);
    try {
      await restoreDefaultCategories();
      showMessage('success', 'Categorias padrão restauradas com sucesso!');
    } catch {
      showMessage('error', 'Erro ao restaurar categorias padrão.');
    } finally {
      setIsRestoring(false);
    }
  };

  const openNewCategoryModal = () => {
    setEditingCategory(null);
    setName('');
    setType(activeTab);
    setIcon(activeTab === 'expense' ? 'ShoppingBag' : 'Briefcase');
    setColor(activeTab === 'expense' ? '#D97757' : '#4ADE80');
    setBucket(activeTab === 'expense' ? 'necessidades' : '');
    setShowModal(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setType(cat.type);
    setIcon(cat.icon);
    setColor(cat.color);
    setBucket(cat.bucket || '');
    setShowModal(true);
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const catData: Omit<Category, 'id'> = {
      name: trimmedName,
      type,
      icon,
      color,
      bucket: type === 'expense' && bucket ? (bucket as BudgetBucket) : null,
      isDefault: editingCategory?.isDefault || false,
    };

    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, catData);
        showMessage('success', `Categoria "${trimmedName}" atualizada!`);
      } else {
        await addCategory(catData);
        showMessage('success', `Categoria "${trimmedName}" criada!`);
      }
    } catch {
      showMessage('error', 'Erro ao salvar categoria.');
    }
    
    setShowModal(false);
  };

  const handleDeleteRequest = (cat: Category) => {
    const hasTransactions = transactions.some(t => t.categoryId === cat.id);
    if (hasTransactions) {
      setCategoryToDelete(cat);
      const other = categories.find(c => c.id !== cat.id && c.type === cat.type);
      setReassignCategoryId(other?.id || '');
    } else {
      setSimpleDeleteCategory(cat);
    }
  };

  const confirmSimpleDelete = async () => {
    if (!simpleDeleteCategory) return;
    const target = simpleDeleteCategory;
    setSimpleDeleteCategory(null);
    try {
      await deleteCategory(target.id);
      showMessage('success', `Categoria "${target.name}" excluída.`);
    } catch {
      showMessage('error', 'Erro ao excluir categoria.');
    }
  };

  const confirmReassignAndDelete = async () => {
    if (!categoryToDelete) return;
    try {
      await deleteCategory(categoryToDelete.id, reassignCategoryId || undefined);
      showMessage('success', `Categoria excluída e lançamentos movidos.`);
    } catch {
      showMessage('error', 'Erro ao excluir categoria.');
    }
    setCategoryToDelete(null);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto relative">
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
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#F87171]" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 text-[#A3A3A3] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#F5F5F5]">Categorias</h2>
          <p className="text-xs text-[#A3A3A3]">
            Organize suas despesas e receitas por áreas e regra 50/30/20
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreDefaults}
              disabled={isRestoring}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--border-color)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <FolderTree className="w-4 h-4" />
              <span className="hidden sm:inline">{isRestoring ? 'Restaurando...' : 'Restaurar Padrões'}</span>
            </button>
            <button
              onClick={openNewCategoryModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#D97757] hover:bg-[#E58A6B] text-[#0A0A0A] font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Categoria</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-2xl w-full sm:w-64">
        <button
          onClick={() => setActiveTab('expense')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'expense' ? 'bg-[#F87171] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Despesas ({categories.filter(c => c.type === 'expense').length})
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'income' ? 'bg-[#4ADE80] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
          }`}
        >
          Receitas ({categories.filter(c => c.type === 'income').length})
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {currentList.map(cat => {
          const count = transactions.filter(t => t.categoryId === cat.id).length;
          return (
            <div
              key={cat.id}
              className="p-4 bg-[#141414] hover:bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                >
                  <DynamicIcon name={cat.icon} className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-[#F5F5F5] truncate">{cat.name}</h4>
                  <div className="flex items-center gap-2 text-[11px] text-[#A3A3A3]">
                    <span>{count} lançamentos</span>
                    {cat.bucket && (
                      <>
                        <span>•</span>
                        <span className="capitalize text-[#D97757]">{cat.bucket}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditCategoryModal(cat)}
                    className="p-1.5 text-[#A3A3A3] hover:text-[#F5F5F5] rounded-lg"
                    title="Editar"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(cat)}
                    className="p-1.5 text-[#A3A3A3] hover:text-[#F87171] rounded-lg"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#2B2B2B]">
              <h3 className="font-bold text-base text-[#F5F5F5]">
                {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#A3A3A3] hover:text-[#F5F5F5]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Nome *</label>
                <input
                  type="text"
                  placeholder="Ex: Streaming, Mercado, Salário..."
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-sm text-[#F5F5F5] focus:outline-none focus:border-[#D97757]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      type === 'expense' ? 'bg-[#F87171] text-[#0A0A0A]' : 'bg-[#141414] text-[#A3A3A3]'
                    }`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={`py-1.5 text-xs font-semibold rounded-lg ${
                      type === 'income' ? 'bg-[#4ADE80] text-[#0A0A0A]' : 'bg-[#141414] text-[#A3A3A3]'
                    }`}
                  >
                    Receita
                  </button>
                </div>
              </div>

              {type === 'expense' && (
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Regra 50/30/20 (Bucket)
                  </label>
                  <select
                    value={bucket}
                    onChange={e => setBucket(e.target.value as BudgetBucket)}
                    className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5]"
                  >
                    <option value="necessidades">Necessidades (50%)</option>
                    <option value="desejos">Desejos & Lazer (30%)</option>
                    <option value="poupanca">Poupança & Investimentos (20%)</option>
                  </select>
                </div>
              )}

              {/* Icon selector */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Ícone</label>
                <div className="grid grid-cols-9 gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-[#141414] border border-[#2B2B2B] rounded-xl">
                  {AVAILABLE_ICONS.map(i => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIcon(i)}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${
                        icon === i ? 'bg-[#D97757] text-[#0A0A0A]' : 'text-[#A3A3A3] hover:text-[#F5F5F5]'
                      }`}
                    >
                      <DynamicIcon name={i} className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color selector */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">Cor</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        color === c ? 'scale-125 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#2B2B2B] flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2 bg-[#D97757] text-xs font-bold text-[#0A0A0A] rounded-xl"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simple Delete Confirmation Modal */}
      {simpleDeleteCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-[#F5F5F5]">Excluir Categoria</h3>
            </div>
            <p className="text-xs text-[#A3A3A3]">
              Deseja realmente excluir a categoria <strong className="text-[#F5F5F5]">"{simpleDeleteCategory.name}"</strong>?
            </p>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSimpleDeleteCategory(null)}
                className="px-4 py-2 bg-[#2B2B2B] hover:bg-[#3B3B3B] text-xs font-semibold text-[#F5F5F5] rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmSimpleDelete}
                className="px-5 py-2 bg-[#F87171] hover:bg-[#EF4444] text-xs font-bold text-[#0A0A0A] rounded-xl shadow-md transition-all active:scale-95"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete and Reattribute Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1C1C1C] border border-[#2B2B2B] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-[#F87171]">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-bold text-base text-[#F5F5F5]">Excluir Categoria em Uso</h3>
            </div>
            <p className="text-xs text-[#A3A3A3]">
              A categoria <strong className="text-[#F5F5F5]">"{categoryToDelete.name}"</strong> possui lançamentos associados. Selecione para qual categoria deseja mover esses lançamentos:
            </p>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Nova Categoria de Destino
              </label>
              <select
                value={reassignCategoryId}
                onChange={e => setReassignCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-[#141414] border border-[#2B2B2B] rounded-xl text-xs text-[#F5F5F5]"
              >
                {categories
                  .filter(c => c.id !== categoryToDelete.id && c.type === categoryToDelete.type)
                  .map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 bg-[#2B2B2B] text-xs font-semibold text-[#F5F5F5] rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={confirmReassignAndDelete}
                className="px-4 py-2 bg-[#F87171] text-xs font-bold text-[#0A0A0A] rounded-xl"
              >
                Reatribuir e Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};