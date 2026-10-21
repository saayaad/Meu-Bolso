import React from 'react';
import {
  LayoutDashboard,
  ArrowLeftRight,
  CalendarClock,
  Wallet,
  PieChart,
  Tag,
  BarChart3,
  FileSpreadsheet,
  Users,
  Settings,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isDevicePinSet } from '../../lib/security';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLockApp: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab, onLockApp }) => {
  const { currentUser, userProfile, signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transações', icon: ArrowLeftRight },
    { id: 'payables', label: 'Contas a Pagar/Receber', icon: CalendarClock },
    { id: 'accounts', label: 'Contas & Cartões', icon: Wallet },
    { id: 'budgets', label: 'Orçamentos & Metas', icon: PieChart },
    { id: 'categories', label: 'Categorias', icon: Tag },
    { id: 'reports', label: 'Relatórios', icon: BarChart3 },
    { id: 'importexport', label: 'Importar / Exportar', icon: FileSpreadsheet },
    { id: 'sharing', label: 'Workspaces', icon: Users },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  const handleSignOut = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await signOut();
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-[var(--bg-card)] border-r border-[var(--border-color)] h-screen sticky top-0 z-40 transition-colors duration-200">
      {/* Brand Header */}
      <div className="p-6 border-b border-[var(--border-color)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#D97757] flex items-center justify-center text-[#0A0A0A] font-extrabold text-base shadow-sm">
          MB
        </div>
        <div>
          <h1 className="font-bold text-base text-[var(--text-primary)] tracking-tight leading-tight">Meu Bolso</h1>
          <p className="text-[10px] text-[var(--text-secondary)]">Gestão Financeira</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#D97757] text-[#0A0A0A] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer Controls */}
      <div className="p-4 border-t border-[var(--border-color)] space-y-3">
        <button
          type="button"
          onClick={onLockApp}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-[#D97757] hover:bg-[#D97757]/10 rounded-xl transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>{isDevicePinSet() ? 'Bloquear com PIN' : 'Bloquear com PIN (Configurar)'}</span>
        </button>

        {/* Profile and Logout Box */}
        <div className="flex items-center justify-between p-2 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-color)]">
          <button
            type="button"
            onClick={() => onSelectTab('profile')}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity cursor-pointer"
          >
            {userProfile?.photoURL ? (
              <img
                src={userProfile.photoURL}
                alt={userProfile.name}
                className="w-8 h-8 rounded-full object-cover shrink-0 border border-[var(--border-color)]"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#D97757]/20 text-[#D97757] font-bold text-xs flex items-center justify-center shrink-0">
                {(userProfile?.name?.[0] || 'U').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                {userProfile?.name || 'Usuário'}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)] truncate">
                {userProfile?.email || currentUser?.email || ''}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="p-2 text-[var(--text-secondary)] hover:text-[#F87171] hover:bg-[#F87171]/15 rounded-xl transition-colors cursor-pointer shrink-0 ml-1"
            title="Sair da conta"
            aria-label="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};